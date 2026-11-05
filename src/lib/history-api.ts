import { lcu, queueIdToTag } from '@/lib/lcu'
import type { SummonerInfo } from '@/types/lcu'
import type { SgpMatchHistoryLol } from '@/types/sgp'

export interface HistoryRank {
  key: string; label: string; tier: string; division: string; lp: number | null; wins: number | null; losses: number | null
}
export interface HistoryMastery { championId: number; championLevel: number; championPoints: number; lastPlayTime?: number }

/** Bound both network time and preflight work; switching players aborts the page request. */
export async function deadline<T>(execute: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal, ms = 18000): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  let rejectAbort: (error: Error) => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
  const onAbort = () => {
    controller.abort()
    rejectAbort(new DOMException('查询已取消', 'AbortError'))
  }
  if (parent?.aborted) throw new DOMException('查询已取消', 'AbortError')
  parent?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true; controller.abort(); rejectAbort(new Error('查询超时，请重试'))
  }, ms)
  try {
    return await Promise.race([execute(controller.signal), aborted])
  } catch (error) {
    if (timedOut) throw new Error('查询超时，请重试')
    throw error
  } finally {
    clearTimeout(timer); parent?.removeEventListener('abort', onAbort)
  }
}

export function fetchHistoryPage(puuid: string, queueId: number, startIndex: number, count = 20, signal?: AbortSignal): Promise<SgpMatchHistoryLol> {
  return deadline(async (requestSignal) => {
    const response = await lcu.getSgpMatchHistory(puuid, { startIndex, count, tag: queueIdToTag(queueId) || undefined, signal: requestSignal })
    if (!Array.isArray(response?.games)) throw new Error('战绩接口返回的数据格式异常')
    return response
  }, signal)
}

async function readJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return deadline(async (requestSignal) => {
    const response = await fetch(endpoint, { signal: requestSignal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`数据暂不可用 (${response.status})`)
    return response.json() as Promise<T>
  }, signal, 10000)
}

export function fetchHistorySummoner(puuid: string, signal?: AbortSignal) {
  return readJson<SummonerInfo>(`/lol-summoner/v2/summoners/puuid/${encodeURIComponent(puuid)}`, signal)
}

export async function fetchHistoryRanks(puuid: string, signal?: AbortSignal): Promise<HistoryRank[]> {
  const response = await readJson<{ queueMap?: Record<string, Record<string, unknown>> }>(`/lol-ranked/v1/ranked-stats/${encodeURIComponent(puuid)}`, signal)
  if (!response || typeof response !== 'object' || !response.queueMap) throw new Error('段位数据暂不可用')
  return [['RANKED_SOLO_5x5', '单双排位'], ['RANKED_FLEX_SR', '灵活排位']].map(([key, label]) => {
    const rank = response.queueMap?.[key] ?? {}
    const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
    return { key, label, tier: String(rank.tier || 'UNRANKED'), division: String(rank.division || ''), lp: num(rank.leaguePoints), wins: num(rank.wins), losses: num(rank.losses) }
  })
}

export async function fetchHistoryMastery(puuid: string, signal?: AbortSignal): Promise<HistoryMastery[]> {
  const response = await readJson<HistoryMastery[] | { masteries: HistoryMastery[] }>(`/lol-champion-mastery/v1/${encodeURIComponent(puuid)}/champion-mastery`, signal)
  const entries = Array.isArray(response) ? response : response?.masteries
  if (!Array.isArray(entries)) throw new Error('英雄点数暂不可用')
  return entries.filter((m) => m && m.championId > 0 && typeof m.championPoints === 'number').sort((a, b) => b.championPoints - a.championPoints)
}

export const RANK_NAMES: Record<string, string> = { IRON: '坚韧黑铁', BRONZE: '英勇黄铜', SILVER: '不屈白银', GOLD: '荣耀黄金', PLATINUM: '华贵铂金', EMERALD: '流光翡翠', DIAMOND: '璀璨钻石', MASTER: '超凡大师', GRANDMASTER: '傲世宗师', CHALLENGER: '最强王者', UNRANKED: '未定级' }
export function rankText(rank: HistoryRank): string { return `${RANK_NAMES[rank.tier] || rank.tier}${rank.division && rank.division !== 'NA' ? ` ${rank.division}` : ''}` }
