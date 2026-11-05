import { useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { PlayerHistoryModal } from './PlayerHistoryModal'
import { ChampionStrip, HistoryImage, SummaryStats, championName } from './HistoryWidgets'
import { lcu, LcuEventUri } from '@/lib/lcu'
import { store } from '@/lib/store'
import { deobfuscateChampSelectPuuid } from '@/lib/champ-select-puuid'
import { getChampIcon, getQueueName } from '@/lib/assets'
import { deadline, fetchHistoryRanks, fetchHistorySummoner, rankText, type HistoryRank } from '@/lib/history-api'
import { numberText, percentText, POSITION_NAMES, summarize, toHistoryMatches } from '@/lib/history-model'
import { useHistoryPages } from '@/lib/use-history-pages'
import type { ChampSelectSession, GameflowSession, SummonerInfo } from '@/types/lcu'
import '@/styles/PersonalHistory.css'

export type TeamHistoryMode = 'bp' | 'game'
interface Member { key: string; puuid: string; name: string; championId: number; position: string; premade?: number; self?: boolean }
interface Team { id: string; label: string; members: Member[] }
interface Snapshot { queueId: number; queueName: string; teams: Team[] }

const positionName = (position: string) => POSITION_NAMES[({ MID: 'MIDDLE', BOT: 'BOTTOM', SUPPORT: 'UTILITY' } as Record<string, string>)[position.toUpperCase()] || position.toUpperCase()] || ''

function bpSnapshot(session: ChampSelectSession): Snapshot {
  return { queueId: session.queueId || 0, queueName: getQueueName(session.queueId), teams: [{ id: 'ally', label: '己方队伍', members: (session.myTeam || []).slice(0, 5).map((p, index) => {
    const puuid = p.puuid || (p.nameVisibilityType === 'HIDDEN' && p.obfuscatedPuuid ? deobfuscateChampSelectPuuid(p.obfuscatedPuuid) : '')
    return { key: puuid || `slot-${p.cellId ?? index}`, puuid, name: p.gameName ? `${p.gameName}${p.tagLine ? `#${p.tagLine}` : ''}` : p.playerAlias || `${index + 1} 楼`, championId: p.championId || p.championPickIntent || 0, position: positionName(p.assignedPosition || ''), self: p.cellId === session.localPlayerCellId }
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

export function TeamHistoryModal({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: TeamHistoryMode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [count, setCount] = useState(() => {
    const saved = store.get(mode === 'bp' ? 'champSelectAssistFetchCount' : 'gameAnalysisFetchCount')
    return [20, 50, 100].includes(saved) ? saved : 50
  })
  const [allModes, setAllModes] = useState(false)
  const [expanded, setExpanded] = useState(mode === 'bp')
  const [target, setTarget] = useState<{ puuid: string; name: string } | null>(null)
  useEffect(() => {
    if (!open) { setTarget(null); return }
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
      if (Array.isArray(data?.myTeam)) { receivedEvent = true; update(bpSnapshot(data)) }
    }) : undefined
    const query = mode === 'bp'
      ? deadline(() => lcu.getChampSelectSession(), controller.signal, 10000).then(bpSnapshot)
      : deadline(() => lcu.getGameflowSession(), controller.signal, 10000).then(gameSnapshot)
    void query.then((value) => { if (!receivedEvent) update(value) }).catch(() => { if (!controller.signal.aborted && !receivedEvent) setError('暂时读不到当前对局，请确认处于对应阶段后重试。') })
    return () => { controller.abort(); unsubscribe?.() }
  }, [open, mode, revision])
  const queueId = allModes ? 0 : snapshot?.queueId || 0
  const playerCount = snapshot?.teams.reduce((total, team) => total + team.members.length, 0) ?? 0
  return <>
    <Modal open={open} onClose={onClose} width="min(1320px, 95vw)" height={mode === 'bp' ? 'min(525px, 92vh)' : 'min(830px, 92vh)'}>
      <div className="rh-shell rh-team-shell" data-testid={mode === 'bp' ? 'bp-history' : 'game-history'}>
        <header className="rh-header rh-team-heading"><div><span className="rh-eyebrow">SONA · {mode === 'bp' ? '英雄选择阶段' : '进入游戏后'}</span><h2>{mode === 'bp' ? '己方五人战绩总览' : '双方对局战绩总览'}</h2><span className="rh-muted">{snapshot?.queueName || '当前对局'}{playerCount > 0 ? ` · ${playerCount} 位玩家` : ''} · 点击玩家查看完整战绩</span></div>
          <div className="rh-team-controls"><select aria-label="队伍战绩范围" value={allModes ? 'all' : 'queue'} onChange={(e) => setAllModes(e.target.value === 'all')}><option value="queue">本局模式</option><option value="all">全部模式</option></select><select aria-label="队伍查询场次" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[20, 50, 100].map((n) => <option key={n} value={n}>每人 {n} 场</option>)}</select><button type="button" className="rh-button" onClick={() => setExpanded(!expanded)}>{expanded ? '紧凑显示' : '详细显示'}</button><button type="button" className="rh-button" onClick={() => setRevision((n) => n + 1)}>刷新</button></div>
        </header>
        <div className="rh-team-body">
          {error ? <div className="rh-error" role="alert">{error}<button type="button" onClick={() => setRevision((n) => n + 1)}>重试</button></div> : !snapshot ? <div className="rh-empty"><span className="rh-spinner" />读取当前对局…</div> : !playerCount ? <div className="rh-empty">客户端还未提供参赛者信息，可稍后刷新。</div> :
            <div className={`rh-team-groups rh-team-groups-${mode}`}>{snapshot.teams.map((team) => {
              const groups = new Map<number, number>()
              for (const p of team.members) if (p.premade && p.premade > 0) groups.set(p.premade, (groups.get(p.premade) || 0) + 1)
              const parties = [...groups].filter(([, size]) => size >= 2).map(([id]) => id)
              return <section key={team.id} className={`rh-team-group rh-team-${team.id}`}><h3>{team.label}<small>{team.members.length} 人</small></h3><div className="rh-team-cards">{team.members.map((member) => <TeamPlayerCard key={member.key} member={member} queueId={queueId} count={count} open={open} expanded={expanded} premade={member.premade && parties.includes(member.premade) ? String.fromCharCode(65 + parties.indexOf(member.premade)) : undefined} onInspect={(name) => setTarget({ puuid: member.puuid, name })} />)}</div></section>
            })}</div>}
        </div><footer className="rh-team-footer">每位玩家独立加载。样本数按实际返回计算；当前模式无记录时，可切换到全部模式。近况仅供参考。</footer>
      </div>
    </Modal>
    <PlayerHistoryModal open={Boolean(open && target)} puuid={target?.puuid || ''} playerName={target?.name || ''} queueId={queueId} onClose={() => setTarget(null)} />
  </>
}

function TeamPlayerCard({ member, queueId, count, open, expanded, premade, onInspect }: { member: Member; queueId: number; count: number; open: boolean; expanded: boolean; premade?: string; onInspect: (name: string) => void }) {
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
  const name = profile?.gameName ? `${profile.gameName}${profile.tagLine ? `#${profile.tagLine}` : ''}` : member.name
  const rank = ranks?.find((r) => r.key === (queueId === 440 ? 'RANKED_FLEX_SR' : 'RANKED_SOLO_5x5'))
  return <article className={`rh-team-card${member.self ? ' is-self' : ''}`}>
    <button type="button" className="rh-team-card-head" title="打开个人详细战绩" disabled={!member.puuid} onClick={() => onInspect(name)}><HistoryImage src={member.championId > 0 ? getChampIcon(member.championId) : profile ? `/lol-game-data/assets/v1/profile-icons/${profile.profileIconId}.jpg` : undefined} label={member.championId > 0 ? championName(member.championId) : name} /><span><strong>{name}</strong><small>{[member.position, rank ? `${rank.label} ${rankText(rank)}` : rankLoading && member.puuid ? '段位查询中…' : '段位暂不可用', profile ? `${profile.summonerLevel} 级` : ''].filter(Boolean).join(' · ')}</small></span>{member.self && <b>自己</b>}{premade && <b title="客户端提供的预组队标识">组队 {premade}</b>}</button>
    {!member.puuid ? <div className="rh-card-state">玩家身份暂不可查询</div> : pages.loading ? <div className="rh-card-state"><span className="rh-spinner" />查询中…</div> : pages.error ? <div className="rh-card-state">战绩查询失败<button type="button" className="rh-text-button" onClick={pages.refresh}>重试</button></div> : <>
      <div className="rh-team-card-stats"><strong>{percentText(stats.winRate)} <small>胜率</small></strong><strong>{numberText(stats.kda, 2)} <small>KDA</small></strong><span>{stats.total} 场有效 · {stats.wins} 胜 {stats.losses} 负</span></div>
      {pages.source === 'lcu' && <small className="rh-card-note" title="客户端备用接口可能缺少部分对局和字段">备用战绩{pages.scanLimit ? ` · 最近 ${pages.scanLimit} 场内` : ''}</small>}
      {stats.total > 0 && <><div className="rh-team-recent"><span>常玩英雄</span><ChampionStrip matches={matches} limit={4} /></div>{expanded && <><SummaryStats matches={matches} compact /><div className="rh-team-recent"><span>最近对局</span><div className="rh-recent-dots">{matches.filter((m) => m.outcome === 'win' || m.outcome === 'loss').slice(0, 8).map((m) => <span key={m.id} className={`rh-recent-${m.outcome}`} title={`${championName(m.player.championId)} · ${m.outcome === 'win' ? '胜' : '负'} · ${m.player.kills}/${m.player.deaths}/${m.player.assists}`} />)}</div></div></>}</>}
      {stats.total === 0 && <div className="rh-card-state">本范围暂无有效记录</div>}
    </>}
  </article>
}
