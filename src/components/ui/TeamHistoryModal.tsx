import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { PlayerHistoryModal } from './PlayerHistoryModal'
import { ChampionStrip, HistoryImage, MatchReport, championName } from './HistoryWidgets'
import { HistoryDisplaySettings } from './HistoryDisplaySettings'
import { HistoryPlayerName } from './HistoryPlayerName'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { lcu, LcuEventUri } from '@/lib/lcu'
import { store } from '@/lib/store'
import { deobfuscateChampSelectPuuid } from '@/lib/champ-select-puuid'
import { getChampIcon, getPlayableQueues, getQueueName } from '@/lib/assets'
import { getRankedMiniCrest } from '@/lib/ranked-assets'
import { deadline, fetchHistoryRanks, fetchHistorySummoner, rankText, type HistoryRank } from '@/lib/history-api'
import { mean, numberText, percentText, POSITION_NAMES, profileIconUrl, summarize, toHistoryMatches, validMatches, type HistoryMatch } from '@/lib/history-model'
import { calculateSonaPlayerStrengthScore } from '@/lib/player-strength-score'
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
const premadeColors = ['#d6b578', '#91b6d1', '#91bf9e', '#dca0a0', '#bca9d8']
const emptyParty = new Set<string>()

const positionName = (position: string) => POSITION_NAMES[({ MID: 'MIDDLE', BOT: 'BOTTOM', SUPPORT: 'UTILITY' } as Record<string, string>)[position.toUpperCase()] || position.toUpperCase()] || ''

function bpSnapshot(session: ChampSelectSession, party: ReadonlySet<string>): Snapshot {
  return { queueId: session.queueId || 0, queueName: getQueueName(session.queueId), teams: [{ id: 'ally', label: '己方队伍', members: (session.myTeam || []).slice(0, 5).map((p, index) => {
    const puuid = p.puuid || (p.nameVisibilityType === 'HIDDEN' && p.obfuscatedPuuid ? deobfuscateChampSelectPuuid(p.obfuscatedPuuid) : '')
    return { key: puuid || `slot-${p.cellId ?? index}`, puuid, name: p.gameName ? `${p.gameName}${p.tagLine ? `#${p.tagLine}` : ''}` : p.playerAlias || `${index + 1} 楼`, championId: p.championId || p.championPickIntent || 0, position: positionName(p.assignedPosition || ''), self: p.cellId === session.localPlayerCellId, premade: party.has(puuid) ? 1 : undefined }
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
  const [selectedQueue, setSelectedQueue] = useState(-1)
  const [target, setTarget] = useState<{ puuid: string; name: string } | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<HistoryMatch | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const hidden = useHistoryHiddenFields()
  useEffect(() => {
    if (!open) { setTarget(null); setSelectedMatch(null); setShowSettings(false); return }
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
    const unsubscribe = mode === 'bp' ? lcu.observe(LcuEventUri.CHAMP_SELECT, (event) => {
      const data = event.data as ChampSelectSession | null
      if (Array.isArray(data?.myTeam)) { receivedEvent = true; update(bpSnapshot(data, party)) }
    }) : undefined
    const query = mode === 'bp'
      ? deadline(() => lcu.getChampSelectSession(), controller.signal, 10000).then((session) => bpSnapshot(session, party))
      : deadline(() => lcu.getGameflowSession(), controller.signal, 10000).then(gameSnapshot)
    void query.then((value) => { if (!receivedEvent) update(value) }).catch(() => { if (!controller.signal.aborted && !receivedEvent) setError('暂时读不到当前对局，请确认处于对应阶段后重试。') })
    return () => { controller.abort(); unsubscribe?.() }
  }, [open, mode, revision, party])
  const queueId = selectedQueue < 0 ? snapshot?.queueId || 0 : selectedQueue
  const queues = getPlayableQueues().filter((queue) => queue.id > 0)
  const playerCount = snapshot?.teams.reduce((total, team) => total + team.members.length, 0) ?? 0
  return <>
    <Modal open={open} onClose={onClose} width="min(1550px, 95vw)" height={mode === 'bp' ? 'min(560px, 92vh)' : 'min(900px, 92vh)'}>
      <div className="rh-shell rh-team-shell" data-testid={mode === 'bp' ? 'bp-history' : 'game-history'}>
        <header className="rh-header rh-team-heading"><div><span className="rh-eyebrow">SONA · {mode === 'bp' ? '英雄选择阶段' : '进入游戏后'}</span><h2>{mode === 'bp' ? '对局信息' : '双方对局战绩总览'}</h2><span className="rh-muted">{snapshot?.queueName || '当前对局'}{playerCount > 0 ? ` · ${playerCount} 位玩家` : ''} · 点击玩家查看完整战绩</span></div>
          <div className="rh-team-controls">
            <select aria-label="队伍战绩范围" value={selectedQueue} onChange={(e) => setSelectedQueue(Number(e.target.value))}>
              <option value={-1}>本局模式</option><option value={0}>全部模式</option>
              {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}
            </select>
            <select aria-label="队伍查询场次" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[20, 50, 100].map((n) => <option key={n} value={n}>每人 {n} 场</option>)}
            </select>
            <button type="button" className="rh-button" onClick={() => setRevision((n) => n + 1)}>刷新</button>
            <button type="button" className="rh-button" onClick={() => setShowSettings(true)}>显示设置</button>
          </div>
        </header>
        <div className="rh-team-body">
          {error ? <div className="rh-error" role="alert">{error}<button type="button" onClick={() => setRevision((n) => n + 1)}>重试</button></div> : !snapshot ? <div className="rh-empty"><span className="rh-spinner" />读取当前对局…</div> : !playerCount ? <div className="rh-empty">客户端还未提供参赛者信息，可稍后刷新。</div> :
            <div className="rh-team-groups">
              {snapshot.teams.map((team) => (
                <TeamSection key={team.id} team={team} queueId={queueId} count={count} open={open} hidden={hidden}
                  onInspect={(puuid, name) => setTarget({ puuid, name })} onMatch={setSelectedMatch} />
              ))}
            </div>}
        </div>
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
  const stats = useMemo(() => summarize(matches), [matches])
  const valid = useMemo(() => validMatches(matches), [matches])
  useEffect(() => {
    if (!open || !stats.total) return
    updateSummary(member.key, stats)
    return () => updateSummary(member.key, null)
  }, [member.key, open, stats, updateSummary])
  const score = useMemo(() => {
    try {
      const result = calculateSonaPlayerStrengthScore(valid.map((match) => match.game), member.puuid)
      return result && Number.isFinite(result.score) ? result.score : null
    } catch {
      return null
    }
  }, [valid, member.puuid])
  const name = profile?.gameName ? `${profile.gameName}${profile.tagLine ? `#${profile.tagLine}` : ''}` : member.name
  const partyColor = premade ? premadeColors[premade.charCodeAt(0) - 65] : undefined
  const show = (field: HistoryDisplayField<'team'>) => isHistoryFieldVisible(hidden, 'team', field)
  const tags = ([
    { field: 'streak', text: stats.streak.replace(' ', ''), tone: stats.streak.includes('连胜') ? 'green' : 'red' },
    { field: 'participation', text: stats.participation == null ? '' : `参团 ${percentText(stats.participation)}`, tone: 'blue' },
    { field: 'damage', text: stats.damageShare == null ? '' : `伤害 ${percentText(stats.damageShare)}`, tone: 'red' },
    { field: 'taken', text: stats.takenShare == null ? '' : `承伤 ${percentText(stats.takenShare)}`, tone: 'purple' },
    { field: 'gold', text: stats.goldShare == null ? '' : `经济 ${percentText(stats.goldShare)}`, tone: 'gold' },
    { field: 'score', text: score == null ? '' : `Sona ${numberText(score, 1)}`, tone: 'purple' },
  ] as const).filter(({ field, text }) => text && show(field))
  return (
    <article className={`rh-team-card${member.self ? ' is-self' : ''}`}>
      <button type="button" className="rh-team-card-head" aria-label={`查看 ${name} 的战绩`} disabled={!member.puuid} onClick={() => onInspect(name)}>
        <span className="rh-team-portrait">
          <HistoryImage src={profileIconUrl(profile?.profileIconId ?? valid[0]?.player.profileIcon)} label={name} nativeTooltip={false} />
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
                  <span>{queueName}</span>
                  <HistoryImage src={getRankedMiniCrest(rank.tier)} label={description} className="rh-team-rank-icon" nativeTooltip={false} />
                  <span className="rh-team-rank-lp">{lp}</span>
                </span></HistoryAssetTooltip>
              )
            }) ?? (rankLoading && member.puuid ? '段位查询中…' : '段位暂不可用')}
          </span>}
        </span>
      </button>
      {show('selection') && <div className="rh-team-selection">
        {member.championId > 0 && <HistoryImage src={getChampIcon(member.championId)} label={championName(member.championId)} />}
        {member.position && <span>{member.position}</span>}
        {member.self && <b>自己</b>}
        {premade && <b>组队 {premade}</b>}
      </div>}
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
          {tags.length > 0 && <div className="rh-team-tags">
            {tags.map(({ text, tone }) => (
              <HistoryAssetTooltip key={text} title={text.startsWith('Sona') ? '近期对局综合评分 · 3–16 分' : text} compact focusable={false} asChild><span className={`rh-team-tag rh-team-tag-${tone}`}>{text}</span></HistoryAssetTooltip>
            ))}
          </div>}
          {show('champions') && <ChampionStrip matches={valid} limit={9} />}
          {show('recent') && <div className="rh-team-recent-list" aria-label="最近对局">
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
