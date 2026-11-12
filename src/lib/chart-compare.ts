/**
 * 玩家对比（DSH 优化版）
 *
 * 不做额外请求：两名玩家的数据都来自同一批已加载对局，
 * 因此样本、模式、时间窗口天然一致。样本数不同时以较小值提示。
 */
import { buildRadarProfile, type RadarProfile } from './chart-radar'
import { mean, riotName, summarize, toHistoryMatches, type HistoryMatch } from './history-model'
import { calculatePlayerScore, type PlayerScoreSystem } from './player-score'
import type { SgpGameSummaryLol } from '@/types/sgp'

export type CompareFormat = 'score' | 'decimal' | 'ratio'

export interface CompareRow {
  key: string
  label: string
  a: number | null
  b: number | null
  format: CompareFormat
  /** 数值越高是否更好；承伤/治疗等中性指标为 null，仅高亮较高方 */
  higherIsBetter: boolean | null
}

export interface PlayerCompareResult {
  a: RadarProfile
  b: RadarProfile
  aName: string
  bName: string
  /** 当前评分机制下的综合分（雷达固定用 Sona 八维，二者互不影响） */
  aScore: number | null
  bScore: number | null
  rows: CompareRow[]
  /** 双方样本的较小值 */
  sample: number
  /** 两人真正同场对局数 */
  sharedGames: number
}

function visionPerMinute(matches: HistoryMatch[]): number | null {
  const values = matches
    .filter((match) => match.outcome === 'win' || match.outcome === 'loss')
    .map((match) => {
      const vision = match.player.visionScore
      const minutes = match.duration / 60
      return typeof vision === 'number' && Number.isFinite(vision) && minutes > 0 ? vision / minutes : null
    })
    .filter((value): value is number => value != null)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function playerName(games: SgpGameSummaryLol[], puuid: string): string {
  for (const game of games) {
    const participant = game.json.participants?.find((item) => item.puuid === puuid)
    if (participant) return riotName(participant)
  }
  return '未知玩家'
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildCompareRows(
  aMatches: HistoryMatch[],
  bMatches: HistoryMatch[],
  aScore: number | null,
  bScore: number | null,
): CompareRow[] {
  const a = summarize(aMatches)
  const b = summarize(bMatches)
  return [
    { key: 'score', label: '综合评分', a: aScore, b: bScore, format: 'score', higherIsBetter: true },
    { key: 'kda', label: 'KDA', a: finite(a.kda), b: finite(b.kda), format: 'decimal', higherIsBetter: true },
    { key: 'winRate', label: '胜率', a: finite(a.winRate), b: finite(b.winRate), format: 'ratio', higherIsBetter: true },
    { key: 'participation', label: '参团率', a: finite(a.participation), b: finite(b.participation), format: 'ratio', higherIsBetter: true },
    { key: 'damageShare', label: '伤害占比', a: finite(a.damageShare), b: finite(b.damageShare), format: 'ratio', higherIsBetter: true },
    { key: 'takenShare', label: '承伤占比', a: finite(a.takenShare), b: finite(b.takenShare), format: 'ratio', higherIsBetter: null },
    { key: 'goldShare', label: '经济占比', a: finite(a.goldShare), b: finite(b.goldShare), format: 'ratio', higherIsBetter: true },
    { key: 'csPerMinute', label: '补刀 / 分', a: finite(a.csPerMinute), b: finite(b.csPerMinute), format: 'decimal', higherIsBetter: true },
    { key: 'visionPerMinute', label: '分均视野', a: visionPerMinute(aMatches), b: visionPerMinute(bMatches), format: 'decimal', higherIsBetter: true },
  ]
}

export function comparePlayers(
  games: SgpGameSummaryLol[],
  aPuuid: string,
  bPuuid: string,
  system: PlayerScoreSystem,
): PlayerCompareResult | null {
  if (!aPuuid || !bPuuid || aPuuid === bPuuid) return null
  // 雷达固定使用 Sona 八维：Akari 的九项按满分归一化后大多贴近 0，画出来是一条针，
  // 不适合作为形状；综合分仍按当前机制计算。
  const a = buildRadarProfile(games, aPuuid, 'sona')
  const b = buildRadarProfile(games, bPuuid, 'sona')
  if (!a || !b) return null
  const aMatches = toHistoryMatches(games, aPuuid)
  const bMatches = toHistoryMatches(games, bPuuid)
  if (!aMatches.length || !bMatches.length) return null
  const sharedGames = aMatches.filter((match) => bMatches.some((other) => other.id === match.id)).length
  const aScore = calculatePlayerScore(aMatches.map((match) => match.game), aPuuid, system)?.score ?? null
  const bScore = calculatePlayerScore(bMatches.map((match) => match.game), bPuuid, system)?.score ?? null
  return {
    a,
    b,
    aName: playerName(games, aPuuid),
    bName: playerName(games, bPuuid),
    aScore,
    bScore,
    rows: buildCompareRows(aMatches, bMatches, aScore, bScore),
    sample: Math.min(a.validGames, b.validGames),
    sharedGames,
  }
}

export function formatCompareValue(value: number | null, format: CompareFormat, system: PlayerScoreSystem): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (format === 'ratio') return `${Math.round(value * 100)}%`
  if (format === 'score') return value.toFixed(system === 'akari' ? 2 : 1)
  return value.toFixed(2)
}

export function formatCompareDelta(row: CompareRow, system: PlayerScoreSystem): string {
  if (row.a == null || row.b == null) return '—'
  const delta = row.a - row.b
  if (row.format === 'ratio') {
    const points = Math.round(delta * 100)
    return `${points > 0 ? '+' : points < 0 ? '−' : ''}${Math.abs(points)} pp`
  }
  const digits = row.format === 'score' ? (system === 'akari' ? 2 : 1) : 2
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(digits)}`
}

export function compareHighlight(row: CompareRow): 'a' | 'b' | null {
  if (row.a == null || row.b == null || row.a === row.b) return null
  return row.a > row.b ? 'a' : 'b'
}
