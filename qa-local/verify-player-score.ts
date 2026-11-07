import assert from 'node:assert/strict'
import { calculateAkariPlayerScore } from '../src/lib/akari-score'
import { computeSingleSummary } from './fixtures/akari/analysis/player/single/summary'
import { computeAggregatedAkariScore } from './fixtures/akari/analysis/player/aggregate/akari'
import type { SgpGameSummaryLol, SgpParticipantLol } from '../src/types/sgp'

function game(index: number, mode = 'CLASSIC'): SgpGameSummaryLol {
  const duration = 900 + index * 37
  const participants = Array.from({length:10},(_,i)=>({
    puuid:`player-${i}`,participantId:i+1,teamId:i<5?100:200,championId:16+i,teamPosition:'UTILITY',
    playerSubteamId:mode==='CHERRY'?Math.floor(i/2)+1:0,win:i<5,kills:(i*3+index)%17,deaths:(i+index)%9,assists:(i*7+index)%25,
    totalDamageDealtToChampions:1000+(i*713+index*379)%39000,totalDamageTaken:3000+i*1731+index*51,
    goldEarned:5000+i*493+index*337,totalHeal:i*981+index*563,visionScore:index%3===0?0:i*5,
    totalMinionsKilled:40+i*9+index*11,neutralMinionsKilled:i*2,
    damageDealtToTurrets:0,damageDealtToObjectives:0,damageSelfMitigated:0,totalHealsOnTeammates:0,totalDamageShieldedOnTeammates:0,
    wardsPlaced:0,wardsKilled:0,detectorWardsPlaced:0,turretTakedowns:0,timePlayed:duration,challenges:{},
  } as unknown as SgpParticipantLol))
  return {metadata:{tags:[]},json:{gameId:index+1,gameDuration:duration,gameCreation:index*100000,queueId:mode==='CHERRY'?1700:420,
    gameType:'MATCHED_GAME',gameMode:mode,mapId:11,endOfGameResult:'GameComplete',participants}} as SgpGameSummaryLol
}
function upstream(games: SgpGameSummaryLol[], puuid: string) {
  const subjects: SgpParticipantLol[] = []
  const prepared = games.map((g)=>{
    const mapped = g.json.participants.map((p)=>({...p,cs:p.totalMinionsKilled+p.neutralMinionsKilled,
      totalDamageToTowers:p.damageDealtToTurrets,kda:(p.kills+p.assists)/(p.deaths||1),winResult:p.win?'win':'loss'}))
    const subject = mapped.find((p)=>p.puuid===puuid)!
    subjects.push(subject)
    const team = mapped.filter((p)=>g.json.gameMode==='CHERRY'?p.playerSubteamId===subject.playerSubteamId:p.teamId===subject.teamId)
    return {single:{summary:computeSingleSummary(g.json as never,subject as never,team as never,mapped as never)}}
  })
  const deaths = subjects.reduce((n,p)=>n+p.deaths,0)
  return computeAggregatedAkariScore({count:games.length,games:prepared,
    summary:{avgKda:subjects.reduce((n,p)=>n+p.kills+p.assists,0)/(deaths||1),winRate:subjects.filter((p)=>p.win).length/games.length}} as never)
}
let comparisons = 0
for (const mode of ['CLASSIC','ARAM','CHERRY']) for (const count of [1,2,8,20]) for (const player of ['player-0','player-4','player-9']) {
  const games = Array.from({length:count},(_,i)=>game(i,mode))
  const actual = calculateAkariPlayerScore(games,player)!, expected = upstream(games,player)
  assert.ok(Math.abs(actual.score-expected.total)<1e-10,`${mode}/${count}/${player}`)
  for (const key of Object.keys(actual.breakdown) as Array<keyof typeof actual.breakdown>) assert.ok(Math.abs(actual.breakdown[key]-expected[key])<1e-10,key)
  assert.equal(actual.outstanding,expected.outstanding)
  assert.equal(actual.extraordinary,expected.extraordinary)
  comparisons++
}
const samples = [game(1),game(2)]
samples[0].json.participants[0].kills=20;samples[0].json.participants[0].deaths=0
samples[1].json.participants[0].kills=0;samples[1].json.participants[0].deaths=20
assert.ok(Math.abs(calculateAkariPlayerScore(samples,'player-0')!.score-upstream(samples,'player-0').total)<1e-10)
for (const edit of [
  (g:SgpGameSummaryLol)=>{g.json.endOfGameResult='Remake'},
  (g:SgpGameSummaryLol)=>{g.json.endOfGameResult='Aborted'},
  (g:SgpGameSummaryLol)=>{g.json.gameType='CUSTOM_GAME'},
  (g:SgpGameSummaryLol)=>{g.json.queueId=830},
  (g:SgpGameSummaryLol)=>{g.json.gameDuration=0},
  (g:SgpGameSummaryLol)=>{g.json.participants[1].goldEarned=NaN},
]) { const g=game(1);edit(g);assert.equal(calculateAkariPlayerScore([g],'player-0'),null) }
assert.equal(calculateAkariPlayerScore([],'player-0'),null)
const noVision=game(1);for(const p of noVision.json.participants) delete (p as Partial<SgpParticipantLol>).visionScore
assert.ok(Math.abs(calculateAkariPlayerScore([noVision],'player-0')!.score-upstream([noVision],'player-0').total)<1e-10)
const saved = new Map<string,unknown>()
Object.assign(globalThis,{DataStore:{get:(key:string)=>saved.get(key),set:(key:string,value:unknown)=>saved.set(key,value)},document:{documentElement:{lang:'zh-CN'}}})
const {store}=await import('../src/lib/store')
const {calculatePlayerScore,getPlayerScoreSystem}=await import('../src/lib/player-score')
const {calculateSonaPlayerStrengthScore}=await import('../src/lib/player-strength-score')
assert.equal(getPlayerScoreSystem(),'akari')
assert.equal(calculatePlayerScore([game(1)],'player-0')!.system,'akari')
store.set('playerScoreSystem','sona')
assert.equal(calculatePlayerScore([game(1)],'player-0')!.score,calculateSonaPlayerStrengthScore([game(1)],'player-0')!.score)
assert.equal(saved.get('sona:playerScoreSystem'),'sona')
console.log(JSON.stringify({result:'passed',upstreamComparisons:comparisons,checks:['nine original components','aggregate KDA','CLASSIC/ARAM/CHERRY','filters and invalid data','missing vision','saved global selection','unchanged Sona calculation']}))
