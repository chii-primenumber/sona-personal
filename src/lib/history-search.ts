import { deadline } from '@/lib/history-api'
import { lcu, TENCENT_MATCH_HISTORY_INTEROP, TENCENT_SERVER_NAMES, type SgpSummonerLite } from '@/lib/lcu'
import { store } from '@/lib/store'
import type { ChatFriend } from '@/types/lcu'

export interface HistoryPlayer {
  puuid: string
  name: string
  serverId?: string
  iconId?: number
  level?: number
  availability?: string
}

type PlayerQuery =
  | { kind: 'name' | 'puuid'; value: string }
  | { kind: 'riotId'; value: string; tag: string }

const PUUID = /^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[A-Za-z0-9_-]{60,100})$/i

// Original server names shown in the League Akari 1.4.3 region reference.
export const TENCENT_MERGED_SERVERS = [
  ['TENCENT_NJ100', '均衡教派、巨神峰、教育网、男爵领域、皮尔特沃夫、守望之海、影流、祖安'],
  ['TENCENT_GZ100', '暗影岛、卡拉曼达、雷瑟守备、诺克萨斯、征服之海、战争学院'],
  ['TENCENT_CQ100', '班德尔城、裁决之地、钢铁烈阳、皮城警备、水晶之痕'],
  ['TENCENT_TJ100', '比尔吉沃特、弗雷尔卓德、扭曲丛林'],
  ['TENCENT_TJ101', '德玛西亚、巨龙之巢、恕瑞玛、无畏先锋'],
] as const

export function parsePlayerQuery(query: string): PlayerQuery {
  const text = query.trim()
  const [value, tag, extra] = text.split(/[#＃]/).map((part) => part.trim())
  if (!value || extra !== undefined || tag === '') throw new Error('请输入名字、完整的名字#编号或 PUUID。')
  if (tag) return { kind: 'riotId', value, tag }
  return { kind: PUUID.test(value) ? 'puuid' : 'name', value }
}

export function historyServerName(serverId: string) {
  return TENCENT_SERVER_NAMES[serverId] || serverId
}

export function historySearchServers(current: string) {
  return current.startsWith('TENCENT_')
    ? TENCENT_MATCH_HISTORY_INTEROP.filter((key) => key !== current)
    : []
}

export function historyPlayerLevel(value: unknown): number | undefined {
  if (typeof value === 'string') { if (!/^\d+$/.test(value.trim())) return undefined; value = Number(value) }
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : undefined
}

export function historyPlayerFromSummoner(data: SgpSummonerLite, serverId?: string, fallbackName?: string): HistoryPlayer | null {
  const baseName = data.gameName || data.displayName || data.name
  const name = baseName && data.tagLine && !baseName.includes('#') ? `${baseName}#${data.tagLine}` : baseName || fallbackName
  if (!data.puuid || !name) return null
  return { puuid: data.puuid, name, serverId, iconId: data.profileIconId ?? data.profileIcon, level: historyPlayerLevel(data.summonerLevel ?? data.level) }
}

export function historyPlayerFromFriend(friend: ChatFriend, currentServer: string): HistoryPlayer | null {
  const name = friend.gameName || friend.name
  if (!friend.puuid || !name) return null
  const serverId = historySearchServers(currentServer).find((key) => key === `TENCENT_${friend.platformId?.toUpperCase()}`)
  const gameStatus = friend.lol?.gameStatus
  let availability = friend.availability
  if (availability !== 'offline') {
    if (gameStatus === 'inQueue') availability = 'inQueue'
    if (gameStatus === 'inGame' || gameStatus === 'championSelect') availability = 'dnd'
  }
  return { puuid: friend.puuid, name: [name, friend.gameTag].filter(Boolean).join('#'), iconId: friend.icon,
    availability, serverId, level: historyPlayerLevel(friend.lol?.level) }
}

export function historyPlayerMatches(player: HistoryPlayer, query: string) {
  const needle = query.trim().replace(/\s*[#＃]\s*/g, '#').toLowerCase()
  return player.name.toLowerCase().includes(needle) || player.puuid.toLowerCase() === needle
}

export function rememberHistoryPlayer(player: HistoryPlayer) {
  if (!player.puuid || !player.name || player.name === '未知玩家') return
  const current = store.get('historyRecentPlayers')
  const entries = Array.isArray(current) ? current : []
  const samePlayer = (entry: HistoryPlayer) => entry?.puuid === player.puuid && entry.serverId === player.serverId
  const previous = entries.find(samePlayer)
  const others = entries.filter((entry) => !samePlayer(entry))
  const { puuid, name, serverId, iconId, level } = player
  store.set('historyRecentPlayers', [{ puuid, name, serverId, iconId: iconId ?? previous?.iconId, level: level ?? previous?.level }, ...others].slice(0, 20))
}

async function localLookup(endpoint: string, signal: AbortSignal) {
  const response = await fetch(endpoint, { signal, headers: { Accept: 'application/json' } })
  if ([400, 404, 204].includes(response.status)) return null
  if (!response.ok) throw new Error(`搜索暂不可用 (${response.status})`)
  return response.json() as Promise<SgpSummonerLite | SgpSummonerLite[]>
}

export function searchHistoryPlayers(query: PlayerQuery, serverId: string, parent?: AbortSignal) {
  return deadline(async (signal) => {
    if (query.kind === 'name' || (query.kind === 'riotId' && serverId)) {
      return searchAccountPlayers(query, serverId, signal)
    }
    const encoded = encodeURIComponent(query.value)
    let response: SgpSummonerLite | SgpSummonerLite[] | null
    if (serverId) {
      response = query.kind === 'puuid'
        ? await lcu.getHistorySgpSummoner(serverId, query.value, signal)
        : await lcu.getHistorySummonerByName(serverId, query.value, signal)
    } else {
      const endpoint = query.kind === 'puuid'
        ? `/lol-summoner/v2/summoners/puuid/${encoded}`
        : query.kind === 'riotId'
          ? `/lol-summoner/v1/alias/lookup?gameName=${encoded}&tagLine=${encodeURIComponent(query.tag)}`
          : `/lol-summoner/v1/summoners?name=${encoded}`
      response = await localLookup(endpoint, signal)
    }

    const rows = Array.isArray(response) ? response : response ? [response] : []
    return rows.flatMap((row) => {
      if (!row?.puuid) return []
      if (query.kind === 'riotId') {
        const foundName = row.gameName || row.name || row.displayName || ''
        if (serverId && (foundName.toLowerCase() !== query.value.toLowerCase() ||
          row.tagLine?.toLowerCase() !== query.tag.toLowerCase())) return []
        const tagged = { ...row, gameName: row.gameName || query.value, tagLine: row.tagLine || query.tag }
        const player = historyPlayerFromSummoner(tagged, serverId || undefined)
        return player ? [player] : []
      }
      if (query.kind === 'puuid' && row.puuid.toLowerCase() !== query.value.toLowerCase()) return []
      const player = historyPlayerFromSummoner(row, serverId || undefined, query.kind === 'name' ? query.value : '召唤师')
      return player ? [player] : []
    })
  }, parent, 30000)
}

async function searchAccountPlayers(query: PlayerQuery, serverId: string, signal: AbortSignal) {
  const aliases = await lcu.getRiotAccountAliases(query.value, query.kind === 'riotId' ? query.tag : undefined, signal)
  const accounts = new Map(aliases.map((account) => [account.puuid, account]))
  const ids = [...accounts.keys()]
  const region = serverId || await lcu.getSgpServerId()
  const players: HistoryPlayer[] = []
  for (let start = 0; start < ids.length; start += 16) {
    if (signal.aborted) throw new DOMException('查询已取消', 'AbortError')
    const batch = ids.slice(start, start + 16)
    let profiles: SgpSummonerLite[]
    if (region.startsWith('TENCENT_')) {
      profiles = await lcu.getHistorySgpSummoners(region, batch, signal)
    } else {
      const results = await Promise.all(batch.map(async (id) => {
        const profile = await localLookup(`/lol-summoner/v2/summoners/puuid/${encodeURIComponent(id)}`, signal)
        return Array.isArray(profile) ? profile : profile ? [profile] : []
      }))
      profiles = results.flat()
    }
    for (const profile of profiles) {
      const account = profile?.puuid && accounts.get(profile.puuid)
      if (!account) continue
      const player = historyPlayerFromSummoner({
        ...profile, gameName: account.alias.game_name, tagLine: account.alias.tag_line,
      }, serverId || undefined)
      if (player) players.push(player)
    }
  }
  return players
}
