/**
 * 图表预览用的虚构对局（与 verify-charts 同源思路，字段足够触发两套评分）。
 * 仅用于离线预览，不参与生产。
 */
import type { SgpGameSummaryLol, SgpParticipantLol } from '../src/types/sgp'

const NAMES = ['me', 'ally', 'blue3', 'blue4', 'blue5', 'red1', 'red2', 'red3', 'red4', 'red5']

function seeded(seed: number): number {
  const value = Math.sin(seed * 9781.233) * 10000
  return value - Math.floor(value)
}

function participant(puuid: string, teamId: number, index: number, gameIndex: number, win: boolean): SgpParticipantLol {
  const roll = seeded(gameIndex * 10 + index)
  const kills = 4 + Math.floor(roll * 11)
  const deaths = Math.floor(seeded(gameIndex * 7 + index) * 7)
  const assists = 5 + Math.floor(seeded(gameIndex * 3 + index) * 16)
  const damage = 15000 + Math.floor(seeded(gameIndex + index) * 16000)
  return {
    puuid,
    participantId: index + 1,
    teamId,
    teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][index] ?? 'MIDDLE',
    individualPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][index] ?? 'MIDDLE',
    lane: 'MIDDLE',
    role: index === 4 ? 'DUO_SUPPORT' : 'SOLO',
    championId: 1 + ((index + gameIndex) % 160),
    championName: `Champion ${index}`,
    riotIdGameName: puuid,
    riotIdTagline: 'TEST',
    kills,
    deaths,
    assists,
    win,
    totalDamageDealtToChampions: damage,
    totalDamageTaken: 8000 + Math.floor(seeded(gameIndex * 2 + index) * 16000),
    goldEarned: 7000 + Math.floor(seeded(gameIndex * 4 + index) * 8000),
    totalHeal: 600 + Math.floor(seeded(gameIndex * 5 + index) * 3200),
    totalMinionsKilled: 60 + Math.floor(seeded(gameIndex * 6 + index) * 180),
    neutralMinionsKilled: 4 + Math.floor(seeded(gameIndex * 8 + index) * 40),
    visionScore: 8 + Math.floor(seeded(gameIndex * 9 + index) * 40),
    timePlayed: 1500 + gameIndex * 3,
    totalDamageShieldedOnTeammates: Math.floor(seeded(gameIndex + index) * 1200),
    totalTimeSpentDead: Math.floor(seeded(gameIndex * 3 + index) * 300),
    totalHealsOnTeammates: Math.floor(seeded(gameIndex * 5 + index) * 1500),
    damageDealtToObjectives: 500 + Math.floor(seeded(gameIndex + index) * 6000),
    damageDealtToTurrets: 300 + Math.floor(seeded(gameIndex + index) * 3000),
    damageSelfMitigated: 4000 + Math.floor(seeded(gameIndex + index) * 20000),
    wardsPlaced: Math.floor(seeded(gameIndex + index) * 22),
    wardsKilled: Math.floor(seeded(gameIndex + index) * 8),
    detectorWardsPlaced: Math.floor(seeded(gameIndex + index) * 5),
    turretTakedowns: Math.floor(seeded(gameIndex + index) * 4),
    challenges: {},
    doubleKills: 0,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    gameEndedInEarlySurrender: false,
    teamEarlySurrendered: false,
  } as unknown as SgpParticipantLol
}

export function makeGames(count = 40): SgpGameSummaryLol[] {
  return Array.from({ length: count }, (_, gameIndex) => {
    const blueWin = seeded(gameIndex * 13) > 0.38
    const participants = NAMES.map((name, index) => participant(name, index < 5 ? 100 : 200, index % 5, gameIndex, index < 5 ? blueWin : !blueWin))
    return {
      metadata: { product: '', tags: [], participants: [], timestamp: '', data_version: '', info_type: '', match_id: '', private: false },
      json: {
        gameId: 100000 + gameIndex,
        platformId: 'TEST',
        gameCreation: 1760000000000 + gameIndex * 3600000,
        gameDuration: 1500 + gameIndex * 3,
        gameMode: 'CLASSIC',
        gameType: 'MATCHED_GAME',
        queueId: 420,
        endOfGameResult: gameIndex === 7 ? 'GameComplete' : 'GameComplete',
        participants,
      },
    } as unknown as SgpGameSummaryLol
  })
}
