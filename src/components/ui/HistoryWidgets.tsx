import { useEffect, useState, type ReactNode } from 'react'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { HistoryReplayButton } from './HistoryReplayButton'
import { HistoryPlayerName } from './HistoryPlayerName'
import { Modal } from './Modal'
import { getChampIcon, getChampionById, getItemInfo, getSpellInfo, getPerkInfo, getPerkStyleIcon, getAugmentInfo, getQueueName, getMapName } from '@/lib/assets'
import { championStats, durationText, finite, getOutcome, getPosition, matchBadges, metric, numberText, percentText, POSITION_NAMES, riotName, share, summarize, teamKey, type HistoryMatch } from '@/lib/history-model'
import { rankText, type HistoryRank } from '@/lib/history-api'
import { getRankedEmblem, getRankedMiniCrest } from '@/lib/ranked-assets'
import { fetchHistoryAugmentDetail, historyAugmentRarity, type HistoryAugmentDetail, type HistoryAugmentMode } from '@/lib/history-augment-details'
import { isHistoryFieldVisible, type HistoryDisplayField, type HistoryHiddenFields } from '@/lib/history-display'
import { useHistoryHiddenFields } from '@/lib/use-history-display'
import type { SgpGameSummaryLol, SgpParticipantLol } from '@/types/sgp'

export function HistoryImage({ src, label, className = '', nativeTooltip = true }: {
  src?: string; label: string; className?: string; nativeTooltip?: boolean
}) {
  const [failed, setFailed] = useState('')
  const title = nativeTooltip ? label : undefined
  return src && failed !== src
    ? <img src={src} alt={label} title={title} className={className} loading="lazy" onError={() => setFailed(src)} />
    : <span className={`rh-image-fallback ${className}`} title={title}>{label.slice(0, 1) || '?'}</span>
}

export function championName(id: number): string {
  const champion = getChampionById(id)
  return champion ? `${champion.title} · ${champion.name}` : `英雄 ${id}`
}

export function RankCards({ ranks, status }: { ranks: HistoryRank[] | null; status: string }) {
  const [selectedQueue, setSelectedQueue] = useState('')
  const selected = ranks?.find((rank) => rank.key === selectedQueue)
  const cards: HistoryRank[] = ranks ?? ['单双排位', '灵活排位'].map((label) => ({
    key: label, label, tier: 'UNRANKED', division: '', lp: null, wins: null, losses: null,
  }))
  return <><div className="rh-ranks">{cards.map((rank) => {
    const name = ranks ? rankText(rank) : status
    const total = rank.wins != null && rank.losses != null ? rank.wins + rank.losses : 0
    return (
      <button type="button" className="rh-rank-card" key={rank.key} disabled={!ranks}
        title={ranks ? '查看历史段位' : undefined} onClick={() => setSelectedQueue(rank.key)}>
        <span className="rh-rank-card-heading">
          <span>{rank.label}</span>
          {total > 0 && <small>胜率 {((rank.wins ?? 0) / total * 100).toFixed(1)}%</small>}
        </span>
        <span className="rh-rank-card-main">
          <HistoryImage src={getRankedEmblem(rank.tier)} label={name} className="rh-rank-crest" />
          <span className="rh-rank-card-data">
            <strong className={`rh-rank-${rank.tier.toLowerCase()}`}>{name}</strong>
            {ranks && rank.tier !== 'UNRANKED' && <small>{numberText(rank.wins)} 胜 {numberText(rank.losses)} 负 · {numberText(rank.lp)} LP</small>}
            {ranks && <span className="rh-rank-peak">
              <span>赛季最高</span>
              {rank.peak ? <>
                <HistoryImage src={getRankedMiniCrest(rank.peak.tier)} label={rankText(rank.peak)} className="rh-rank-peak-crest" />
                <b>{rankText(rank.peak)}</b>
              </> : <span>—</span>}
            </span>}
          </span>
        </span>
      </button>
    )
  })}</div>
  <Modal open={!!selected} onClose={() => setSelectedQueue('')} width="min(440px, 94vw)" height="min(300px, 90vh)">
    {selected && <section className="rh-shell rh-rank-history" aria-label="历史段位详情">
      <header><h2>历史段位</h2><span className="rh-muted">{selected.label}</span></header>
      <dl>{([
        ['当前段位', selected],
        ['本赛季最高', selected.peak],
        ['上赛季最高', selected.previousPeak],
        ['上赛季结算', selected.previousEnd],
      ] as const).map(([label, rank]) => <div key={label}><dt>{label}</dt><dd>{rank ? <>
        <HistoryImage src={getRankedMiniCrest(rank.tier)} label={rankText(rank)} />
        <strong>{rankText(rank)}</strong>
        {label === '当前段位' && selected.tier !== 'UNRANKED' && selected.lp != null && <small>{selected.lp} LP</small>}
      </> : '—'}</dd></div>)}</dl>
      {!selected.previousEnd && !selected.previousPeak && <p className="rh-footnote">客户端暂未返回上赛季段位。</p>}
    </section>}
  </Modal></>
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

export function ChampionStrip({ matches, onSelect, selectedId, limit = 5 }: {
  matches: HistoryMatch[]
  onSelect?: (id: number) => void
  selectedId?: number
  limit?: number
}) {
  return <div className="rh-champion-strip">{championStats(matches).slice(0, limit).map((item) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)}
    aria-pressed={onSelect && selectedId !== undefined ? selectedId === item.id : undefined}
    title={`${championName(item.id)} · ${item.total} 场 · 胜率 ${percentText(item.winRate)}`} disabled={!onSelect}>
    <HistoryImage src={getChampIcon(item.id)} label={championName(item.id)} /><span>{item.total}</span>
  </button>)}</div>
}

export function Equipment({ player, dense = false }: { player: SgpParticipantLol; dense?: boolean }) {
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6]
  return (
    <div className={`rh-equipment ${dense ? 'rh-equipment-dense' : ''}`}>
      {items.map((id, index) => {
        if (!(id > 0)) return <span className="rh-item-slot" key={index} />
        const info = getItemInfo(id)
        const name = info.name || `装备 ${id}`
        return (
          <HistoryAssetTooltip key={index} className="rh-item-slot" title={name} icon={info.iconPath}
            subtitle={info.price > 0 ? `装备 · ${numberText(info.price)} 金币` : '装备'}
            description={info.description || '暂无装备说明'}>
            <HistoryImage src={info.iconPath} label={name} nativeTooltip={false} />
          </HistoryAssetTooltip>
        )
      })}
    </div>
  )
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

const AUGMENT_RARITY_CLASSES: Record<string, string> = { 白银: 'silver', 黄金: 'gold', 棱彩: 'prismatic' }

function HistoryAugmentIcon({ id, mode }: { id: number; mode: HistoryAugmentMode }) {
  const info = getAugmentInfo(id)
  const [requested, setRequested] = useState(false)
  const [detail, setDetail] = useState<HistoryAugmentDetail | null>()
  useEffect(() => {
    if (!requested || info?.description) return
    let active = true
    void fetchHistoryAugmentDetail(id, mode).then((result) => {
      if (active) setDetail(result ?? null)
    }).catch(() => { if (active) setDetail(null) })
    return () => { active = false }
  }, [requested, id, mode, info?.description])

  const name = info?.name && info.name !== String(id) ? info.name : detail?.name || `海克斯 ${id}`
  const rarity = historyAugmentRarity(info?.rarity) || detail?.rarity
  const rarityClass = rarity ? AUGMENT_RARITY_CLASSES[rarity] : undefined
  const description = info?.description || detail?.description ||
    (requested && detail === undefined ? '正在读取效果说明…' : '暂无该强化的效果说明')
  return (
    <HistoryAssetTooltip className={`rh-augment-slot${rarityClass ? ` rh-augment-${rarityClass}` : ''}`} title={name} icon={info?.iconPath}
      subtitle={rarity ? `${rarity}强化` : '海克斯强化'} description={description}
      onShow={() => setRequested(true)}>
      <HistoryImage src={info?.iconPath} label={name} nativeTooltip={false} />
    </HistoryAssetTooltip>
  )
}

export function Augments({ player, game }: { player: SgpParticipantLol; game: SgpGameSummaryLol }) {
  const ids = [player.playerAugment1, player.playerAugment2, player.playerAugment3, player.playerAugment4, player.playerAugment5, player.playerAugment6].filter((id) => id > 0)
  if (!ids.length) return null
  const mode = game.json.gameMode === 'CHERRY' ? 'arena' : 'mayhem'
  return <div className="rh-augments">{ids.map((id, index) => <HistoryAugmentIcon key={`${id}-${index}`} id={id} mode={mode} />)}</div>
}

function MiniRoster({ game, onInspect }: { game: SgpGameSummaryLol; onInspect?: (puuid: string, name: string) => void }) {
  const groups = new Map<number, SgpParticipantLol[]>()
  game.json.participants.forEach((p) => { const key = teamKey(p, game); const group = groups.get(key) || []; group.push(p); groups.set(key, group) })
  return <div className="rh-mini-roster">{[...groups].map(([key, players]) => <div key={key}>{players.map((p, index) => <button type="button" key={p.puuid || index} aria-label={riotName(p)} disabled={!p.puuid || !onInspect} onClick={() => onInspect?.(p.puuid, riotName(p))}>
    <HistoryImage src={getChampIcon(p.championId)} label={championName(p.championId)} /><HistoryPlayerName name={riotName(p)} />
  </button>)}</div>)}</div>
}

type ReportView = 'combat' | 'support'
type ShareMetric = 'totalDamageDealtToChampions' | 'totalDamageTaken' | 'goldEarned'
type ReportField = HistoryDisplayField<'report'>
type ReportColumn = {
  key: ReportField | 'loadout'
  label: string
  render: (player: SgpParticipantLol, teamKills: number | null) => ReactNode
}

const DAMAGE_FIELDS = {
  totalDamageDealtToChampions: ['physicalDamageDealtToChampions', 'magicDamageDealtToChampions', 'trueDamageDealtToChampions'],
  totalDamageTaken: ['physicalDamageTaken', 'magicDamageTaken', 'trueDamageTaken'],
} as const

const DAMAGE_LEGEND = [
  ['physical', '物理'],
  ['magic', '魔法'],
  ['true', '真实'],
  ['unknown', '未细分'],
] as const

function ReportShare({ player, game, field, max }: {
  player: SgpParticipantLol; game: SgpGameSummaryLol; field: ShareMetric; max: number
}) {
  const total = metric(player, field, game)
  const ratio = share(player, field, game)
  let bar: ReactNode
  if (max > 0 && total != null && total >= 0) {
    let segments: Array<{ color: string; label: string; value: number }>
    if (field === 'goldEarned') {
      segments = [{ color: 'gold', label: '金币', value: total }]
    } else {
      const parts = DAMAGE_FIELDS[field].map((key) => Math.max(0, metric(player, key, game) ?? 0))
      const remainder = Math.max(0, total - parts.reduce((sum, value) => sum + value, 0))
      segments = DAMAGE_LEGEND.map(([color, label], index) => ({ color, label, value: parts[index] ?? remainder }))
    }
    const sum = segments.reduce((value, segment) => value + segment.value, 0)
    bar = <div className="rh-report-bar" title={segments.filter(({ value }) => value > 0)
      .map(({ label, value }) => `${label} ${numberText(value)}`).join(' · ') || numberText(total)}>
      <div className="rh-report-bar-fill" style={{ width: `${total / max * 100}%` }}>
        {segments.filter(({ value }) => value > 0).map(({ color, value }) =>
          <span key={color} className={`rh-report-bar-${color}`} style={{ width: `${value / sum * 100}%` }} />)}
      </div>
    </div>
  }
  return <>{numberText(total)}{bar}<small>{percentText(ratio)}</small></>
}

function reportColumns(game: SgpGameSummaryLol, view: ReportView, show: (field: ReportField) => boolean) {
  const columns: ReportColumn[] = []
  function add(key: ReportField, label: string, render: ReportColumn['render']) {
    if (show(key)) columns.push({ key, label, render })
  }
  add('kda', 'K / D / A', (p) =>
    <strong>{numberText(finite(p.kills))} / <em>{numberText(finite(p.deaths))}</em> / {numberText(finite(p.assists))}</strong>)

  const equipment = show('items')
  const spells = show('spells')
  const augments = show('augments')
  const loadoutLabels = [equipment && '装备', spells && '符文', augments && '海克斯'].filter(Boolean)
  if (loadoutLabels.length) columns.push({
    key: 'loadout',
    label: loadoutLabels.join(' / '),
    render: (p) => <>
      {equipment && <Equipment player={p} dense />}
      {(spells || augments) && <div className="rh-report-loadout">
        {spells && <RunesAndSpells player={p} />}
        {augments && <Augments player={p} game={game} />}
      </div>}
    </>,
  })

  if (view === 'combat') {
    const sharedColumns: Array<[ReportField, string, ShareMetric]> = [
      ['damage', '伤害 / 占比', 'totalDamageDealtToChampions'],
      ['taken', '承伤 / 占比', 'totalDamageTaken'],
      ['gold', '经济 / 占比', 'goldEarned'],
    ]
    sharedColumns.forEach(([key, label, field]) => {
      if (!show(key)) return
      const max = show('bars') ? Math.max(0, ...game.json.participants.map((p) => metric(p, field, game) ?? 0)) : 0
      columns.push({ key, label, render: (p) => <ReportShare player={p} game={game} field={field} max={max} /> })
    })
    add('cs', '补刀 / 分', (p) => {
      const duration = game.json.gameDuration / 60
      const cs = finite(p.totalMinionsKilled) != null && finite(p.neutralMinionsKilled) != null
        ? p.totalMinionsKilled + p.neutralMinionsKilled : null
      return <>{numberText(cs)}<small>{numberText(cs != null && duration > 0 ? cs / duration : null, 1)} / 分</small></>
    })
    add('participation', '参团率', (p, teamKills) => percentText(
      teamKills != null && teamKills > 0 && finite(p.kills) != null && finite(p.assists) != null
        ? Math.min(1, (p.kills + p.assists) / teamKills) : teamKills === 0 ? 0 : null))
  } else {
    add('heal', '治疗自身及友方', (p) => numberText(metric(p, 'totalHeal', game)))
    add('allyHeal', '友方治疗 / 护盾', (p) => <>{numberText(metric(p, 'totalHealsOnTeammates', game))}<small>护盾 {numberText(metric(p, 'totalDamageShieldedOnTeammates', game))}</small></>)
    add('control', '控制 / 秒', (p) => numberText(metric(p, 'timeCCingOthers', game), 1))
    add('vision', '视野 / 插眼 / 排眼', (p) => <>{numberText(metric(p, 'visionScore', game))}<small>{numberText(metric(p, 'wardsPlaced', game))} / {numberText(metric(p, 'wardsKilled', game))}</small></>)
    add('objectives', '目标 / 防御塔伤害', (p) => <>{numberText(metric(p, 'damageDealtToObjectives', game))}<small>推塔 {numberText(metric(p, 'damageDealtToTurrets', game))}</small></>)
  }
  return columns
}

export function MatchReport({ game, focusPuuid, onInspect }: { game: SgpGameSummaryLol; focusPuuid: string; onInspect?: (puuid: string, name: string) => void }) {
  const [view, setView] = useState<ReportView>('combat')
  const hidden = useHistoryHiddenFields()
  const show = (field: ReportField) => isHistoryFieldVisible(hidden, 'report', field)
  const columns = reportColumns(game, view, show)
  const bars = view === 'combat' && show('bars')
  const damageLegend = bars && (show('damage') || show('taken'))
  const economyLegend = bars && show('gold')
  const groups = new Map<number, SgpParticipantLol[]>()
  game.json.participants.forEach((p) => {
    const key = teamKey(p, game)
    const group = groups.get(key) || []
    group.push(p)
    groups.set(key, group)
  })
  return <div className="rh-report">
    <div className="rh-report-toolbar">
      <strong>{game.json.participants.length} 人详细战报</strong>
      <span>本场数据 · 版本 {game.json.gameVersion || '未知'}</span>
      <div className="rh-segment">
        <button type="button" className={view === 'combat' ? 'is-active' : ''} onClick={() => setView('combat')}>战斗与经济</button>
        <button type="button" className={view === 'support' ? 'is-active' : ''} onClick={() => setView('support')}>治疗、控制与视野</button>
      </div>
    </div>
    <div className="rh-table-scroll"><table className="rh-report-table"><thead><tr><th>玩家 / 英雄</th>
      {columns.map(({ key, label }) => <th key={key}>{label}</th>)}
    </tr></thead><tbody>
      {[...groups].map(([key, players]) => {
        const kills = players.map((p) => finite(p.kills)).reduce<number>((sum, value) => sum + (value ?? 0), 0)
        const teamKills = players.every((p) => finite(p.kills) != null) ? kills : null
        const totalGold = players.reduce((sum, p) => sum + (finite(p.goldEarned) || 0), 0)
        const objective = game.json.teams?.find((t) => t.teamId === key)?.objectives
        const outcome = getOutcome(game, players[0])
        const teamName = game.json.gameMode === 'CHERRY' ? `小队 ${key}` : key === 100 ? '蓝色方' : key === 200 ? '红色方' : `队伍 ${key}`
        const result = outcome === 'win' ? '胜利' : outcome === 'loss' ? '失败' : outcome === 'remake' ? '重开' : '终止 / 未知'
        return <TeamReportRows key={key} players={players} game={game} focusPuuid={focusPuuid} onInspect={onInspect} columns={columns} teamKills={teamKills}
          label={`${teamName} · ${result} · ${kills} 击杀 · ${numberText(totalGold)} 金币${objective ? ` · 推塔 ${objective.tower?.kills ?? '—'} · 小龙 ${objective.dragon?.kills ?? '—'} · 大龙 ${objective.baron?.kills ?? '—'}` : ''}`} />
      })}
    </tbody></table></div>
    {(damageLegend || economyLegend) && <div className="rh-report-legend">
      {damageLegend && DAMAGE_LEGEND.map(([color, label]) => <span key={color}><i className={`rh-report-bar-${color}`} />{label}</span>)}
      {economyLegend && <span><i className="rh-report-bar-gold" />经济</span>}
      <span>条长相对本场同项最高值，百分比为队内占比。</span>
    </div>}
  </div>
}

function TeamReportRows({ players, label, game, focusPuuid, onInspect, columns, teamKills }: {
  players: SgpParticipantLol[]; label: string; game: SgpGameSummaryLol; focusPuuid: string
  onInspect?: (puuid: string, name: string) => void; columns: ReportColumn[]; teamKills: number | null
}) {
  return <><tr className="rh-team-divider"><td colSpan={columns.length + 1}>{label}</td></tr>
    {players.map((p, index) => <tr key={p.puuid || index} className={p.puuid === focusPuuid ? 'is-focus' : ''}>
      <td><button type="button" className="rh-player-link" disabled={!p.puuid || !onInspect} onClick={() => onInspect?.(p.puuid, riotName(p))}>
        <HistoryImage src={getChampIcon(p.championId)} label={championName(p.championId)} />
        <span><strong><HistoryPlayerName name={riotName(p)} showTag /></strong><small>{championName(p.championId)} · {POSITION_NAMES[getPosition(p, game)]}</small></span>
      </button></td>
      {columns.map(({ key, render }) =>
        <td key={key} className={key === 'loadout' ? 'rh-report-loadout-cell' : undefined}>{render(p, teamKills)}</td>)}
    </tr>)}
  </>
}

export function HistoryMatchCard({ match, hidden, onInspect }: {
  match: HistoryMatch; hidden: HistoryHiddenFields; onInspect?: (puuid: string, name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { game, player, outcome } = match
  const show = (field: HistoryDisplayField<'history'>) => isHistoryFieldVisible(hidden, 'history', field)
  const badges = show('badges') ? matchBadges(match) : []
  const date = new Date(game.json.gameCreation)
  const outcomeLabel = outcome === 'win' ? '胜利' : outcome === 'loss' ? (player.gameEndedInSurrender ? '投降' : '失败') : outcome === 'remake' ? '重开' : outcome === 'abort' ? '已终止' : '未知'
  const placement = finite(player.subteamPlacement) || finite(player.placement)
  return <article className={`rh-match rh-match-${outcome}`}>
    <div className={`rh-match-main${show('roster') ? '' : ' rh-match-main-no-roster'}`}>
      <div className="rh-match-hero"><button type="button" title={`${championName(player.championId)} · 展开战报`} onClick={() => setExpanded(!expanded)}><HistoryImage src={getChampIcon(player.championId)} label={championName(player.championId)} /><small>{finite(player.champLevel) ?? '?'}</small></button><strong>{outcomeLabel}</strong>{game.json.gameMode === 'CHERRY' && placement && placement > 0 ? <small>第 {placement} 名</small> : null}</div>
      <div className="rh-match-info">
        <div className="rh-match-stats">
          {show('spells') && <RunesAndSpells player={player} />}
          {show('kda') && <div><strong className="rh-kda">{numberText(finite(player.kills))} / <em>{numberText(finite(player.deaths))}</em> / {numberText(finite(player.assists))}</strong><small>KDA {numberText(match.kda, 2)} · 参团 {percentText(match.participation)}</small></div>}
          {show('damage') && <div><strong>{percentText(match.damageShare)}</strong><small>{numberText(metric(player, 'totalDamageDealtToChampions', game))} 伤害</small></div>}
          {show('cs') && <div><strong>{numberText(match.cs)} <small>补刀</small></strong><small>{numberText(match.csPerMinute, 1)} / 分钟</small></div>}
          {show('gold') && <div><strong>{numberText(metric(player, 'goldEarned', game))}</strong><small>金币 · {percentText(match.goldShare)}</small></div>}
        </div>
        <div className="rh-match-build">
          {show('items') && <Equipment player={player} />}
          {show('augments') && <Augments player={player} game={game} />}
          {badges.length > 0 && <div className="rh-badges">{badges.slice(0, 4).map((b) => <span key={b.text} className={`rh-badge rh-badge-${b.tone}`} title={b.detail}>{b.text}</span>)}{badges.length > 4 && <span className="rh-badge" title={badges.slice(4).map((b) => b.detail).join('\n')}>+{badges.length - 4}</span>}</div>}
        </div>
        <div className="rh-match-meta"><span>{getQueueName(game.json.queueId)} · {durationText(match.duration)} · {date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {getMapName(game.json.mapId)}</span>
          <span className="rh-match-meta-actions">
            <HistoryReplayButton game={game.json} />
            <button type="button" title="复制对局 ID" onClick={() => { void navigator.clipboard.writeText(String(game.json.gameId)).then(() => setCopied(true)).catch(() => setCopied(false)) }}>{copied ? '已复制' : `ID ${game.json.gameId}`}</button>
          </span>
        </div>
      </div>
      {show('roster') && <MiniRoster game={game} onInspect={onInspect} />}
      <button type="button" className="rh-expand" aria-expanded={expanded} aria-label={expanded ? '收起详细战报' : '展开详细战报'} onClick={() => setExpanded(!expanded)}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
    {expanded && <MatchReport game={game} focusPuuid={player.puuid} onInspect={onInspect} />}
  </article>
}
