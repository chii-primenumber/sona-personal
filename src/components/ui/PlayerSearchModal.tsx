import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { HistoryImage } from './HistoryWidgets'
import { HistoryPlayerName } from './HistoryPlayerName'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { SearchIcon } from './icons'
import { deadline } from '@/lib/history-api'
import { profileIconUrl } from '@/lib/history-model'
import { historyPlayerFromFriend, historyPlayerMatches, historySearchServers, historyServerName, parsePlayerQuery,
  searchHistoryPlayers, TENCENT_MERGED_SERVERS, type HistoryPlayer } from '@/lib/history-search'
import { lcu } from '@/lib/lcu'
import { store } from '@/lib/store'
import type { ChatFriend } from '@/types/lcu'
import '@/styles/PersonalHistory.css'

interface SearchState {
  query: string
  pending: boolean
  results: HistoryPlayer[]
  error?: string
}

const emptySearch: SearchState = { query: '', pending: false, results: [] }
const ONLINE_STATUS: Record<string, string> = {
  chat: '在线', dnd: '游戏中', inQueue: '队列中', away: '离开', mobile: '移动端', offline: '离线',
}

export function PlayerSearchModal({ open, initialQuery = '', onClose, onSelect }: {
  open: boolean; initialQuery?: string; onClose: () => void; onSelect: (player: HistoryPlayer) => void
}) {
  return <Modal open={open} onClose={onClose} width="min(915px, 95vw)" height="min(670px, 87vh)">
    {open && <PlayerSearchContent initialQuery={initialQuery} onSelect={onSelect} />}
  </Modal>
}

function PlayerSearchContent({ initialQuery, onSelect }: {
  initialQuery: string; onSelect: (player: HistoryPlayer) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [serverId, setServerId] = useState('')
  const [currentServer, setCurrentServer] = useState('')
  const [friends, setFriends] = useState<ChatFriend[]>([])
  const [friendStatus, setFriendStatus] = useState('正在读取好友…')
  const [recent, setRecent] = useState(() => store.get('historyRecentPlayers'))
  const [state, setState] = useState<SearchState>(emptySearch)
  const [showMerged, setShowMerged] = useState(false)
  const request = useRef<AbortController | null>(null)

  const startSearch = useCallback(async (text: string, region: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const submitted = text.trim()
    setState({ query: submitted, pending: true, results: [] })
    try {
      const parsed = parsePlayerQuery(submitted)
      const results = await searchHistoryPlayers(parsed, region, controller.signal)
      if (!controller.signal.aborted) setState({ query: submitted, pending: false, results })
    } catch (error) {
      if (!controller.signal.aborted) setState({
        query: submitted, pending: false, results: [], error: error instanceof Error ? error.message : '暂时无法搜索玩家。',
      })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const unsubscribe = store.onChange('historyRecentPlayers', setRecent)
    void deadline(() => lcu.getSgpServerId(), controller.signal, 7000).then((server) => {
      if (!controller.signal.aborted) setCurrentServer(server)
    }).catch(() => {})
    void deadline((signal) => lcu.get<ChatFriend[]>('/lol-chat/v1/friends', signal), controller.signal, 7000).then((rows) => {
      if (!controller.signal.aborted) {
        setFriends(Array.isArray(rows) ? rows : [])
        setFriendStatus('暂无好友')
      }
    }).catch(() => { if (!controller.signal.aborted) setFriendStatus('好友列表暂不可用') })
    if (initialQuery.trim()) void startSearch(initialQuery, '')
    return () => { controller.abort(); request.current?.abort(); unsubscribe() }
  }, [initialQuery, startSearch])

  const recentPlayers = Array.isArray(recent) ? recent.filter((player) => player?.puuid && player.name) : []
  const friendPlayers = useMemo(() => friends.flatMap((friend) => {
    const player = historyPlayerFromFriend(friend, currentServer)
    return player ? [player] : []
  }).sort((a, b) => Number(a.availability === 'offline') - Number(b.availability === 'offline') ||
    a.name.localeCompare(b.name, 'zh-CN')), [friends, currentServer])
  const results = new Map(state.results.map((player) => [player.puuid, player]))
  if (state.query && !state.pending) {
    for (const player of [...recentPlayers, ...friendPlayers]) {
      if ((player.serverId ?? '') === serverId && historyPlayerMatches(player, state.query) && !results.has(player.puuid)) {
        results.set(player.puuid, player)
      }
    }
  }

  function changeServer(next: string) {
    request.current?.abort()
    setState(emptySearch)
    setServerId(next)
  }

  return <div className="rh-shell rh-search-shell" data-testid="history-player-search" aria-label="搜索召唤师">
    <aside className="rh-search-lists">
      <PlayerList title="最近访问" players={recentPlayers} emptyText="暂无访问记录" onSelect={onSelect} />
      <PlayerList title="好友" players={friendPlayers} emptyText={friendStatus} onSelect={onSelect} />
    </aside>
    <main className="rh-search-main">
      <header>
        <span className="rh-eyebrow">SONA · 个人战绩</span>
        <div className="rh-search-heading">
          <h2>搜索召唤师</h2>
          {currentServer.startsWith('TENCENT_') && <button type="button" className="rh-text-button"
            aria-expanded={showMerged} onClick={() => setShowMerged((value) => !value)}>合区参照</button>}
        </div>
        <form className="rh-search-form" role="search" onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) void startSearch(query, serverId)
        }}>
          <select aria-label="搜索大区" value={serverId} onChange={(event) => changeServer(event.target.value)}>
            <option value="">{currentServer ? `${historyServerName(currentServer)}（当前）` : '当前大区'}</option>
            {historySearchServers(currentServer).map((key) => <option key={key} value={key}>{historyServerName(key)}</option>)}
          </select>
          <input type="search" aria-label="玩家名称、编号或 PUUID" placeholder="名字 / 名字#编号 / PUUID" maxLength={120}
            value={query} autoFocus autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
          <HistoryAssetTooltip title={state.pending ? '搜索中…' : '搜索'} compact asChild><button type="submit" className="rh-button rh-icon-button" aria-label={state.pending ? '搜索中…' : '搜索'} disabled={!query.trim() || state.pending}><SearchIcon /></button></HistoryAssetTooltip>
        </form>
      </header>
      {showMerged && <div className="rh-merged-servers" aria-label="合区参照">
        {TENCENT_MERGED_SERVERS.map(([key, members]) => <div key={key}>
          <button type="button" className="rh-text-button" onClick={() => { changeServer(key === currentServer ? '' : key); setShowMerged(false) }}>
            {historyServerName(key)}
          </button><span>{members}</span>
        </div>)}
      </div>}
      <div className="rh-search-results" aria-live="polite">
        {state.pending ? <div className="rh-empty"><span className="rh-spinner" />正在搜索召唤师…</div> : results.size ? <>
          <p className="rh-search-result-count">{results.size} 位玩家</p>
          {state.error && <p className="rh-search-result-count">好友和最近访问中的匹配结果</p>}
          {[...results.values()].map((player) => <PlayerRow key={player.puuid} player={player} onSelect={onSelect} />)}
        </> : <div className="rh-search-empty">
          <strong role={state.error ? 'alert' : undefined}>{state.error || (state.query ? '没有找到匹配的玩家' : '暂无搜索结果')}</strong>
          <p>可按名字、完整的名字#编号或 PUUID 搜索。</p>
          <p>点击好友或最近访问的玩家，可直接查看战绩。</p>
        </div>}
      </div>
    </main>
  </div>
}

function PlayerList({ title, players, emptyText, onSelect }: {
  title: string; players: HistoryPlayer[]; emptyText: string; onSelect: (player: HistoryPlayer) => void
}) {
  const [filter, setFilter] = useState('')
  const filtered = players.filter((player) => historyPlayerMatches(player, filter))
  return <section className="rh-search-list" aria-label={title}>
    <div className="rh-search-list-title">
      <strong>{title}（{players.length}）</strong>
      <input type="search" aria-label={`筛选${title}`} placeholder="筛选" value={filter}
        onChange={(event) => setFilter(event.target.value)} />
    </div>
    <div className="rh-search-list-items">
      {filtered.length ? filtered.map((player) =>
        <PlayerRow key={`${player.serverId ?? ''}:${player.puuid}`} player={player} onSelect={onSelect} />)
        : <p className="rh-search-list-empty">{players.length ? '没有匹配的玩家' : emptyText}</p>}
    </div>
  </section>
}

function PlayerRow({ player, onSelect }: { player: HistoryPlayer; onSelect: (player: HistoryPlayer) => void }) {
  const tag = player.name.split('#')[1]
  const status = player.availability ? ONLINE_STATUS[player.availability] : undefined
  return <button type="button" className="rh-search-player" onClick={() => onSelect(player)} aria-label={`查看 ${player.name} 的战绩`}>
    <span className="rh-search-portrait">
      <HistoryImage src={profileIconUrl(player.iconId)} label={player.name} nativeTooltip={false} />
      {status && <HistoryAssetTooltip title={status} compact focusable={false} asChild><i className={`rh-search-status rh-search-status-${player.availability}`} aria-label={status} /></HistoryAssetTooltip>}
    </span>
    <span className="rh-search-identity"><strong><HistoryPlayerName name={player.name} /></strong>
      {(tag || player.serverId) && <small>{[tag && `#${tag}`, player.serverId && historyServerName(player.serverId)].filter(Boolean).join(' · ')}</small>}
    </span>
  </button>
}
