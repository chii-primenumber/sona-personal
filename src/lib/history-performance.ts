import { finite, mean, metric, numberText, percentText, share, validMatches, type HistoryMatch } from './history-model'
import type { SgpGameSummaryLol, SgpParticipantLol } from '@/types/sgp'

export type PerformanceSection = 'team' | 'history' | 'report'
export type PerformanceSelection = Partial<Record<PerformanceSection, string[]>>
export const DEFAULT_PERFORMANCE_FIELDS: PerformanceSelection = { team: ['damageGold'], history: [], report: [] }
type PerformanceMatch = Pick<HistoryMatch, 'player' | 'game' | 'duration' | 'cs' | 'csPerMinute'>
export interface PerformanceStat {
  key: string; label: string; short: string; group: string; definition: string; decimals: number; percent?: boolean
  sections: PerformanceSection[]; read: (match: PerformanceMatch) => number | null
}
const value = (key: keyof SgpParticipantLol) => (m: PerformanceMatch) => metric(m.player, key, m.game)
const perMinute = (key: keyof SgpParticipantLol) => (m: PerformanceMatch) => {
  const amount = metric(m.player, key, m.game)
  return amount != null && m.duration > 0 ? amount * 60 / m.duration : null
}
const ratio = (numerator: keyof SgpParticipantLol, denominator: keyof SgpParticipantLol) => (m: PerformanceMatch) => {
  const a = metric(m.player, numerator, m.game), b = metric(m.player, denominator, m.game)
  return a != null && b != null && b > 0 ? a / b : null
}
const all: PerformanceSection[] = ['team','history','report']
const teamHistory: PerformanceSection[] = ['team','history']
function stat(key: string, label: string, short: string, group: string, read: PerformanceStat['read'], definition: string,
  decimals = 0, percent = false, sections: PerformanceSection[] = all): PerformanceStat {
  return {key,label,short,group,read,definition,decimals,percent,sections}
}

export const PERFORMANCE_STATS: PerformanceStat[] = [
  stat('damageGold','伤转率','伤转','输出与经济',ratio('totalDamageDealtToChampions','goldEarned'),'对英雄伤害 ÷ 获得金币；近期数据取逐场比值的平均',0,true),
  stat('damageMinute','分均对英雄伤害','伤害/分','输出与经济',perMinute('totalDamageDealtToChampions'),'对英雄伤害 ÷ 对局分钟数'),
  stat('takenMinute','分均承受伤害','承伤/分','输出与经济',perMinute('totalDamageTaken'),'承受伤害 ÷ 对局分钟数'),
  stat('goldMinute','分均金币','金币/分','输出与经济',perMinute('goldEarned'),'获得金币 ÷ 对局分钟数'),
  stat('damage','对英雄伤害','伤害','输出与经济',value('totalDamageDealtToChampions'),'近期有效对局的场均对英雄伤害',0,false,['team']),
  stat('taken','承受伤害','承伤','输出与经济',value('totalDamageTaken'),'近期有效对局的场均承受伤害',0,false,['team']),
  stat('gold','获得金币','金币','输出与经济',value('goldEarned'),'近期有效对局的场均获得金币',0,false,['team']),
  stat('physicalShare','物理伤害构成','物理','输出与经济',ratio('physicalDamageDealtToChampions','totalDamageDealtToChampions'),'物理对英雄伤害 ÷ 总对英雄伤害',0,true),
  stat('magicShare','魔法伤害构成','魔法','输出与经济',ratio('magicDamageDealtToChampions','totalDamageDealtToChampions'),'魔法对英雄伤害 ÷ 总对英雄伤害',0,true),
  stat('trueShare','真实伤害构成','真伤','输出与经济',ratio('trueDamageDealtToChampions','totalDamageDealtToChampions'),'真实对英雄伤害 ÷ 总对英雄伤害',0,true),
  stat('kills','击杀数','击杀','击杀与生存',value('kills'),'近期有效对局的场均击杀',1,false,teamHistory),
  stat('deaths','死亡数','死亡','击杀与生存',value('deaths'),'近期有效对局的场均死亡',1,false,teamHistory),
  stat('assists','助攻数','助攻','击杀与生存',value('assists'),'近期有效对局的场均助攻',1,false,teamHistory),
  stat('killShare','队内击杀占比','击杀占比','击杀与生存',(m)=>share(m.player,'kills',m.game),'个人击杀 ÷ 队伍击杀',0,true),
  stat('soloKills','单杀数','单杀','击杀与生存',(m)=>finite(m.player.challenges?.soloKills),'接口返回的单杀次数，近期数据取场均',1),
  stat('doubleKills','双杀次数','双杀','击杀与生存',value('doubleKills'),'本场双杀次数，近期数据取场均',1),
  stat('tripleKills','三杀次数','三杀','击杀与生存',value('tripleKills'),'本场三杀次数，近期数据取场均',1),
  stat('quadraKills','四杀次数','四杀','击杀与生存',value('quadraKills'),'本场四杀次数，近期数据取场均',1),
  stat('pentaKills','五杀次数','五杀','击杀与生存',value('pentaKills'),'本场五杀次数，近期数据取场均',1),
  stat('deadSeconds','死亡时长（秒）','死亡秒数','击杀与生存',value('totalTimeSpentDead'),'死亡总时长；近期数据取场均秒数',1),
  stat('deadShare','死亡时长占比','死亡占比','击杀与生存',(m)=>{
    const seconds=metric(m.player,'totalTimeSpentDead',m.game)
    return seconds != null && m.duration > 0 ? seconds/m.duration : null
  },'死亡总时长 ÷ 对局总时长',0,true),
  stat('mitigated','减免伤害','减伤','击杀与生存',value('damageSelfMitigated'),'接口返回的减免伤害；近期数据取场均'),
  stat('cs','补刀数','补刀','补刀与地图资源',(m)=>m.cs,'小兵与野怪补刀之和；近期数据取场均',1,false,teamHistory),
  stat('csMinute','分均补刀','补刀/分','补刀与地图资源',(m)=>m.csPerMinute,'小兵与野怪补刀之和 ÷ 对局分钟数',1,false,['team']),
  stat('neutralCs','野怪补刀','野怪','补刀与地图资源',value('neutralMinionsKilled'),'接口返回的野怪补刀；近期数据取场均',1),
  stat('objectives','目标伤害','目标伤害','补刀与地图资源',value('damageDealtToObjectives'),'对地图目标造成的伤害；近期数据取场均',0,false,teamHistory),
  stat('turretDamage','防御塔伤害','推塔伤害','补刀与地图资源',value('damageDealtToTurrets'),'对防御塔造成的伤害；近期数据取场均',0,false,teamHistory),
  stat('turretKills','摧毁防御塔数','推塔','补刀与地图资源',value('turretKills'),'接口返回的个人摧毁防御塔数；近期数据取场均',1),
  stat('stolen','抢夺地图目标数','抢目标','补刀与地图资源',value('objectivesStolen'),'接口返回的抢夺地图目标数；近期数据取场均',1),
  stat('heal','总治疗','治疗','治疗、控制与视野',value('totalHeal'),'治疗自身及友方的总量；近期数据取场均',0,false,teamHistory),
  stat('allyHeal','友方治疗','友疗','治疗、控制与视野',value('totalHealsOnTeammates'),'对友方的治疗量；近期数据取场均',0,false,['team']),
  stat('shield','友方护盾','护盾','治疗、控制与视野',value('totalDamageShieldedOnTeammates'),'为友方抵挡的伤害；近期数据取场均',0,false,['team']),
  stat('control','控制时间（秒）','控制秒数','治疗、控制与视野',value('timeCCingOthers'),'接口返回的对英雄控制时间；近期数据取场均秒数',1,false,teamHistory),
  stat('vision','视野得分','视野','治疗、控制与视野',value('visionScore'),'接口返回的视野得分；近期数据取场均',1,false,['team']),
  stat('visionMinute','分均视野得分','视野/分','治疗、控制与视野',perMinute('visionScore'),'视野得分 ÷ 对局分钟数',1),
  stat('wards','插眼数量','插眼','治疗、控制与视野',value('wardsPlaced'),'接口返回的插眼数；近期数据取场均',1,false,teamHistory),
  stat('wardsKilled','排眼数量','排眼','治疗、控制与视野',value('wardsKilled'),'接口返回的排眼数；近期数据取场均',1,false,teamHistory),
  stat('controlWards','真眼购买数','真眼','治疗、控制与视野',value('visionWardsBoughtInGame'),'接口返回的真眼购买数量；近期数据取场均',1),
]

export function performanceText(stat: PerformanceStat, amount: number | null): string {
  return stat.percent ? percentText(amount) : numberText(amount,stat.decimals)
}

export function performanceMatchForPlayer(game: SgpGameSummaryLol, player: SgpParticipantLol): PerformanceMatch {
  const duration = finite(game.json.gameDuration) ?? 0
  const minions = metric(player,'totalMinionsKilled',game), monsters = metric(player,'neutralMinionsKilled',game)
  const cs = minions != null && monsters != null ? minions + monsters : null
  return { game,player,duration,cs,csPerMinute:cs != null && duration > 0 ? cs * 60 / duration : null }
}

export function performanceSummary(matches: HistoryMatch[], keys: string[], section: PerformanceSection) {
  const games = validMatches(matches)
  return PERFORMANCE_STATS.filter((stat)=>stat.sections.includes(section) && keys.includes(stat.key)).map((stat)=>{
    const values = games.map(stat.read).filter((amount): amount is number => amount != null && Number.isFinite(amount))
    return {stat,value:mean(values),count:values.length}
  })
}
