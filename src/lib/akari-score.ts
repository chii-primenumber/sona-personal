/** Akari 1.5.1 scoring adaptation. Copyright (c) 2026 Hanxven, MIT.
 * Source and license: assets/licenses/LeagueAkari-MIT.txt, AKARI评分说明.md.
 */
import type { SgpGameSummaryLol, SgpParticipantLol } from '@/types/sgp'
import { finite, getOutcome, teamKey } from './history-model'

export interface AkariBreakdown {
  kdaScore: number; winRateScore: number; dmgScore: number; dmgTakenScore: number; healingScore: number
  csScore: number; goldScore: number; participationScore: number; visionScore: number
}
export interface AkariPlayerScore {
  score: number; maxScore: 17; validGames: number; breakdown: AkariBreakdown
  outstanding: boolean; extraordinary: boolean
}
const PVE_QUEUES = new Set([31,32,33,34,35,36,52,800,801,810,820,830,831,832,840,841,842,850,851,852,860,870,880,890,2000,2010,2020,90,91,92,950,951,960,961,981,982,990,1030,1031,1032,1040,1041,1050,1051,1060,1061,1070,1071,1800,1810,1820,1830,1840,1850,1860,1870,1880,1890])
const REQUIRED = ['kills','deaths','assists','totalDamageDealtToChampions','totalDamageTaken','goldEarned'] as const
const clamp = (value: number, min: number, max: number) => Math.max(Math.min(value,max),min)
const noZero = (value: number) => value || 1
const linear = (value: number, min: number, max: number, weight: number) => (clamp(value,min,max)-min)/(max-min)*weight
const kdaScore = (kda: number) => clamp(Math.sqrt(Math.max(kda-2,0))*3/7,0,1)
const mean = (values: number[]) => values.reduce((sum,value)=>sum+value,0)/noZero(values.length)

export function shouldSkipAkariGame(game: SgpGameSummaryLol, puuid: string): boolean {
  const p = game.json?.participants?.find((item)=>item.puuid===puuid)
  if (!p || PVE_QUEUES.has(game.json.queueId)) return true
  if (game.json.gameType && game.json.gameType !== 'MATCHED_GAME') return true
  const outcome = getOutcome(game,p)
  return outcome !== 'win' && outcome !== 'loss'
}

function prepare(game: SgpGameSummaryLol, puuid: string) {
  if (shouldSkipAkariGame(game,puuid)) return null
  const player = game.json.participants.find((p)=>p.puuid===puuid)!
  const team = game.json.participants.filter((p)=>teamKey(p,game)===teamKey(player,game))
  if (!team.length || team.some((p)=>REQUIRED.some((key)=>finite(p[key]) == null))) return null
  if (!(game.json.gameDuration > 0) || ['totalHeal','totalMinionsKilled','neutralMinionsKilled'].some((key)=>finite(player[key as keyof SgpParticipantLol])==null)) return null
  const total = (key: keyof SgpParticipantLol) => team.reduce((sum,p)=>sum+(finite(p[key]) ?? 0),0)
  const expected = (value: number, sum: number) => team.length <= 1 ? 0 : value/noZero(sum)/(1/team.length)
  const contribution = (key: keyof SgpParticipantLol, full: number, weight: number) => linear(expected(finite(player[key]) ?? 0,total(key)),1,full,weight)
  const participation = (player.kills+player.assists)/noZero(total('kills'))
  const components: AkariBreakdown = {
    kdaScore: kdaScore((player.kills+player.assists)/noZero(player.deaths)),
    winRateScore: player.win ? 1 : 0,
    dmgScore: contribution('totalDamageDealtToChampions',2,3),
    dmgTakenScore: contribution('totalDamageTaken',2,2),
    healingScore: linear(player.totalHeal/noZero(total('totalDamageTaken')/team.length),.2,team.length===1?1:1.4,2),
    csScore: linear((player.totalMinionsKilled+player.neutralMinionsKilled)/(game.json.gameDuration/60),5,10,2),
    goldScore: contribution('goldEarned',1.5,2),
    participationScore: linear(participation,.3,1,2),
    visionScore: contribution('visionScore',2,2),
  }
  return {player,components}
}

export function calculateAkariPlayerScore(games: SgpGameSummaryLol[], puuid: string): AkariPlayerScore | null {
  const samples = games.map((game)=>prepare(game,puuid)).filter((sample): sample is NonNullable<typeof sample> => sample !== null)
  if (!samples.length) return null
  const kills = samples.reduce((sum,s)=>sum+s.player.kills,0)
  const assists = samples.reduce((sum,s)=>sum+s.player.assists,0)
  const deaths = samples.reduce((sum,s)=>sum+s.player.deaths,0)
  const winRate = samples.filter((s)=>s.player.win).length/samples.length
  const breakdown = Object.fromEntries((Object.keys(samples[0].components) as Array<keyof AkariBreakdown>)
    .map((key)=>[key,mean(samples.map((s)=>s.components[key]))])) as unknown as AkariBreakdown
  // Aggregate KDA and win rate are scored after aggregation, as in Akari.
  breakdown.kdaScore = kdaScore((kills+assists)/noZero(deaths))
  breakdown.winRateScore = linear(winRate,.5,1,1)
  const score = Object.values(breakdown).reduce((sum,value)=>sum+value,0)
  if (!Number.isFinite(score)) return null
  return {score,maxScore:17,validGames:samples.length,breakdown,
    outstanding:score>=6.5 && samples.length>=5,extraordinary:score>=8 && samples.length>=8}
}

/**
 * 逐场趋势分（DSH 优化版）：九项分量之和，但**排除胜率项**。
 * 原因：胜负已经由趋势图底部的色带单独表达，再把 winRateScore 计入会让折线同时编码结果。
 * 满分因此为 16，与聚合分（0–17）不同，仅用于观察走势。
 */
export function calculateAkariGameTrendScore(game: SgpGameSummaryLol, puuid: string): number | null {
  const sample = prepare(game, puuid)
  if (!sample) return null
  const { components } = sample
  const total = components.kdaScore + components.dmgScore + components.dmgTakenScore
    + components.healingScore + components.csScore + components.goldScore
    + components.participationScore + components.visionScore
  return Number.isFinite(total) ? total : null
}
