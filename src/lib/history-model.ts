import type { SgpGameSummaryLol, SgpParticipantLol } from '@/types/sgp'

export type HistoryOutcome = 'win' | 'loss' | 'remake' | 'abort' | 'unknown'
export interface HistoryMatch {
  game: SgpGameSummaryLol
  player: SgpParticipantLol
  id: string
  duration: number
  outcome: HistoryOutcome
  position: string
  kda: number | null
  cs: number | null
  csPerMinute: number | null
  damageShare: number | null
  takenShare: number | null
  goldShare: number | null
  participation: number | null
}

export const POSITION_NAMES: Record<string, string> = {
  TOP: '上单', JUNGLE: '打野', MIDDLE: '中单', BOTTOM: '下路', UTILITY: '辅助', ARAM: '大乱斗', UNKNOWN: '未识别',
}

/** Missing measurements stay missing. In particular the upstream LCU adapter synthesizes these zeros. */
export function metric(player: SgpParticipantLol, key: keyof SgpParticipantLol, game?: SgpGameSummaryLol): number | null {
  if (game?.sonaDataSource === 'lcu' && ['totalDamageShieldedOnTeammates', 'totalHealsOnTeammates', 'totalTimeSpentDead'].includes(key)) return null
  return finite(player[key])
}

export function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function mean(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

export function numberText(value: number | null | undefined, decimals = 0): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

export function percentText(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`
}

export function durationText(seconds: number): string {
  return seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—'
}

export function riotName(player: SgpParticipantLol): string {
  const name = player.riotIdGameName || player.summonerName || ''
  return name ? `${name}${player.riotIdTagline ? `#${player.riotIdTagline}` : ''}` : '未知玩家'
}

export function teamKey(player: SgpParticipantLol, game: SgpGameSummaryLol): number {
  return game.json.gameMode === 'CHERRY' && player.playerSubteamId > 0 ? player.playerSubteamId : player.teamId
}

export function teamMembers(player: SgpParticipantLol, game: SgpGameSummaryLol): SgpParticipantLol[] {
  const key = teamKey(player, game)
  return game.json.participants.filter((candidate) => teamKey(candidate, game) === key)
}

export function share(player: SgpParticipantLol, key: keyof SgpParticipantLol, game: SgpGameSummaryLol): number | null {
  const value = metric(player, key, game)
  const values = teamMembers(player, game).map((member) => metric(member, key, game))
  if (value == null || !values.length || values.some((item) => item == null)) return null
  const total = values.reduce<number>((sum, item) => sum + (item ?? 0), 0)
  return total > 0 ? value / total : null
}

export function getPosition(player: SgpParticipantLol, game: SgpGameSummaryLol): string {
  if (game.json.mapId === 12) return 'ARAM'
  const raw = (player.teamPosition || player.individualPosition || player.lane || '').toUpperCase()
  if (raw === 'BOTTOM' || raw === 'BOT') return player.role === 'DUO_SUPPORT' ? 'UTILITY' : 'BOTTOM'
  if (['UTILITY', 'SUPPORT'].includes(raw)) return 'UTILITY'
  if (['MID', 'MIDDLE'].includes(raw)) return 'MIDDLE'
  return ['TOP', 'JUNGLE'].includes(raw) ? raw : 'UNKNOWN'
}

export function getOutcome(game: SgpGameSummaryLol, player: SgpParticipantLol): HistoryOutcome {
  const result = game.json.endOfGameResult || ''
  if (/abort|cancel/i.test(result)) return 'abort'
  if (/remake/i.test(result) || (game.json.gameDuration <= 300 && player.gameEndedInEarlySurrender === true)) return 'remake'
  return player.win === true ? 'win' : player.win === false ? 'loss' : 'unknown'
}

export function toHistoryMatches(games: SgpGameSummaryLol[], puuid: string): HistoryMatch[] {
  const seen = new Set<string>()
  return games.flatMap((game) => {
    const player = game.json?.participants?.find((item) => item.puuid === puuid)
    if (!player) return []
    const id = `${game.json.platformId || ''}:${game.json.gameId}`
    if (seen.has(id)) return []
    seen.add(id)
    const duration = finite(game.json.gameDuration) ?? 0
    const kills = metric(player, 'kills', game), deaths = metric(player, 'deaths', game), assists = metric(player, 'assists', game)
    const minions = metric(player, 'totalMinionsKilled', game), monsters = metric(player, 'neutralMinionsKilled', game)
    const cs = minions != null && monsters != null ? minions + monsters : null
    const allies = teamMembers(player, game)
    const allKills = allies.map((p) => metric(p, 'kills', game))
    const teamKills = allKills.some((v) => v == null) ? null : allKills.reduce<number>((sum, v) => sum + (v ?? 0), 0)
    return [{
      game, player, id, duration, outcome: getOutcome(game, player), position: getPosition(player, game),
      kda: kills != null && deaths != null && assists != null ? (kills + assists) / Math.max(1, deaths) : null,
      cs, csPerMinute: cs != null && duration > 0 ? cs / (duration / 60) : null,
      damageShare: share(player, 'totalDamageDealtToChampions', game),
      takenShare: share(player, 'totalDamageTaken', game), goldShare: share(player, 'goldEarned', game),
      participation: kills != null && assists != null && teamKills != null ? (teamKills > 0 ? Math.min(1, (kills + assists) / teamKills) : 0) : null,
    }]
  }).sort((a, b) => b.game.json.gameCreation - a.game.json.gameCreation)
}

export function validMatches(matches: HistoryMatch[]): HistoryMatch[] {
  return matches.filter((match) => match.outcome === 'win' || match.outcome === 'loss')
}

export function summarize(matches: HistoryMatch[]) {
  const valid = validMatches(matches)
  const wins = valid.filter((m) => m.outcome === 'win').length
  const avgMetric = (key: keyof SgpParticipantLol) => mean(valid.map((m) => metric(m.player, key, m.game)))
  let streak = 0
  if (valid.length) for (const match of valid) {
    if (match.outcome !== valid[0].outcome) break
    streak++
  }
  return {
    total: valid.length, wins, losses: valid.length - wins, excluded: matches.length - valid.length,
    winRate: valid.length ? wins / valid.length : null, kda: mean(valid.map((m) => m.kda)),
    avgK: avgMetric('kills'), avgD: avgMetric('deaths'), avgA: avgMetric('assists'),
    participation: mean(valid.map((m) => m.participation)), damageShare: mean(valid.map((m) => m.damageShare)),
    takenShare: mean(valid.map((m) => m.takenShare)), goldShare: mean(valid.map((m) => m.goldShare)),
    csPerMinute: mean(valid.map((m) => m.csPerMinute)), damage: avgMetric('totalDamageDealtToChampions'),
    taken: avgMetric('totalDamageTaken'), gold: avgMetric('goldEarned'), vision: avgMetric('visionScore'),
    healing: avgMetric('totalHealsOnTeammates'), shielding: avgMetric('totalDamageShieldedOnTeammates'),
    blue: valid.filter((m) => m.player.teamId === 100).length, red: valid.filter((m) => m.player.teamId === 200).length,
    streak: valid.length ? `${streak} 连${valid[0].outcome === 'win' ? '胜' : '败'}` : '暂无样本',
  }
}

export function championStats(matches: HistoryMatch[]) {
  const groups = new Map<number, HistoryMatch[]>()
  validMatches(matches).forEach((match) => {
    const items = groups.get(match.player.championId) ?? []
    items.push(match); groups.set(match.player.championId, items)
  })
  return Array.from(groups, ([id, games]) => ({ id, games, ...summarize(games) }))
    .sort((a, b) => b.total - a.total || (b.winRate ?? 0) - (a.winRate ?? 0))
}

export function encounters(matches: HistoryMatch[], relation: 'ally' | 'enemy') {
  const people = new Map<string, { puuid: string; name: string; championId: number; count: number; wins: number; losses: number }>()
  for (const match of validMatches(matches)) {
    const seen = new Set<string>()
    for (const player of match.game.json.participants) {
      if (!player.puuid || player.puuid === match.player.puuid || seen.has(player.puuid)) continue
      seen.add(player.puuid)
      const same = teamKey(player, match.game) === teamKey(match.player, match.game)
      if (same !== (relation === 'ally')) continue
      const entry = people.get(player.puuid) ?? { puuid: player.puuid, name: riotName(player), championId: player.championId, count: 0, wins: 0, losses: 0 }
      entry.count++; if (match.outcome === 'win') entry.wins++; else entry.losses++
      people.set(player.puuid, entry)
    }
  }
  return [...people.values()].sort((a, b) => b.count - a.count || b.wins - a.wins)
}

export function matchBadges(match: HistoryMatch) {
  const result: Array<{ text: string; detail: string; tone: string }> = []
  const { player, game } = match
  const maxima: Array<[keyof SgpParticipantLol, string, string]> = [
    ['totalDamageDealtToChampions', '伤害', 'red'], ['totalDamageTaken', '承伤', 'blue'],
    ['totalHealsOnTeammates', '治疗', 'green'], ['totalDamageShieldedOnTeammates', '护盾', 'blue'],
    ['timeCCingOthers', '控制', 'purple'], ['visionScore', '视野', 'green'],
  ]
  for (const [key, label, tone] of maxima) {
    const value = metric(player, key, game)
    const values = teamMembers(player, game).map((p) => metric(p, key, game))
    if (value != null && value > 0 && values.every((v) => v != null) && value >= Math.max(...values as number[])) result.push({ text: `${label}首位`, detail: `本场队内${label}最高（可能并列）；${numberText(value, key === 'timeCCingOthers' ? 1 : 0)}`, tone })
  }
  const solo = finite(player.challenges?.soloKills)
  if (solo != null && solo > 0) result.push({ text: `单杀 ×${solo}`, detail: '来自本场对局的单杀统计', tone: 'purple' })
  for (const [key, label] of [['pentaKills', '五杀'], ['quadraKills', '四杀'], ['tripleKills', '三杀'], ['doubleKills', '双杀']] as const) {
    const value = metric(player, key, game)
    if (value != null && value > 0) { result.push({ text: `${label}${value > 1 ? ` ×${value}` : ''}`, detail: `本场${label}次数：${value}`, tone: 'red' }); break }
  }
  return result
}
