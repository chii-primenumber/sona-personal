export const HISTORY_DISPLAY_FIELDS = {
  team: [
    ['teamSummary', '队伍平均胜率与 KDA'],
    ['ranks', '单双排和灵活组排'],
    ['selection', '本局英雄、分路和组队标记'],
    ['winRate', '近期胜率与样本数'],
    ['kda', '近期 KDA'],
    ['streak', '连胜／连败'],
    ['participation', '参团率'],
    ['damage', '伤害占比'],
    ['taken', '承伤占比'],
    ['gold', '经济占比'],
    ['score', 'Sona 参考分'],
    ['champions', '常玩英雄'],
    ['recent', '最近对局'],
  ],
  history: [
    ['ranks', '段位与最高段位'],
    ['summary', '近期总览'],
    ['champions', '近期常玩英雄'],
    ['mastery', '英雄点数'],
    ['teammates', '最近队友'],
    ['opponents', '最近对手'],
    ['kda', '对局卡片的 KDA 与参团率'],
    ['damage', '对局卡片的伤害与占比'],
    ['cs', '对局卡片的补刀'],
    ['gold', '对局卡片的金币与占比'],
    ['items', '对局卡片的装备'],
    ['spells', '对局卡片的符文与技能'],
    ['augments', '对局卡片的海克斯'],
    ['badges', '最高输出等表现标签'],
    ['roster', '对局卡片的双方阵容'],
  ],
  report: [
    ['kda', '击杀、死亡与助攻'],
    ['items', '装备'],
    ['spells', '符文与技能'],
    ['augments', '海克斯'],
    ['damage', '伤害与占比'],
    ['taken', '承伤与占比'],
    ['gold', '经济与占比'],
    ['bars', '伤害、承伤与经济条'],
    ['cs', '补刀与每分钟补刀'],
    ['participation', '参团率'],
    ['heal', '总治疗'],
    ['allyHeal', '友方治疗与护盾'],
    ['control', '控制时间'],
    ['vision', '视野、插眼与排眼'],
    ['objectives', '目标与防御塔伤害'],
  ],
} as const

export type HistoryDisplaySection = keyof typeof HISTORY_DISPLAY_FIELDS
export type HistoryDisplayField<S extends HistoryDisplaySection> = typeof HISTORY_DISPLAY_FIELDS[S][number][0]
export type HistoryHiddenFields = Partial<Record<HistoryDisplaySection, string[]>>

export function isHistoryFieldVisible<S extends HistoryDisplaySection>(
  hidden: HistoryHiddenFields,
  section: S,
  field: HistoryDisplayField<S>,
): boolean {
  const excluded = hidden?.[section]
  return !Array.isArray(excluded) || !excluded.includes(field)
}
