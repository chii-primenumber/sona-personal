import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Modal } from './Modal'
import { PlayerHistoryModal } from './PlayerHistoryModal'
import { ChampionStrip, HistoryImage, MatchReport, championName } from './HistoryWidgets'
import { HistoryDisplaySettings } from './HistoryDisplaySettings'
import { HistoryPlayerName } from './HistoryPlayerName'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { HistoryPerformanceStats } from './HistoryPerformanceStats'
import { HistoryScrollTop } from './HistoryScrollTop'
import { bindScrollbarHighlight } from '@/lib/scrollbar-highlight'
import { RefreshIcon, SettingsIcon } from './icons'
import { lcu, LcuEventUri } from '@/lib/lcu'
import { store } from '@/lib/store'
import { deobfuscateChampSelectPuuid } from '@/lib/champ-select-puuid'
import { getChampIcon, getPlayableQueues, getQueueName } from '@/lib/assets'
import { getRankedMiniCrest } from '@/lib/ranked-assets'
import { deadline, fetchHistoryRanks, fetchHistorySummoner, rankText, type HistoryRank } from '@/lib/history-api'
import { mean, numberText, percentText, POSITION_NAMES, profileIconUrl, summarize, toHistoryMatches, validMatches, type HistoryMatch } from '@/lib/history-model'
import { calculatePlayerScore, playerScoreName, playerScoreLabel, playerScoreRange, formatPlayerScore } from '@/lib/player-score'
import { usePlayerScoreSystem } from '@/lib/use-player-score'
import { useHistoryPages } from '@/lib/use-history-pages'
import { useHistoryHiddenFields } from '@/lib/use-history-display'
import { isHistoryFieldVisible, type HistoryDisplayField, type HistoryHiddenFields } from '@/lib/history-display'
import type { ChampSelectSession, GameflowSession, SummonerInfo } from '@/types/lcu'
import '@/styles/PersonalHistory.css'

export type TeamHistoryMode = 'bp' | 'game'
interface Member { key: string; puuid: string; name: string; championId: number; position: string; premade?: number; self?: boolean }
interface Team { id: string; label: string; members: Member[] }
interface Snapshot { queueId: number; queueName: string; teams: Team[] }
type PlayerSummary = ReturnType<typeof summarize>
const recentMatchDate = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
const premadeColors = ['#ffc857', '#55d6ff', '#70f0a4', '#ff7b9c', '#c9a0ff']
const emptyParty = new Set<string>()

const positionName = (position: string) => POSITION_NAMES[({ MID: 'MIDDLE', BOT: 'BOTTOM', SUPPORT: 'UTILITY' } as Record<string, string>)[position.toUpperCase()] || position.toUpperCase()] || ''

function bpSnapshot(session: ChampSelectSession, party: ReadonlySet<string>, fallbackQueueId = 0): Snapshot {
  const queueId = session.queueId || fallbackQueueId
  const picks = (session.actions || []).flat(2).filter((action) => action.type === 'pick')
  return { queueId, queueName: getQueueName(queueId), teams: [{ id: 'ally', label: '己方队伍', members: (session.myTeam || []).slice(0, 5).map((p, index) => {
    const puuid = p.puuid || (p.nameVisibilityType === 'HIDDEN' && p.obfuscatedPuuid ? deobfuscateChampSelectPuuid(p.obfuscatedPuuid) : '')
    const playerPicks = picks.filter((action) => action.actorCellId === p.cellId)
    const locked = p.championId > 0 && (!playerPicks.length || playerPicks.some((action) => action.completed))
    return { key: puuid || `slot-${p.cellId ?? index}`, puuid, name: p.gameName ? `${p.gameName}${p.tagLine ? `#${p.tagLine}` : ''}` : p.playerAlias || `${index + 1} 楼`, championId: locked ? p.championId : 0, position: positionName(p.assignedPosition || ''), self: p.cellId === session.localPlayerCellId, premade: party.has(puuid) ? 1 : undefined }
  }) }] }
}

function gameSnapshot(session: GameflowSession): Snapshot {
  const data = session.gameData
  const selections = data.playerChampionSelections || []
  const firstSize = data.teamOne?.length && data.teamTwo?.length && data.teamOne.length + data.teamTwo.length === selections.length ? data.teamOne.length : Math.ceil(selections.length / 2)
  const teams = [data.teamOne || [], data.teamTwo || []].map((players, side) => {
    const members = new Map<string, Member>()
    players.forEach((p, index) => {
      if (!p.puuid) return
      members.set(p.puuid, { key: p.puuid, puuid: p.puuid, name: p.summonerName || `${side === 0 ? '蓝方' : '红方'} ${index + 1}`, championId: p.championId || 0, position: positionName(p.selectedPosition || ''), premade: p.teamParticipantId })
    })
    const opposingIds = new Set((side === 0 ? data.teamTwo : data.teamOne)?.map((p) => p.puuid) || [])
    const selected = side === 0 ? selections.slice(0, firstSize) : selections.slice(firstSize)
    selected.forEach((p, index) => {
      if (!p.puuid || opposingIds.has(p.puuid)) return
      const previous = members.get(p.puuid)
      if (previous) { if (p.championId) previous.championId = p.championId; return }
      members.set(p.puuid, { key: p.puuid, puuid: p.puuid, name: `${side === 0 ? '蓝方' : '红方'} ${index + 1}`, championId: p.championId || 0, position: '' })
    })
    return { id: side === 0 ? 'blue' : 'red', label: side === 0 ? '蓝色方' : '红色方', members: [...members.values()] }
  })
  const seen = new Set<string>()
  for (const team of teams) team.members = team.members.filter((member) => { if (seen.has(member.key)) return false; seen.add(member.key); return true })
  return { queueId: data.queue?.id || 0, queueName: data.queue?.name || getQueueName(data.queue?.id || 0), teams }
}

export function TeamHistoryModal({ open, onClose, mode, party = emptyParty }: {
  open: boolean; onClose: () => void; mode: TeamHistoryMode; party?: ReadonlySet<string>
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [count, setCount] = useState(() => {
    const saved = store.get(mode === 'bp' ? 'champSelectAssistFetchCount' : 'gameAnalysisFetchCount')
    return [20, 50, 100].includes(saved) ? saved : 50
  })
  const [selectedQueue, setSelectedQueue] = useState<number | null>(null)
  const [target, setTarget] = useState<{ puuid: string; name: string } | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<HistoryMatch | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const scrollTargets = useMemo(()=>[bodyRef],[])
  const hidden = useHistoryHiddenFields()
  useEffect(() => {
    if (!open) { setTarget(null); setSelectedMatch(null); setShowSettings(false); setSelectedQueue(null); return }
    const controller = new AbortController()
    let previous = ''
    const update = (next: Snapshot) => {
      if (controller.signal.aborted) return
      const serialized = JSON.stringify(next)
      if (serialized === previous) return
      previous = serialized; setSnapshot(next); setError('')
    }
    setSnapshot(null); setError('')
    let receivedEvent = false
    let latestChampSelect: ChampSelectSession | null = null
    let fallbackQueueId = 0
    let queueLoaded = false
    const updateChampSelect = (session: ChampSelectSession) => {
      latestChampSelect = session
      if (session.queueId > 0 || queueLoaded) update(bpSnapshot(session, party, fallbackQueueId))
    }
    const unsubscribe = mode === 'bp' ? lcu.observe(LcuEventUri.CHAMP_SELECT, (event) => {
      const data = event.data as ChampSelectSession | null
      if (Array.isArray(data?.myTeam)) { receivedEvent = true; updateChampSelect(data) }
    }) : undefined
    if (mode === 'bp') void deadline(() => lcu.getGameflowSession(), controller.signal, 10000).then((session) => {
      fallbackQueueId = session.gameData?.queue?.id || 0
    }).catch(() => {}).finally(() => {
      queueLoaded = true
      if (latestChampSelect) updateChampSelect(latestChampSelect)
    })
    const query = mode === 'bp'
      ? deadline(() => lcu.getChampSelectSession(), controller.signal, 10000).then((session) => { if (!receivedEvent) updateChampSelect(session) })
      : deadline(() => lcu.getGameflowSession(), controller.signal, 10000).then((session) => update(gameSnapshot(session)))
    void query.catch(() => { if (!controller.signal.aborted && !receivedEvent) setError('暂时读不到当前对局，请确认处于对应阶段后重试。') })
    return () => { controller.abort(); unsubscribe?.() }
  }, [open, mode, revision, party])
  const queueId = selectedQueue ?? snapshot?.queueId ?? 0
  const queues = getPlayableQueues().filter((queue) => queue.id > 0).map(({ id, name }) => ({ id, name }))
  if (snapshot && snapshot.queueId > 0 && !queues.some((queue) => queue.id === snapshot.queueId)) {
    queues.push({ id: snapshot.queueId, name: snapshot.queueName || getQueueName(snapshot.queueId) })
  }
  const playerCount = snapshot?.teams.reduce((total, team) => total + team.members.length, 0) ?? 0
  return <>
    <Modal open={open} onClose={onClose} width="min(1550px, 95vw)" height={mode === 'bp' ? 'min(560px, 92vh)' : 'min(900px, 92vh)'}>
      <div className="rh-shell rh-team-shell" data-testid={mode === 'bp' ? 'bp-history' : 'game-history'}>
        <header className="rh-header rh-team-heading">
          <h2>对局详情</h2>
          <div className="rh-team-controls">
            <select className="rh-team-mode" aria-label="队伍战绩范围" title={queues.find((queue) => queue.id === queueId)?.name || '全部模式'} value={queueId} onChange={(e) => setSelectedQueue(Number(e.target.value))}>
              <option value={0}>全部模式</option>
              {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}
            </select>
            <select className="rh-team-count" aria-label="队伍查询场次" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[20, 50, 100].map((n) => <option key={n} value={n}>每人 {n} 场</option>)}
            </select>
            <HistoryAssetTooltip title="刷新" compact asChild>
              <button type="button" className="rh-button rh-team-icon-button" aria-label="刷新" onClick={() => setRevision((n) => n + 1)}><span aria-hidden="true"><RefreshIcon /></span></button>
            </HistoryAssetTooltip>
            <HistoryAssetTooltip title="显示设置" compact asChild>
              <button type="button" className="rh-button rh-team-icon-button" aria-label="显示设置" onClick={() => setShowSettings(true)}><span aria-hidden="true"><SettingsIcon /></span></button>
            </HistoryAssetTooltip>
          </div>
        </header>
        <div className="rh-team-body rh-scroll-area" ref={bodyRef}>
          {error ? <div className="rh-error" role="alert">{error}<button type="button" onClick={() => setRevision((n) => n + 1)}>重试</button></div> : !snapshot ? <div className="rh-empty"><span className="rh-spinner" />读取当前对局…</div> : !playerCount ? <div className="rh-empty">客户端还未提供参赛者信息，可稍后刷新。</div> :
            <div className="rh-team-groups">
              {snapshot.teams.map((team) => (
                <TeamSection key={team.id} team={team} queueId={queueId} count={count} open={open} hidden={hidden}
                  onInspect={(puuid, name) => setTarget({ puuid, name })} onMatch={setSelectedMatch} />
              ))}
            </div>}
        </div>
        <HistoryScrollTop targets={scrollTargets} resetKey={`${open}:${mode}:${revision}`} />
      </div>
    </Modal>
    <HistoryDisplaySettings open={open && showSettings} onClose={() => setShowSettings(false)} initialSection="team" />
    <Modal open={Boolean(open && selectedMatch)} onClose={() => setSelectedMatch(null)} width="min(1200px, 95vw)" height="min(720px, 88vh)">
      {selectedMatch && (
        <div className="rh-shell rh-team-match-detail">
          <h2>{getQueueName(selectedMatch.game.json.queueId)} · 单场战报</h2>
          <MatchReport game={selectedMatch.game} focusPuuid={selectedMatch.player.puuid}
            onInspect={(puuid, name) => setTarget({ puuid, name })} />
        </div>
      )}
    </Modal>
    <PlayerHistoryModal open={Boolean(open && target)} puuid={target?.puuid || ''} playerName={target?.name || ''} queueId={queueId} onClose={() => setTarget(null)} />
  </>
}

function TeamSection({ team, queueId, count, open, hidden, onInspect, onMatch }: {
  team: Team; queueId: number; count: number; open: boolean; hidden: HistoryHiddenFields
  onInspect: (puuid: string, name: string) => void; onMatch: (match: HistoryMatch) => void
}) {
  const [summaries, setSummaries] = useState<Record<string, PlayerSummary>>({})
  const updateSummary = useCallback((key: string, stats: PlayerSummary | null) => {
    setSummaries((previous) => {
      if (stats) return { ...previous, [key]: stats }
      if (!(key in previous)) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }, [])
  const groups = new Map<number, number>()
  for (const player of team.members) {
    if (player.premade && player.premade > 0) groups.set(player.premade, (groups.get(player.premade) || 0) + 1)
  }
  const parties = [...groups].filter(([, size]) => size >= 2).map(([id]) => id)
  const available = team.members.flatMap((member) => summaries[member.key] ? [summaries[member.key]] : [])
  const winRate = mean(available.map((summary) => summary.winRate))
  const kda = mean(available.map((summary) => summary.kda))
  const showSummary = isHistoryFieldVisible(hidden, 'team', 'teamSummary')
  return (
    <section className={`rh-team-group rh-team-${team.id}`}>
      <h3>
        <span className="rh-team-dot" aria-hidden="true" />{team.label}
        {showSummary && winRate != null && <HistoryAssetTooltip title="队伍平均胜率" compact focusable={false} asChild><strong>{percentText(winRate)}</strong></HistoryAssetTooltip>}
        {showSummary && kda != null && <HistoryAssetTooltip title="队伍平均 KDA" compact focusable={false} asChild><small>{numberText(kda, 2)} KDA</small></HistoryAssetTooltip>}
        <small className="rh-team-sample">{available.length}/{team.members.length} 人有数据</small>
      </h3>
      <div className="rh-team-cards">
        {team.members.map((member) => {
          const party = member.premade ? parties.indexOf(member.premade) : -1
          return <TeamPlayerCard key={member.key} member={member} queueId={queueId} count={count} open={open} hidden={hidden}
            premade={party >= 0 ? String.fromCharCode(65 + party) : undefined}
            onInspect={(name) => onInspect(member.puuid, name)} onMatch={onMatch} updateSummary={updateSummary} />
        })}
      </div>
    </section>
  )
}

function TeamPlayerCard({ member, queueId, count, open, hidden, premade, onInspect, onMatch, updateSummary }: {
  member: Member; queueId: number; count: number; open: boolean; hidden: HistoryHiddenFields; premade?: string
  onInspect: (name: string) => void; onMatch: (match: HistoryMatch) => void
  updateSummary: (key: string, stats: PlayerSummary | null) => void
}) {
  const [profile, setProfile] = useState<SummonerInfo | null>(null)
  const [ranks, setRanks] = useState<HistoryRank[] | null>(null)
  const [rankLoading, setRankLoading] = useState(true)
  const [championFilter, setChampionFilter] = useState(0)
  const recentRef = useRef<HTMLDivElement | null>(null)
  const scoreSystem = usePlayerScoreSystem()
  const pages = useHistoryPages(member.puuid, queueId, count, open)
  useEffect(() => {
    if (!open || !member.puuid) return
    const controller = new AbortController()
    setProfile(null); setRanks(null); setRankLoading(true)
    void fetchHistorySummoner(member.puuid, controller.signal).then((value) => { if (!controller.signal.aborted) setProfile(value) }).catch(() => {})
    void fetchHistoryRanks(member.puuid, controller.signal).then((value) => { if (!controller.signal.aborted) setRanks(value) }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setRankLoading(false) })
    return () => controller.abort()
  }, [open, member.puuid])
  const matches = useMemo(() => toHistoryMatches(pages.games, member.puuid).filter((m) => !queueId || m.game.json.queueId === queueId), [pages.games, member.puuid, queueId])
  const allValid = useMemo(() => validMatches(matches), [matches])
  const selectedMatches = useMemo(()=>championFilter ? matches.filter((match)=>match.player.championId===championFilter) : matches,[matches,championFilter])
  const allStats = useMemo(() => summarize(matches), [matches])
  const stats = useMemo(() => summarize(selectedMatches), [selectedMatches])
  const valid = useMemo(() => validMatches(selectedMatches), [selectedMatches])
  useEffect(()=>recentRef.current ? bindScrollbarHighlight(recentRef.current) : undefined,[pages.loading,stats.total,hidden])
  useEffect(()=>{ setChampionFilter(0) },[queueId,member.puuid])
  useEffect(()=>{
    if (!pages.loading && championFilter && !allValid.some((match)=>match.player.championId===championFilter)) setChampionFilter(0)
  },[allValid,pages.loading,championFilter])
  useEffect(()=>{ if (recentRef.current) recentRef.current.scrollTop=0 },[championFilter])
  useEffect(() => {
    if (!open || !allStats.total) return
    updateSummary(member.key, allStats)
    return () => updateSummary(member.key, null)
  }, [member.key, open, allStats, updateSummary])
  const score = useMemo(() => {
    try {
      const result = calculatePlayerScore(valid.map((match) => match.game), member.puuid, scoreSystem)
      return result && Number.isFinite(result.score) ? result.score : null
    } catch {
      return null
    }
  }, [valid, member.puuid, scoreSystem])
  const name = profile?.gameName ? `${profile.gameName}${profile.tagLine ? `#${profile.tagLine}` : ''}` : member.name
  const partyColor = premade ? premadeColors[premade.charCodeAt(0) - 65] : undefined
  const show = (field: HistoryDisplayField<'team'>) => isHistoryFieldVisible(hidden, 'team', field)
  const portraitChampion = show('selection') && member.championId > 0 ? member.championId : 0
  const tags = ([
    { field: 'streak', text: stats.streak.replace(' ', ''), tone: stats.streak.includes('连胜') ? 'green' : 'red' },
    { field: 'participation', text: stats.participation == null ? '' : `参团 ${percentText(stats.participation)}`, tone: 'blue' },
    { field: 'damage', text: stats.damageShare == null ? '' : `伤害 ${percentText(stats.damageShare)}`, tone: 'red' },
    { field: 'taken', text: stats.takenShare == null ? '' : `承伤 ${percentText(stats.takenShare)}`, tone: 'purple' },
    { field: 'gold', text: stats.goldShare == null ? '' : `经济 ${percentText(stats.goldShare)}`, tone: 'gold' },
    { field: 'score', text: score == null ? '' : `${playerScoreName(scoreSystem)} ${formatPlayerScore(score,scoreSystem)}`, tone: 'purple' },
  ] as const).filter(({ field, text }) => text && show(field))
  return (
    <article className={`rh-team-card${member.self ? ' is-self' : ''}`} data-sona-premade={premade || undefined}
      style={partyColor ? {borderColor:partyColor,'--rh-premade-glow':`${partyColor}35`} as CSSProperties : undefined}>
      <button type="button" className="rh-team-card-head" aria-label={`查看 ${name} 的战绩`} disabled={!member.puuid} onClick={() => onInspect(name)}>
        <span className="rh-team-portrait">
          <HistoryImage src={portraitChampion ? getChampIcon(portraitChampion) : profileIconUrl(profile?.profileIconId ?? valid[0]?.player.profileIcon)} label={portraitChampion ? championName(portraitChampion) : name} nativeTooltip={Boolean(portraitChampion)} />
          {profile?.summonerLevel && <small>{profile.summonerLevel}</small>}
        </span>
        <span className="rh-team-identity">
          <strong><HistoryPlayerName name={name} showTag color={partyColor} /></strong>
          {show('ranks') && <span className="rh-team-ranks">
            {ranks?.map((rank) => {
              const queueName = rank.key === 'RANKED_SOLO_5x5' ? '单双排' : '灵活组排'
              const lp = rank.lp != null && rank.tier !== 'UNRANKED' ? `${rank.lp} LP` : '—'
              const description = [queueName, rankText(rank), lp !== '—' && lp].filter(Boolean).join(' · ')
              return (
                <HistoryAssetTooltip key={rank.key} title={description} compact focusable={false} asChild><span className="rh-team-rank-row" aria-label={description}>
                  <HistoryImage src={getRankedMiniCrest(rank.tier)} label={description} className={`rh-team-rank-icon rh-team-rank-icon-${rank.tier.toLowerCase()}`} nativeTooltip={false} />
                  <span className="rh-team-rank-lp">{lp}</span>
                </span></HistoryAssetTooltip>
              )
            }) ?? (rankLoading && member.puuid ? '段位查询中…' : '段位暂不可用')}
          </span>}
          {show('selection') && (member.position || member.self || premade) && <span className="rh-team-selection">
            {member.position && <span>{member.position}</span>}
            {member.self && <b>自己</b>}
            {premade && <b>组队 {premade}</b>}
          </span>}
        </span>
      </button>
      {!member.puuid ? <div className="rh-card-state">玩家身份暂不可查询</div>
        : pages.loading ? <div className="rh-card-state"><span className="rh-spinner" />查询中…</div>
        : pages.error ? <div className="rh-card-state">战绩查询失败<button type="button" className="rh-text-button" onClick={pages.refresh}>重试</button></div>
        : stats.total === 0 ? <div className="rh-card-state">本范围暂无有效记录</div>
        : <>
          {(show('winRate') || show('kda')) && <div className="rh-team-card-stats">
            {show('winRate') && <strong className={(stats.winRate ?? 0) >= 0.5 ? 'rh-team-positive' : 'rh-team-negative'}>
              {percentText(stats.winRate)} <small>({stats.total})</small>
            </strong>}
            {show('kda') && <strong>{numberText(stats.kda, 2)} <small>KDA</small></strong>}
          </div>}
          <div className="rh-team-tags">
            {tags.map(({ field, text, tone }) => (
              <HistoryAssetTooltip key={field} title={field==='score' ? `${playerScoreLabel(scoreSystem)} · ${playerScoreRange(scoreSystem)} 分` : text} compact focusable={false} asChild><span className={`rh-team-tag rh-team-tag-${tone}`} data-score-system={field==='score'?scoreSystem:undefined}>{text}</span></HistoryAssetTooltip>
            ))}
            <HistoryPerformanceStats matches={valid} section="team" />
          </div>
          {show('champions') && <ChampionStrip matches={allValid} limit={9} selectedId={championFilter} onSelect={(id)=>setChampionFilter((current)=>current===id?0:id)} />}
          {show('recent') && <div className="rh-team-recent-list rh-scroll-area" aria-label="最近对局" ref={recentRef}>
            {valid.slice(0, 8).map((match) => (
              <button type="button" className={`rh-team-match rh-team-match-${match.outcome}`} key={match.id}
                aria-label="打开这场对局的详细战报" onClick={() => onMatch(match)}>
                <HistoryImage src={getChampIcon(match.player.championId)} label={championName(match.player.championId)} />
                <span>
                  <strong>{getQueueName(match.game.json.queueId)}</strong>
                  <small>{Number.isFinite(match.game.json.gameCreation) ? recentMatchDate.format(match.game.json.gameCreation) : '时间未知'} · {match.outcome === 'win' ? '胜' : '负'}</small>
                </span>
                <b>{numberText(match.player.kills)} / {numberText(match.player.deaths)} / {numberText(match.player.assists)}</b>
              </button>
            ))}
          </div>}
          {pages.source === 'lcu' && <small className="rh-card-note">备用战绩{pages.scanLimit ? ` · 最近 ${pages.scanLimit} 场内` : ''}</small>}
        </>}
    </article>
  )
}
