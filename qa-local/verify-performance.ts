import assert from 'node:assert/strict'
import { PERFORMANCE_STATS, performanceSummary, performanceText, performanceMatchForPlayer } from '../src/lib/history-performance'
import { toHistoryMatches } from '../src/lib/history-model'
import type { SgpGameSummaryLol, SgpParticipantLol } from '../src/types/sgp'

function game(id: number, duration: number, damage: number | undefined, gold: number, remake = false): SgpGameSummaryLol {
  const player = {puuid:'tested',participantId:1,teamId:100,kills:2,deaths:1,assists:3,win:true,
    totalDamageDealtToChampions:damage,goldEarned:gold,totalMinionsKilled:40,neutralMinionsKilled:10,
    totalHealsOnTeammates:0,totalTimeSpentDead:0,visionScore:0} as SgpParticipantLol
  return {json:{gameId:id,platformId:'TEST',gameCreation:id,gameDuration:duration,endOfGameResult:remake?'Remake':'GameComplete',participants:[player]}} as SgpGameSummaryLol
}
const matches = toHistoryMatches([game(1,600,12000,6000),game(2,1200,6000,12000),game(3,120,999999,1,true)],'tested')
const results = new Map(performanceSummary(matches,['damageGold','damageMinute','goldMinute','allyHeal','vision'],'team').map((row)=>[row.stat.key,row]))
assert.equal(results.get('damageGold')!.value,1.25)
assert.equal(performanceText(results.get('damageGold')!.stat,1.25),'125%')
assert.equal(results.get('damageMinute')!.value,750)
assert.equal(results.get('goldMinute')!.value,600)
assert.equal(results.get('allyHeal')!.value,0)
assert.equal(results.get('vision')!.value,0)
assert.equal(results.get('damageGold')!.count,2)
const invalid = toHistoryMatches([game(4,0,10,0),game(5,600,undefined,10)],'tested')
for (const row of performanceSummary(invalid,['damageGold','damageMinute'],'team')) {
  if (row.stat.key === 'damageGold') assert.equal(row.value,null)
  if (row.stat.key === 'damageMinute') assert.equal(row.value,null)
}
const native = game(6,600,500,200); native.sonaDataSource='lcu'
native.json.participants[0].totalHealsOnTeammates=999
for (const row of performanceSummary(toHistoryMatches([native],'tested'),['allyHeal','deadSeconds','deadShare'],'team')) assert.equal(row.value,null)
const player = {...native.json.participants[0],puuid:'',goldEarned:100,totalDamageDealtToChampions:300}
assert.equal(PERFORMANCE_STATS.find((stat)=>stat.key==='damageGold')!.read(performanceMatchForPlayer(native,player)),3)
assert.equal(new Set(PERFORMANCE_STATS.map((stat)=>stat.key)).size,PERFORMANCE_STATS.length)
console.log(JSON.stringify({result:'passed',stats:PERFORMANCE_STATS.length,checks:['mean of per-game ratios','remakes excluded','zero retained','missing and zero denominators','native unsupported data','participant identity']}))
