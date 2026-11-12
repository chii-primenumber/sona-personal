import './datastore-stub'
import assert from 'node:assert/strict'
import {
  buildTrendSeries,
  formatTrendValue,
  movingAverage,
  trendMetricValue,
} from '../src/lib/chart-series'
import { calculateAkariGameTrendScore } from '../src/lib/akari-score'
import { normalizeAkariBreakdown, normalizeSonaBreakdown } from '../src/lib/chart-radar'
import {
  buildCompareRows,
  compareHighlight,
  formatCompareDelta,
  formatCompareValue,
} from '../src/lib/chart-compare'
import { summarize, toHistoryMatches } from '../src/lib/history-model'
import type { SgpGameSummaryLol, SgpParticipantLol } from '../src/types/sgp'

function participant(puuid: string, teamId: number, index: number, kills = 3, deaths = 2, assists = 6, win = true): SgpParticipantLol {
  return {
    puuid, participantId: index, teamId,
    teamPosition: 'MIDDLE', individualPosition: 'MIDDLE', lane: 'MIDDLE', role: 'SOLO',
    championId: 154, championName: 'Sona', kills, deaths, assists, win,
    totalDamageDealtToChampions: 18000 + index * 900,
    totalDamageTaken: 12000 + index * 400,
    goldEarned: 11000 + index * 300,
    totalHeal: 2400,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 12,
    visionScore: 22 + index,
    timePlayed: 1800,
    totalDamageShieldedOnTeammates: 480,
    totalTimeSpentDead: 110,
    totalHealsOnTeammates: 900,
    damageDealtToObjectives: 2400 + index * 120,
    damageDealtToTurrets: 1600,
    damageSelfMitigated: 9000,
    wardsPlaced: 12,
    wardsKilled: 3,
    detectorWardsPlaced: 2,
    turretTakedowns: 2,
    challenges: {},
    doubleKills: 0, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    gameEndedInEarlySurrender: false, teamEarlySurrendered: false,
  } as unknown as SgpParticipantLol
}

function game(id: number, creation: number, players: SgpParticipantLol[], queueId = 420): SgpGameSummaryLol {
  return {
    metadata: { product: '', tags: [], participants: [], timestamp: '', data_version: '', info_type: '', match_id: '', private: false },
    json: {
      gameId: id, platformId: 'TEST', gameCreation: creation, gameDuration: 1800,
      gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', queueId, endOfGameResult: 'GameComplete',
      participants: players,
    },
  } as unknown as SgpGameSummaryLol
}

function roster(main: string, mate: string, seed: number): SgpParticipantLol[] {
  const blue = Array.from({ length: 5 }, (_, index) => participant(index === 0 ? main : `${mate}-b${index}`, 100, index, 2 + index + seed, 1 + (index % 3), 4 + index))
  const red = Array.from({ length: 5 }, (_, index) => participant(`${mate}-r${index}`, 200, index, 1 + index, 3 + index, 2 + index, false))
  return [...blue, ...red]
}

const games = [
  game(1, 1000, roster('me', 'ally', 0)),
  game(2, 2000, roster('me', 'ally', 1)),
  game(3, 3000, roster('me', 'ally', 2)),
]
const matches = toHistoryMatches(games, 'me')
assert.equal(matches.length, 3)
assert.equal(matches[0].game.json.gameId, 3, 'matches are newest first')

// 移动平均：空值跳过，不把缺失当 0
assert.deepEqual(movingAverage([1, 2, 3, null, 5], 2), [1, 1.5, 2.5, 3, 5])
assert.deepEqual(movingAverage([null, null], 5), [null, null])
assert.deepEqual(movingAverage([10], 5), [10])

// 趋势：从旧到新、平均/最新/有效数/胜场
const kdaSeries = buildTrendSeries(matches, 'kda', 'akari')
assert.equal(kdaSeries.points.length, 3)
assert.equal(kdaSeries.points[0].id, matches[2].id, 'trend ordered oldest first')
assert.equal(kdaSeries.points[2].id, matches[0].id)
assert.equal(kdaSeries.valid, 3)
assert.equal(kdaSeries.wins, 3)
assert.ok(kdaSeries.average != null && kdaSeries.average > 0)
assert.equal(formatTrendValue(0.1234, 'damageShare', 'akari'), '12%')
assert.equal(formatTrendValue(null, 'kda', 'sona'), '—')

// 逐场指标取值与缺失值
assert.equal(trendMetricValue(matches[0], 'participation', 'akari'), matches[0].participation)
const broken = [game(9, 4000, [participant('me', 100, 0)])][0]
broken.json.gameDuration = 0
const brokenMatch = toHistoryMatches([broken], 'me')[0]
assert.equal(trendMetricValue(brokenMatch, 'csPerMinute', 'akari'), null)

// 逐场 Akari 趋势分：不含胜率项，上限 16
const trendScore = calculateAkariGameTrendScore(games[0], 'me')
assert.ok(trendScore != null && trendScore >= 0 && trendScore <= 16, 'akari trend score within 0-16')
const sonaSeries = buildTrendSeries(matches, 'score', 'sona')
assert.equal(sonaSeries.valid, 3)
assert.ok(sonaSeries.average != null && sonaSeries.average >= 3 && sonaSeries.average <= 16, 'sona per-game score within 3-16')

// 雷达归一化：Sona 0–100 → 0–1；Akari 按满分权重
const sonaAxes = normalizeSonaBreakdown({ combat: 100, win: 0, damage: 50, economy: 25, objectives: 10, vision: 5, durability: 75, farming: 40 })
assert.equal(sonaAxes.length, 8)
assert.equal(sonaAxes[0].value, 1)
assert.equal(sonaAxes[1].value, 0)
assert.equal(sonaAxes[2].value, 0.5)
const akariAxes = normalizeAkariBreakdown({ kdaScore: 0.5, winRateScore: 1, dmgScore: 3, dmgTakenScore: 1, healingScore: 0, csScore: 2, goldScore: 1.5, participationScore: 1, visionScore: 2 })
assert.equal(akariAxes.length, 9)
assert.equal(akariAxes[0].value, 0.5)
assert.equal(akariAxes[2].value, 1)
assert.equal(akariAxes[4].value, 0)

// 对比：行口径、差值单位、较高方高亮
const allyMatches = toHistoryMatches(games, 'ally-b1')
const rows = buildCompareRows(matches, allyMatches, 12.5, 9.25)
const scoreRow = rows.find((row) => row.key === 'score')!
assert.equal(formatCompareValue(scoreRow.a, 'score', 'akari'), '12.50')
assert.equal(formatCompareDelta(scoreRow, 'akari'), '+3.25')
const winRow = rows.find((row) => row.key === 'winRate')!
assert.equal(formatCompareDelta(winRow, 'akari').endsWith('pp'), true)
assert.equal(compareHighlight(scoreRow), 'a')
assert.equal(compareHighlight({ key: 'x', label: 'x', a: 1, b: 1, format: 'decimal', higherIsBetter: true }), null)
assert.equal(formatCompareValue(null, 'ratio', 'sona'), '—')

// 汇总样本与胜率口径
const summary = summarize(matches)
assert.equal(summary.total, 3)
assert.equal(summary.wins, 3)

console.log(JSON.stringify({
  result: 'passed',
  checks: [
    'moving average skips gaps',
    'trend oldest to newest',
    'missing metric stays missing',
    'akari per-game trend score 0-16',
    'sona per-game score 3-16',
    'sona radar normalized 0-1',
    'akari radar normalized by weight',
    'compare rows and delta units',
    'compare highlight null when equal',
  ],
}))
