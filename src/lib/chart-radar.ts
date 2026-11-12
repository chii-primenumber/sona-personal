/**
 * 雷达画像（DSH 优化版）
 *
 * 两套机制的量纲不同，统一归一化到 0–1 后再画图：
 * - Sona：breakdown 本身就是 0–100 的内部分，直接除以 100。
 * - Akari：九项各自满分 1/1/3/2/2/2/2/2/2，按满分归一化。
 */
import type { AkariBreakdown } from './akari-score'
import { calculateAkariPlayerScore } from './akari-score'
import type { PlayerScoreSystem } from './player-score'
import { calculateSonaPlayerStrengthScore, type SonaScoreBreakdown } from './player-strength-score'
import type { SgpGameSummaryLol } from '@/types/sgp'

export interface RadarAxis {
  key: string
  label: string
  /** 0–1 */
  value: number
  /** 原始值（Sona 0–100；Akari 原始得分） */
  raw: number
}

export interface RadarProfile {
  system: PlayerScoreSystem
  axes: RadarAxis[]
  score: number
  maxScore: number
  validGames: number
  /** Sona 有置信度，Akari 为 null */
  confidence: number | null
}

const SONA_AXES: ReadonlyArray<{ key: keyof SonaScoreBreakdown; label: string }> = [
  { key: 'combat', label: '战斗' },
  { key: 'win', label: '胜率分' },
  { key: 'damage', label: '输出' },
  { key: 'economy', label: '经济' },
  { key: 'objectives', label: '资源' },
  { key: 'vision', label: '视野' },
  { key: 'durability', label: '生存' },
  { key: 'farming', label: '补刀' },
]

const AKARI_AXES: ReadonlyArray<{ key: keyof AkariBreakdown; label: string; weight: number }> = [
  { key: 'kdaScore', label: 'KDA', weight: 1 },
  { key: 'winRateScore', label: '胜率', weight: 1 },
  { key: 'dmgScore', label: '输出', weight: 3 },
  { key: 'dmgTakenScore', label: '承伤', weight: 2 },
  { key: 'healingScore', label: '治疗', weight: 2 },
  { key: 'csScore', label: '补刀', weight: 2 },
  { key: 'goldScore', label: '金币', weight: 2 },
  { key: 'participationScore', label: '参团', weight: 2 },
  { key: 'visionScore', label: '视野', weight: 2 },
]

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))

export function normalizeSonaBreakdown(breakdown: SonaScoreBreakdown): RadarAxis[] {
  return SONA_AXES.map(({ key, label }) => ({
    key,
    label,
    value: clamp01(breakdown[key] / 100),
    raw: breakdown[key],
  }))
}

export function normalizeAkariBreakdown(breakdown: AkariBreakdown): RadarAxis[] {
  return AKARI_AXES.map(({ key, label, weight }) => ({
    key,
    label,
    value: clamp01(breakdown[key] / weight),
    raw: breakdown[key],
  }))
}

export function buildRadarProfile(
  games: SgpGameSummaryLol[],
  puuid: string,
  system: PlayerScoreSystem,
): RadarProfile | null {
  if (system === 'akari') {
    const result = calculateAkariPlayerScore(games, puuid)
    if (!result) return null
    return {
      system,
      axes: normalizeAkariBreakdown(result.breakdown),
      score: result.score,
      maxScore: result.maxScore,
      validGames: result.validGames,
      confidence: null,
    }
  }

  const result = calculateSonaPlayerStrengthScore(games, puuid)
  if (!result || !Number.isFinite(result.score)) return null
  return {
    system,
    axes: normalizeSonaBreakdown(result.breakdown),
    score: result.score,
    maxScore: 16,
    validGames: result.validGames,
    confidence: result.confidence,
  }
}
