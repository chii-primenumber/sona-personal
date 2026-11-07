import { store } from './store'
import { calculateAkariPlayerScore, shouldSkipAkariGame } from './akari-score'
import { calculateSonaPlayerStrengthScore, shouldSkipSonaStrengthGame } from './player-strength-score'
import type { SgpGameSummaryLol } from '@/types/sgp'

export type PlayerScoreSystem = 'sona' | 'akari'
export interface PlayerScore { system: PlayerScoreSystem; score: number; maxScore: number; validGames: number }
export function getPlayerScoreSystem(): PlayerScoreSystem {
  return store.get('playerScoreSystem') === 'sona' ? 'sona' : 'akari'
}
export const playerScoreName = (system: PlayerScoreSystem) => system === 'akari' ? 'Akari' : 'Sona'
export const playerScoreLabel = (system: PlayerScoreSystem) => `${playerScoreName(system)} 评分`
export const playerScoreRange = (system: PlayerScoreSystem) => system === 'akari' ? '0–17' : '3–16'
export function formatPlayerScore(score: number, system: PlayerScoreSystem): string {
  return Number.isFinite(score) ? score.toFixed(system === 'akari' ? 2 : 1) : '—'
}
export function playerScoreColor(score: number, system: PlayerScoreSystem): string {
  return score >= (system === 'akari' ? 8 : 14.5) ? '#5bbd72' : score >= (system === 'akari' ? 6.5 : 11.2) ? '#c8aa6e' : '#e74c3c'
}
export function shouldSkipPlayerScoreGame(game: SgpGameSummaryLol, puuid: string, system = getPlayerScoreSystem()): boolean {
  return system === 'akari' ? shouldSkipAkariGame(game,puuid) : shouldSkipSonaStrengthGame(game,puuid)
}
export function calculatePlayerScore(games: SgpGameSummaryLol[], puuid: string, system = getPlayerScoreSystem()): PlayerScore | null {
  if (system === 'akari') {
    const result = calculateAkariPlayerScore(games,puuid)
    return result ? {system,score:result.score,maxScore:result.maxScore,validGames:result.validGames} : null
  }
  const result = calculateSonaPlayerStrengthScore(games,puuid)
  return result && Number.isFinite(result.score) ? {system,score:result.score,maxScore:16,validGames:result.validGames} : null
}
