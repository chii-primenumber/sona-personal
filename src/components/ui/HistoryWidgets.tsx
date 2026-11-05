import { useState } from 'react'
import { getChampIcon, getChampionById, getItemInfo, getSpellInfo, getPerkInfo, getPerkStyleIcon, getAugmentInfo, getQueueName, getMapName } from '@/lib/assets'
import { championStats, durationText, finite, getOutcome, getPosition, matchBadges, metric, numberText, percentText, POSITION_NAMES, riotName, share, summarize, teamKey, type HistoryMatch } from '@/lib/history-model'
import { rankText, type HistoryRank } from '@/lib/history-api'
import type { SgpGameSummaryLol, SgpParticipantLol } from '@/types/sgp'

export function HistoryImage({ src, label, className = '' }: { src?: string; label: string; className?: string }) {
  const [failed, setFailed] = useState('')
  return src && failed !== src
    ? <img src={src} alt={label} title={label} className={className} loading="lazy" onError={() => setFailed(src)} />
    : <span className={`rh-image-fallback ${className}`} title={label}>{label.slice(0, 1) || '?'}</span>
}

export function championName(id: number): string {
  const champion = getChampionById(id)
  return champion ? `${champion.title} · ${champion.name}` : `英雄 ${id}`
}

export function RankCards({ ranks, status }: { ranks: HistoryRank[] | null; status: string }) {
  return <div className="rh-ranks">{(ranks || [
    { key: 'solo', label: '单双排位', tier: '', division: '', lp: null, wins: null, losses: null },
    { key: 'flex', label: '灵活排位', tier: '', division: '', lp: null, wins: null, losses: null },
  ]).map((rank) => <div className="rh-rank-card" key={rank.key}>
    <span className="rh-muted">{rank.label} · 当前段位</span>
    <strong className={`rh-rank-${rank.tier.toLowerCase()}`}>{ranks ? rankText(rank) : status}</strong>
    {ranks && rank.tier !== 'UNRANKED' && <small>{numberText(rank.lp)} LP · {numberText(rank.wins)} 胜 {numberText(rank.losses)} 负</small>}
  </div>)}</div>
}

export function SummaryStats({ matches, compact = false }: { matches: HistoryMatch[]; compact?: boolean }) {
  const s = summarize(matches)
  const metrics: Array<[string, string, string?]> = [
    ['胜负', s.total ? `${s.wins} 胜 ${s.losses} 负 · ${percentText(s.winRate)}` : '暂无有效对局'],
    ['平均 KDA', numberText(s.kda, 2), '逐场 (击杀 + 助攻) ÷ max(死亡, 1)，再求平均'],
    ['参团率', percentText(s.participation), '逐场 (击杀 + 助攻) ÷ 队伍击杀，再求平均'],
    ['伤害占比', percentText(s.damageShare), '对英雄伤害占本队总量的逐场平均'],
    ['承伤占比', percentText(s.takenShare), '承受伤害占本队总量的逐场平均'],
    ['经济占比', percentText(s.goldShare), '获得金币占本队总量的逐场平均'],
    ['补刀 / 分', numberText(s.csPerMinute, 1)],
    ...(!compact ? [
      ['场均伤害', numberText(s.damage)], ['场均承伤', numberText(s.taken)], ['场均经济', numberText(s.gold)],
      ['场均视野', numberText(s.vision, 1)], ['场均友方治疗', numberText(s.healing)], ['场均友方护盾', numberText(s.shielding)],
    ] as Array<[string, string]> : []),
  ]
  return <dl className={`rh-stats ${compact ? 'rh-stats-compact' : ''}`}>{metrics.map(([label, value, hint]) => <div key={label} title={hint}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

export function ChampionStrip({ matches, onSelect, limit = 5 }: { matches: HistoryMatch[]; onSelect?: (id: number) => void; limit?: number }) {
  return <div className="rh-champion-strip">{championStats(matches).slice(0, limit).map((item) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)} title={`${championName(item.id)} · ${item.total} 场 · 胜率 ${percentText(item.winRate)}`} disabled={!onSelect}>
    <HistoryImage src={getChampIcon(item.id)} label={championName(item.id)} /><span>{item.total}</span>
  </button>)}</div>
}

export function Equipment({ player, dense = false }: { player: SgpParticipantLol; dense?: boolean }) {
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6]
  return <div className={`rh-equipment ${dense ? 'rh-equipment-dense' : ''}`}>{items.map((id, index) => {
    const info = id > 0 ? getItemInfo(id) : null
    return <span className="rh-item-slot" key={index}>{info && <HistoryImage src={info.iconPath} label={`${info.name || `装备 ${id}`}${info.description ? `\n${info.description}` : ''}`} />}</span>
  })}</div>
}

export function RunesAndSpells({ player }: { player: SgpParticipantLol }) {
  const keystone = player.perks?.styles?.[0]?.selections?.[0]?.perk
  const secondary = player.perks?.styles?.[1]?.style
  const spells = [player.spell1Id, player.spell2Id].filter((id) => id > 0)
  return <div className="rh-runes-spells">{spells.map((id, index) => { const info = getSpellInfo(id); return <HistoryImage key={`spell-${index}`} src={info.iconPath} label={`${info.name || `技能 ${id}`}\n${info.description}`} /> })}
    {keystone ? <HistoryImage src={getPerkInfo(keystone).iconPath} label={getPerkInfo(keystone).name || `符文 ${keystone}`} /> : null}
    {secondary ? <HistoryImage src={getPerkStyleIcon(secondary)} label="副系符文" /> : null}
  </div>
}

export function Augments({ player, detailed = false }: { player: SgpParticipantLol; detailed?: boolean }) {
  const ids = [player.playerAugment1, player.playerAugment2, player.playerAugment3, player.playerAugment4, player.playerAugment5, player.playerAugment6].filter((id) => id > 0)
  if (!ids.length) return null
  return <div className="rh-augments">{ids.map((id, index) => { const info = getAugmentInfo(id); return <span key={`${id}-${index}`} title={`${info?.name || `海克斯 ${id}`}\n${info?.description || '名称或说明暂不可用'}`}>
    <HistoryImage src={info?.iconPath} label={info?.name || `海克斯 ${id}`} />{detailed && <small>{info?.name || `海克斯 ${id}`}</small>}
  </span> })}</div>
}

function MiniRoster({ game, onInspect }: { game: SgpGameSummaryLol; onInspect?: (puuid: string, name: string) => void }) {
  const groups = new Map<number, SgpParticipantLol[]>()
  game.json.participants.forEach((p) => { const key = teamKey(p, game); const group = groups.get(key) || []; group.push(p); groups.set(key, group) })
  return <div className="rh-mini-roster">{[...groups].map(([key, players]) => <div key={key}>{players.map((p, index) => <button type="button" key={p.puuid || index} title={riotName(p)} disabled={!p.puuid || !onInspect} onClick={() => onInspect?.(p.puuid, riotName(p))}>
    <HistoryImage src={getChampIcon(p.championId)} label={championName(p.championId)} /><span>{riotName(p)}</span>
  </button>)}</div>)}</div>
}

export function MatchReport({ game, focusPuuid, onInspect }: { game: SgpGameSummaryLol; focusPuuid: string; onInspect?: (puuid: string, name: string) => void }) {
  const [view, setView] = useState<'combat' | 'support'>('combat')
  const groups = new Map<number, SgpParticipantLol[]>()
  game.json.participants.forEach((p) => { const key = teamKey(p, game); const group = groups.get(key) || []; group.push(p); groups.set(key, group) })
  return <div className="rh-report">
    <div className="rh-report-toolbar"><strong>{game.json.participants.length} 人详细战报</strong><span>本场数据 · 版本 {game.json.gameVersion || '未知'}</span><div className="rh-segment"><button type="button" className={view === 'combat' ? 'is-active' : ''} onClick={() => setView('combat')}>战斗与经济</button><button type="button" className={view === 'support' ? 'is-active' : ''} onClick={() => setView('support')}>治疗、控制与视野</button></div></div>
    <div className="rh-table-scroll"><table className="rh-report-table"><thead><tr><th>玩家 / 英雄</th><th>K / D / A</th><th>装备 / 符文 / 海克斯</th>{(view === 'combat' ? ['伤害 / 占比', '承伤 / 占比', '经济 / 占比', '补刀 / 分', '参团率'] : ['治疗自身及友方', '友方治疗 / 护盾', '控制 / 秒', '视野 / 插眼 / 排眼', '目标 / 防御塔伤害']).map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {[...groups].map(([key, players]) => {
        const kills = players.map((p) => finite(p.kills)).reduce<number>((sum, v) => sum + (v || 0), 0)
        const totalGold = players.reduce((sum, p) => sum + (finite(p.goldEarned) || 0), 0)
        const objective = game.json.teams?.find((t) => t.teamId === key)?.objectives
        const result = getOutcome(game, players[0])
        return <TeamReportRows key={key} players={players} label={`${game.json.gameMode === 'CHERRY' ? `小队 ${key}` : key === 100 ? '蓝色方' : key === 200 ? '红色方' : `队伍 ${key}`} · ${result === 'win' ? '胜利' : result === 'loss' ? '失败' : result === 'remake' ? '重开' : '终止 / 未知'} · ${kills} 击杀 · ${numberText(totalGold)} 金币${objective ? ` · 推塔 ${objective.tower?.kills ?? '—'} · 小龙 ${objective.dragon?.kills ?? '—'} · 大龙 ${objective.baron?.kills ?? '—'}` : ''}`} game={game} focusPuuid={focusPuuid} onInspect={onInspect} view={view} />
      })}
    </tbody></table></div>
    <p className="rh-footnote">占比以本场本队总量计算。— 表示接口未提供或分母不足；标签只描述本场队内数据，不推断玩家实力。</p>
  </div>
}

function TeamReportRows({ players, label, game, focusPuuid, onInspect, view }: { players: SgpParticipantLol[]; label: string; game: SgpGameSummaryLol; focusPuuid: string; onInspect?: (puuid: string, name: string) => void; view: 'combat' | 'support' }) {
  return <><tr className="rh-team-divider"><td colSpan={8}>{label}</td></tr>{players.map((p, index) => {
    const duration = game.json.gameDuration / 60
    const cs = finite(p.totalMinionsKilled) != null && finite(p.neutralMinionsKilled) != null ? p.totalMinionsKilled + p.neutralMinionsKilled : null
    const allKills = players.map((candidate) => finite(candidate.kills))
    const teamKills = allKills.every((value) => value != null) ? allKills.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null
    return <tr key={p.puuid || index} className={p.puuid === focusPuuid ? 'is-focus' : ''}>
      <td><button type="button" className="rh-player-link" disabled={!p.puuid || !onInspect} onClick={() => onInspect?.(p.puuid, riotName(p))}><HistoryImage src={getChampIcon(p.championId)} label={championName(p.championId)} /><span><strong>{riotName(p)}</strong><small>{championName(p.championId)} · {POSITION_NAMES[getPosition(p, game)]}</small></span></button></td>
      <td><strong>{numberText(finite(p.kills))} / <em>{numberText(finite(p.deaths))}</em> / {numberText(finite(p.assists))}</strong></td>
      <td><Equipment player={p} dense /><div className="rh-report-loadout"><RunesAndSpells player={p} /><Augments player={p} /></div></td>
      {view === 'combat' ? <>
        <td>{numberText(metric(p, 'totalDamageDealtToChampions', game))}<small>{percentText(share(p, 'totalDamageDealtToChampions', game))}</small></td>
        <td>{numberText(metric(p, 'totalDamageTaken', game))}<small>{percentText(share(p, 'totalDamageTaken', game))}</small></td>
        <td>{numberText(metric(p, 'goldEarned', game))}<small>{percentText(share(p, 'goldEarned', game))}</small></td>
        <td>{numberText(cs)}<small>{numberText(cs != null && duration > 0 ? cs / duration : null, 1)} / 分</small></td>
        <td>{percentText(teamKills != null && teamKills > 0 && finite(p.kills) != null && finite(p.assists) != null ? Math.min(1, (p.kills + p.assists) / teamKills) : teamKills === 0 ? 0 : null)}</td>
      </> : <>
        <td>{numberText(metric(p, 'totalHeal', game))}</td>
        <td>{numberText(metric(p, 'totalHealsOnTeammates', game))}<small>护盾 {numberText(metric(p, 'totalDamageShieldedOnTeammates', game))}</small></td>
        <td>{numberText(metric(p, 'timeCCingOthers', game), 1)}</td>
        <td>{numberText(metric(p, 'visionScore', game))}<small>{numberText(metric(p, 'wardsPlaced', game))} / {numberText(metric(p, 'wardsKilled', game))}</small></td>
        <td>{numberText(metric(p, 'damageDealtToObjectives', game))}<small>推塔 {numberText(metric(p, 'damageDealtToTurrets', game))}</small></td>
      </>}
    </tr>
  })}</>
}

export function HistoryMatchCard({ match, onInspect }: { match: HistoryMatch; onInspect?: (puuid: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { game, player, outcome } = match
  const badges = matchBadges(match)
  const date = new Date(game.json.gameCreation)
  const outcomeLabel = outcome === 'win' ? '胜利' : outcome === 'loss' ? (player.gameEndedInSurrender ? '投降' : '失败') : outcome === 'remake' ? '重开' : outcome === 'abort' ? '已终止' : '未知'
  const placement = finite(player.subteamPlacement) || finite(player.placement)
  return <article className={`rh-match rh-match-${outcome}`}>
    <div className="rh-match-main">
      <div className="rh-match-hero"><button type="button" title={`${championName(player.championId)} · 展开战报`} onClick={() => setExpanded(!expanded)}><HistoryImage src={getChampIcon(player.championId)} label={championName(player.championId)} /><small>{finite(player.champLevel) ?? '?'}</small></button><strong>{outcomeLabel}</strong>{game.json.gameMode === 'CHERRY' && placement && placement > 0 ? <small>第 {placement} 名</small> : null}</div>
      <div className="rh-match-info">
        <div className="rh-match-stats"><RunesAndSpells player={player} /><div><strong className="rh-kda">{numberText(finite(player.kills))} / <em>{numberText(finite(player.deaths))}</em> / {numberText(finite(player.assists))}</strong><small>KDA {numberText(match.kda, 2)} · 参团 {percentText(match.participation)}</small></div><div><strong>{percentText(match.damageShare)}</strong><small>{numberText(metric(player, 'totalDamageDealtToChampions', game))} 伤害</small></div><div><strong>{numberText(match.cs)} <small>补刀</small></strong><small>{numberText(match.csPerMinute, 1)} / 分钟</small></div><div><strong>{numberText(metric(player, 'goldEarned', game))}</strong><small>金币 · {percentText(match.goldShare)}</small></div></div>
        <div className="rh-match-build"><Equipment player={player} /><Augments player={player} /><div className="rh-badges">{badges.slice(0, 4).map((b) => <span key={b.text} className={`rh-badge rh-badge-${b.tone}`} title={b.detail}>{b.text}</span>)}{badges.length > 4 && <span className="rh-badge" title={badges.slice(4).map((b) => b.detail).join('\n')}>+{badges.length - 4}</span>}</div></div>
        <div className="rh-match-meta"><span>{getQueueName(game.json.queueId)} · {durationText(match.duration)} · {date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {getMapName(game.json.mapId)}</span><button type="button" title="复制对局 ID" onClick={() => { void navigator.clipboard.writeText(String(game.json.gameId)).then(() => setCopied(true)).catch(() => setCopied(false)) }}>{copied ? '已复制' : `ID ${game.json.gameId}`}</button></div>
      </div>
      <MiniRoster game={game} onInspect={onInspect} />
      <button type="button" className="rh-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} title={expanded ? '收起详细战报' : '展开详细战报'}>{expanded ? '⌃' : '⌄'}<small>{expanded ? '收起' : '战报'}</small></button>
    </div>
    {expanded && <MatchReport game={game} focusPuuid={player.puuid} onInspect={onInspect} />}
  </article>
}
