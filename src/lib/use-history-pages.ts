import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchHistoryPage } from '@/lib/history-api'
import type { SgpGameSummaryLol, SgpMatchHistoryLol } from '@/types/sgp'
import { getHistoryEpoch } from './shared-requests'

interface PageState {
  key: string; games: SgpGameSummaryLol[]; loading: boolean; loadingMore: boolean; hasMore: boolean;
  error: string; source?: 'sgp' | 'lcu' | 'mixed'; scanLimit?: number; updatedAt: number; cursor: number
}
const empty: PageState = { key: '', games: [], loading: true, loadingMore: false, hasMore: true, error: '', updatedAt: 0, cursor: 0 }
const pageCache = new Map<string, PageState>()
function cachedPage(key: string) {
  for (const [id, page] of pageCache) if (Date.now() - page.updatedAt > 45000) pageCache.delete(id)
  const page = pageCache.get(key)
  if (page) { pageCache.delete(key); pageCache.set(key, page) }
  return page
}
function rememberPage(page: PageState) {
  if (page.loading || page.loadingMore || page.error || !page.updatedAt || page.games.length > 600) return
  pageCache.delete(page.key); pageCache.set(page.key, page)
  let size = [...pageCache.values()].reduce((total, value) => total + value.games.length, 0)
  while (pageCache.size > 12 || size > 1200) {
    const key = pageCache.keys().next().value!
    size -= pageCache.get(key)!.games.length; pageCache.delete(key)
  }
}

export function useHistoryPages(puuid: string, queueId: number, count: number, open: boolean, serverId?: string, refreshRevision = 0) {
  const key = `${getHistoryEpoch()}:${serverId ?? ''}:${puuid}:${queueId}:${count}`
  const [state, setState] = useState<PageState>(() => cachedPage(key) ?? empty)
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const nextIndex = useRef(0)
  const busy = useRef(false)
  const forceRefresh = useRef(Boolean(refreshRevision))
  const lastRefreshRevision = useRef(refreshRevision)
  if (lastRefreshRevision.current !== refreshRevision) {
    forceRefresh.current = true; lastRefreshRevision.current = refreshRevision
  }
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const token = ++generation.current
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    const release = () => {
      current.abort()
      if (token === generation.current) { generation.current++; controller.current?.abort(); controller.current = null }
    }
    const saved = forceRefresh.current ? undefined : cachedPage(key)
    forceRefresh.current = false
    if (open && puuid && saved) {
      nextIndex.current = saved.cursor; busy.current = false; setState(saved)
      return release
    }
    nextIndex.current = 0; busy.current = Boolean(open && puuid)
    setState({ ...empty, key, loading: Boolean(open && puuid) })
    if (!open || !puuid) return release
    fetchHistoryPage(puuid, queueId, 0, count, current.signal, serverId).then((response) => {
      if (token !== generation.current || current.signal.aborted) return
      const games = response.games || []
      nextIndex.current = games.length
      const page = { key, games, loading: false, loadingMore: false, hasMore: games.length >= count, error: '', source: response.sonaSource, scanLimit: response.sonaScanLimit, updatedAt: Date.now(), cursor: nextIndex.current }
      rememberPage(page); setState(page)
    }).catch((error) => {
      if (token !== generation.current || current.signal.aborted) return
      setState({ ...empty, key, loading: false, error: error instanceof Error ? error.message : '查询失败，请重试' })
    }).finally(() => { if (token === generation.current) busy.current = false })
    return release
  }, [puuid, queueId, count, open, revision, key, serverId, refreshRevision])

  const loadMore = useCallback(async () => {
    const previous = stateRef.current
    if (previous.key !== key || busy.current || !previous.hasMore || !open) return
    const token = generation.current
    const current = new AbortController(); controller.current = current; busy.current = true
    setState((s) => ({ ...s, loadingMore: true, error: '' }))
    try {
      const response: SgpMatchHistoryLol = await fetchHistoryPage(puuid, queueId, nextIndex.current, count, current.signal, serverId)
      if (token !== generation.current || current.signal.aborted) return
      const existing = new Set(previous.games.map((g) => `${g.json.platformId}:${g.json.gameId}`))
      const added = (response.games || []).filter((g) => !existing.has(`${g.json.platformId}:${g.json.gameId}`))
      nextIndex.current += (response.games || []).length
      setState((s) => {
        const page: PageState = { ...s, games: [...s.games, ...added], loadingMore: false, hasMore: (response.games || []).length >= count && added.length > 0,
        source: s.source && response.sonaSource && s.source !== response.sonaSource ? 'mixed' : response.sonaSource || s.source,
        scanLimit: response.sonaScanLimit || s.scanLimit, updatedAt: Date.now(), cursor: nextIndex.current,
        error: !added.length && response.games?.length ? '接口返回重复对局，已停止翻页；可刷新后重试。' : '',
        }
        rememberPage(page); return page
      })
    } catch (error) {
      if (token !== generation.current || current.signal.aborted) return
      setState((s) => ({ ...s, loadingMore: false, error: error instanceof Error ? error.message : '加载更多失败，请重试' }))
    } finally { if (token === generation.current) busy.current = false }
  }, [key, puuid, queueId, count, open, serverId])

  return { ...(state.key === key ? state : { ...empty, key }), loadMore, refresh: () => { forceRefresh.current = true; pageCache.delete(key); setRevision((v) => v + 1) } }
}
