/**
 * 趋势序列（DSH 优化版）
 *
 * 只读取当前已加载的对局，不落盘、不发请求。
 * 评分取逐场值：Sona 用 calculateSonaGameStrengthScore，Akari 用逐场分量之和（不含胜率项，
 * 胜负由色带单独表达，避免趋势线同时编码结果）。
 */
import { calculateAkariGameTrendScore } from './akari-score'
import type { HistoryMatch } from './history-model'
import type { PlayerScoreSystem } from './player-score'
import { calculateSonaGameStrengthScore } from './player-strength-score'

export type TrendMetricKey = 'score' | 'kda' | 'damageShare' | 'participation' | 'csPerMinute'

export interface TrendMetric {
  key: TrendMetricKey
  label: string
  /** 纵轴与提示的格式化方式 */
  format: 'score' | 'decimal' | 'ratio'
}

export const TREND_METRICS: readonly TrendMetric[] = [
  { key: 'score', label: '综合评分', format: 'score' },
  { key: 'kda', label: 'KDA', format: 'decimal' },
  { key: 'damageShare', label: '伤害占比', format: 'ratio' },
  { key: 'participation', label: '参团率', format: 'ratio' },
  { key: 'csPerMinute', label: '补刀 / 分', format: 'decimal' },
]

export interface TrendPoint {
  id: string
  /** 对局创建时间（毫秒） */
  at: number
  outcome: HistoryMatch['outcome']
  value: number | null
}

export interface TrendSeries {
  metric: TrendMetricKey
  /** 从旧到新 */
  points: TrendPoint[]
  average: number | null
  latest: number | null
  valid: number
  wins: number
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatTrendValue(value: number | null, metric: TrendMetricKey, system: PlayerScoreSystem): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const config = TREND_METRICS.find((item) => item.key === metric)
  if (!config) return '—'
  if (config.format === 'ratio') return `${Math.round(value * 100)}%`
  if (config.format === 'score') return value.toFixed(system === 'akari' ? 2 : 1)
  return value.toFixed(2)
}

export function trendMetricValue(
  match: HistoryMatch,
  metric: TrendMetricKey,
  system: PlayerScoreSystem,
): number | null {
  switch (metric) {
    case 'score': {
      const puuid = match.player.puuid
      if (!puuid) return null
      if (system === 'akari') return finiteOrNull(calculateAkariGameTrendScore(match.game, puuid))
      return finiteOrNull(calculateSonaGameStrengthScore(match.game, puuid)?.score)
    }
    case 'kda':
      return finiteOrNull(match.kda)
    case 'damageShare':
      return finiteOrNull(match.damageShare)
    case 'participation':
      return finiteOrNull(match.participation)
    case 'csPerMinute':
      return finiteOrNull(match.csPerMinute)
    default:
      return null
  }
}

export function movingAverage(values: Array<number | null>, window = 5): Array<number | null> {
  const size = Math.max(1, Math.floor(window))
  return values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - size + 1), index + 1)
      .filter((value): value is number => value != null && Number.isFinite(value))
    return slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : null
  })
}

export function buildTrendSeries(
  matches: HistoryMatch[],
  metric: TrendMetricKey,
  system: PlayerScoreSystem,
): TrendSeries {
  const points: TrendPoint[] = [...matches]
    .sort((left, right) => left.game.json.gameCreation - right.game.json.gameCreation)
    .map((match) => ({
      id: match.id,
      at: match.game.json.gameCreation,
      outcome: match.outcome,
      value: trendMetricValue(match, metric, system),
    }))
  const validValues = points.map((point) => point.value).filter((value): value is number => value != null)
  const latest = [...points].reverse().find((point) => point.value != null)?.value ?? null
  return {
    metric,
    points,
    average: validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : null,
    latest,
    valid: validValues.length,
    wins: points.filter((point) => point.outcome === 'win').length,
  }
}
