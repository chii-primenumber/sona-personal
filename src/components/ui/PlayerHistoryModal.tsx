import { useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { HistoryDisplaySettings } from './HistoryDisplaySettings'
import { PlayerSearchModal } from './PlayerSearchModal'
import { HistoryPlayerName } from './HistoryPlayerName'
import { ChampionStrip, HistoryImage, HistoryMatchCard, RankCards, SummaryStats, championName } from './HistoryWidgets'
import { getChampIcon, getPlayableQueues, getQueueName } from '@/lib/assets'
import { deadline, fetchHistoryMastery, fetchHistoryRanks, fetchHistorySummoner, type HistoryMastery, type HistoryRank } from '@/lib/history-api'
import { lcu } from '@/lib/lcu'
import { historyPlayerFromSummoner, historyServerName, rememberHistoryPlayer, type HistoryPlayer } from '@/lib/history-search'
import { championStats, encounters, numberText, percentText, POSITION_NAMES, profileIconUrl, splitRiotId, summarize, toHistoryMatches } from '@/lib/history-model'
import { calculateSonaPlayerStrengthScore } from '@/lib/player-strength-score'
import { useHistoryPages } from '@/lib/use-history-pages'
import { useHistoryHiddenFields } from '@/lib/use-history-display'
import { isHistoryFieldVisible, type HistoryDisplayField } from '@/lib/history-display'
import '@/styles/PersonalHistory.css'

export interface PlayerHistoryModalProps { open: boolean; onClose: () => void; puuid: string; playerName: string; queueId?: number }

export function PlayerHistoryModal({ open, onClose, puuid, playerName, queueId }: PlayerHistoryModalProps) {
  const [navigation, setNavigation] = useState<{ base: string; current: HistoryPlayer; trail: HistoryPlayer[] }>({ base: puuid, current: { puuid, name: playerName }, trail: [] })
  useEffect(() => { if (open) setNavigation({ base: puuid, current: { puuid, name: playerName }, trail: [] }) }, [open, puuid, playerName])
  const current = navigation.base === puuid ? navigation.current : { puuid, name: playerName }
  const inspect = (player: HistoryPlayer) => {
    if (!player.puuid || (player.puuid === current.puuid && player.serverId === current.serverId)) return
    setNavigation((nav) => ({ ...nav, current: player, trail: [...nav.trail, nav.current] }))
  }
  return <Modal open={open} onClose={onClose} width="min(1320px, 95vw)" height="min(940px, 92vh)">
    {current.puuid && <PlayerHistoryContent key={`${current.serverId ?? ''}:${current.puuid}`} open={open} target={current}
      defaultQueueId={queueId || 0} onSelectPlayer={inspect}
      onBack={navigation.trail.length ? () => setNavigation((nav) => ({ ...nav, current: nav.trail[nav.trail.length - 1], trail: nav.trail.slice(0, -1) })) : undefined} />}
  </Modal>
}

function PlayerHistoryContent({ open, target, defaultQueueId, onSelectPlayer, onBack }: {
  open: boolean; target: HistoryPlayer; defaultQueueId: number; onSelectPlayer: (player: HistoryPlayer) => void; onBack?: () => void
}) {
  const [queueId, setQueueId] = useState(defaultQueueId)
  const [batchSize, setBatchSize] = useState(50)
  const [championId, setChampionId] = useState(0)
  const [position, setPosition] = useState('')
  const [result, setResult] = useState('')
  const [hideAborted, setHideAborted] = useState(true)
  const [tab, setTab] = useState<'matches' | 'champions'>('matches')
  const [profile, setProfile] = useState<HistoryPlayer | null>(null)
  const [ranks, setRanks] = useState<HistoryRank[] | null>(null)
  const [rankStatus, setRankStatus] = useState('正在查询…')
  const [mastery, setMastery] = useState<HistoryMastery[] | null>(null)
  const [masteryStatus, setMasteryStatus] = useState('正在查询英雄点数…')
  const [showAllMastery, setShowAllMastery] = useState(false)
  const [profileRevision, setProfileRevision] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const pages = useHistoryPages(target.puuid, queueId, batchSize, open, target.serverId)
  const hidden = useHistoryHiddenFields()
  const show = (field: HistoryDisplayField<'history'>) => isHistoryFieldVisible(hidden, 'history', field)

  useEffect(() => {
    if (open) rememberHistoryPlayer(target)
    else { setShowSettings(false); setShowSearch(false) }
  }, [open, target])

  const onInspect = (puuid: string, name: string) => onSelectPlayer({ puuid, name, serverId: target.serverId })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setProfile(null); setRanks(null); setRankStatus('正在查询…'); setMastery(null); setMasteryStatus('正在查询英雄点数…')
    const serverId = target.serverId
    const profileRequest = serverId
      ? deadline((signal) => lcu.getHistorySgpSummoner(serverId, target.puuid, signal), controller.signal, 10000)
      : fetchHistorySummoner(target.puuid, controller.signal)
    void profileRequest.then((value) => {
      if (!value || controller.signal.aborted) return
      const player = historyPlayerFromSummoner(value, serverId, target.name)
      if (player) {
        if (target.name.includes('#') && !value.tagLine) player.name = target.name
        setProfile(player)
        rememberHistoryPlayer(player)
      }
    }).catch(() => {})
    void fetchHistoryRanks(target.puuid, controller.signal, serverId).then((value) => {
      if (!controller.signal.aborted) setRanks(value)
    }).catch(() => { if (!controller.signal.aborted) setRankStatus('暂不可用') })
    if (serverId) setMasteryStatus('跨大区的英雄点数暂不可用')
    else void fetchHistoryMastery(target.puuid, controller.signal).then((value) => {
      if (!controller.signal.aborted) setMastery(value)
    }).catch(() => { if (!controller.signal.aborted) setMasteryStatus('该玩家的英雄点数暂不可用') })
    return () => controller.abort()
  }, [open, target, profileRevision])

  const allMatches = useMemo(() => toHistoryMatches(pages.games, target.puuid).filter((m) => !queueId || m.game.json.queueId === queueId), [pages.games, target.puuid, queueId])
  const filtered = useMemo(() => allMatches.filter((m) => (!championId || m.player.championId === championId) && (!position || m.position === position) && (!result || m.outcome === result) && (!hideAborted || (m.outcome !== 'remake' && m.outcome !== 'abort'))), [allMatches, championId, position, result, hideAborted])
  const stats = useMemo(() => summarize(filtered), [filtered])
  const champions = useMemo(() => championStats(allMatches), [allMatches])
  const filteredChampions = useMemo(() => championStats(filtered), [filtered])
  const teammates = useMemo(() => encounters(filtered, 'ally'), [filtered])
  const opponents = useMemo(() => encounters(filtered, 'enemy'), [filtered])
  const strength = useMemo(() => {
    try { const score = calculateSonaPlayerStrengthScore(filtered.filter((m) => m.outcome === 'win' || m.outcome === 'loss').map((m) => m.game), target.puuid); return score && Number.isFinite(score.score) ? score : null } catch { return null }
  }, [filtered, target.puuid])
  const queues = useMemo(() => {
    const map = new Map(getPlayableQueues().map((q) => [q.id, q.name]))
    for (const id of [420, 440, 430, 450, 2400, defaultQueueId, ...pages.games.map((g) => g.json.queueId)]) if (id > 0 && !map.has(id)) map.set(id, getQueueName(id))
    return [...map].map(([id, name]) => ({ id, name }))
  }, [pages.games, defaultQueueId])
  const name = profile?.name || target.name || '玩家战绩'
  const identity = splitRiotId(name)
  const level = profile?.level ?? target.level
  useEffect(() => setCopyStatus(''), [name])
  const resetLocalFilters = () => { setChampionId(0); setPosition(''); setResult(''); setHideAborted(true) }
  const refresh = () => { pages.refresh(); setProfileRevision((n) => n + 1) }

  return <div className="rh-shell" data-testid="player-history">
    <header className={`rh-header${show('ranks') ? '' : ' rh-header-no-ranks'}`}>
      <div className="rh-profile">{onBack && <button className="rh-back" type="button" onClick={onBack} title="返回上一位玩家">‹ 返回</button>}
        <HistoryImage src={profileIconUrl(profile?.iconId ?? target.iconId)} label={name} className="rh-profile-icon" />
        <div>
          <div className="rh-profile-name">
            <h2 aria-label={name}>{identity.name}</h2>
            {name !== '玩家战绩' && name !== '未知玩家' && <button type="button" className="rh-copy-id" aria-label="复制玩家 ID"
              title={copyStatus || '复制玩家 ID'} onClick={async () => {
                try { await navigator.clipboard.writeText(name); setCopyStatus('已复制') }
                catch { setCopyStatus('复制失败') }
              }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
                {copyStatus === '已复制' ? <path d="m3 8 3 3 7-7" /> : <><rect x="5" y="2" width="8" height="10" rx="1" /><path d="M3 5v8a1 1 0 0 0 1 1h6" /></>}
              </svg>
            </button>}
          </div>
          {identity.tag && <span className="rh-profile-tag">{identity.tag}</span>}
          <span className="rh-muted">{target.serverId && `${historyServerName(target.serverId)} · `}{level != null && `等级 ${level} · `}已加载 {allMatches.length} 场</span></div>
      </div>
      {show('ranks') && <RankCards ranks={ranks} status={rankStatus} />}
      <div className="rh-header-actions">
        <button type="button" className="rh-button" onClick={refresh} disabled={pages.loading}>刷新</button>
        <button type="button" className="rh-button" onClick={() => setShowSettings(true)}>显示设置</button>
      </div>
    </header>
    <div className="rh-workspace">
      <aside className="rh-sidebar">
        <section className="rh-panel"><h3>查询范围</h3><label>游戏模式<select aria-label="游戏模式" value={queueId} onChange={(event) => { setQueueId(Number(event.target.value)); resetLocalFilters() }}><option value={0}>全部模式</option>{queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label><label>每次加载<select aria-label="每次加载场次" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))}>{[20, 50, 100].map((count) => <option value={count} key={count}>{count} 场</option>)}</select></label></section>
        {show('summary') && <section className="rh-panel"><h3>近期总览 <small>{stats.total} 场</small></h3>{strength && <div className="rh-score" title="近期对局综合评分 · 3–16 分"><span>Sona 评分</span><strong>{strength.score.toFixed(1)}</strong></div>}<SummaryStats matches={filtered} />{stats.total > 0 && <div className="rh-summary-extra"><span>{stats.streak}</span><span>蓝方 {stats.blue} / 红方 {stats.red}</span></div>}</section>}
        {show('champions') && <section className="rh-panel">
          <h3>近期常玩英雄</h3>
          <ChampionStrip matches={allMatches} selectedId={championId} limit={12}
            onSelect={(id) => {
              setChampionId((current) => current === id ? 0 : id)
              setTab('matches')
            }}
          />
          <p className="rh-footnote">再次点击当前英雄可显示全部英雄的战绩</p>
        </section>}
        {show('mastery') && <section className="rh-panel"><h3>英雄点数 <button type="button" className="rh-text-button" onClick={() => setShowAllMastery(!showAllMastery)}>{showAllMastery ? '收起' : '更多'}</button></h3>{mastery ? mastery.length ? <div className="rh-mastery">{mastery.slice(0, showAllMastery ? 60 : 6).map((m) => <button type="button" key={m.championId} onClick={() => { setChampionId(m.championId); setTab('matches') }} title="查看已加载的该英雄对局"><HistoryImage src={getChampIcon(m.championId)} label={championName(m.championId)} /><span><strong>{championName(m.championId)}</strong><small>{m.championLevel} 级</small></span><b>{numberText(m.championPoints)}</b></button>)}</div> : <p className="rh-muted">暂无英雄点数记录</p> : <p className="rh-muted">{masteryStatus}</p>}</section>}
        {([['teammates', '最近队友', teammates], ['opponents', '最近对手', opponents]] as const).filter(([field]) => show(field)).map(([, title, people]) => (
          <section className="rh-panel" key={title}>
            <h3>{title}</h3>
            <div className="rh-encounters">
              {people.slice(0, 8).map((person) => (
                <button type="button" key={person.puuid} onClick={() => onInspect(person.puuid, person.name)} aria-label={person.name}>
                  <HistoryImage src={profileIconUrl(person.profileIcon)} label={person.name} nativeTooltip={false} />
                  <HistoryPlayerName name={person.name} showTag />
                  <small>{person.count} 场 · {person.wins} 胜 {person.losses} 负</small>
                </button>
              ))}
            </div>
            {!people.length && <p className="rh-muted">暂无可用记录</p>}
          </section>
        ))}
      </aside>
      <main className="rh-main">
        <div className="rh-main-toolbar">
          <div className="rh-tabs">
            <button type="button" className={tab === 'matches' ? 'is-active' : ''} onClick={() => setTab('matches')}>战绩明细 <small>{filtered.length}</small></button>
            <button type="button" className={tab === 'champions' ? 'is-active' : ''} onClick={() => setTab('champions')}>英雄统计 <small>{filteredChampions.length}</small></button>
          </div>
          <form className="rh-player-search" onSubmit={(event) => { event.preventDefault(); setShowSearch(true) }} role="search">
            <input type="search" aria-label="搜索玩家" placeholder="名字 / 名字#编号 / PUUID" maxLength={120}
              autoComplete="off" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <button type="submit" className="rh-button">搜索玩家</button>
          </form>
          <span className="rh-muted">{pages.updatedAt ? `更新于 ${new Date(pages.updatedAt).toLocaleTimeString('zh-CN')}` : '正在查询'}</span>
        </div>
        <div className="rh-local-filters"><select aria-label="筛选英雄" value={championId} onChange={(e) => setChampionId(Number(e.target.value))}><option value={0}>全部英雄</option>{champions.map((c) => <option key={c.id} value={c.id}>{championName(c.id)} · {c.total} 场</option>)}{championId > 0 && !champions.some((c) => c.id === championId) && <option value={championId}>{championName(championId)} · 当前未加载</option>}</select><select aria-label="筛选位置" value={position} onChange={(e) => setPosition(e.target.value)}><option value="">全部位置</option>{Object.entries(POSITION_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="筛选胜负" value={result} onChange={(e) => setResult(e.target.value)}><option value="">全部胜负</option><option value="win">胜利</option><option value="loss">失败</option></select><label><input type="checkbox" checked={hideAborted} onChange={(e) => setHideAborted(e.target.checked)} />隐藏重开 / 终止</label><button type="button" className="rh-text-button" onClick={resetLocalFilters}>重置筛选</button></div>
        {pages.scanLimit && <div className="rh-notice">当前范围为最近 {pages.scanLimit} 场。</div>}
        {pages.error && <div className="rh-error" role="alert">{pages.error}<button type="button" onClick={allMatches.length && pages.hasMore ? () => void pages.loadMore() : refresh}>重试</button></div>}
        <div className="rh-content" key={`${target.puuid}:${queueId}:${tab}`}>
          {pages.loading ? <div className="rh-empty"><span className="rh-spinner" />正在加载战绩…</div> : !filtered.length ? <div className="rh-empty">{allMatches.length ? '当前筛选下没有已加载对局。可重置筛选或继续加载。' : pages.error ? '战绩查询未完成，请重试。' : '当前查询范围没有对局记录。'}</div> : tab === 'matches' ? filtered.map((match) => <HistoryMatchCard key={match.id} match={match} hidden={hidden} onInspect={onInspect} />) : <div className="rh-table-scroll"><table className="rh-champion-table"><thead><tr>{['英雄', '场次', '胜率', 'KDA', '参团', '伤害占比', '承伤占比', '补刀 / 分'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredChampions.map((c) => <tr key={c.id}><td><button type="button" className="rh-player-link" onClick={() => { setChampionId(c.id); setTab('matches') }}><HistoryImage src={getChampIcon(c.id)} label={championName(c.id)} /><span>{championName(c.id)}</span></button></td><td>{c.total}</td><td>{percentText(c.winRate)}</td><td>{numberText(c.kda, 2)}</td><td>{percentText(c.participation)}</td><td>{percentText(c.damageShare)}</td><td>{percentText(c.takenShare)}</td><td>{numberText(c.csPerMinute, 1)}</td></tr>)}</tbody></table></div>}
          {!pages.loading && <div className="rh-load-more"><button type="button" className="rh-button" disabled={!pages.hasMore || pages.loadingMore} onClick={() => void pages.loadMore()}>{pages.loadingMore ? '正在加载…' : pages.hasMore ? `继续加载 ${batchSize} 场` : '已加载完毕'}</button></div>}
        </div>
      </main>
    </div>
    <HistoryDisplaySettings open={open && showSettings} onClose={() => setShowSettings(false)} initialSection="history" />
    <PlayerSearchModal open={open && showSearch} initialQuery={searchText} onClose={() => setShowSearch(false)} onSelect={(player) => {
      setShowSearch(false)
      setSearchText('')
      onSelectPlayer(player)
    }} />
  </div>
}
