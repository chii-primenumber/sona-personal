import { useSyncExternalStore } from 'react'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { store } from '@/lib/store'

const subscribe = (callback:()=>void) => store.onChange('profileHistoryEntry',callback)
const snapshot = () => store.get('profileHistoryEntry')
export function ProfileHistoryToggle({collapsed=false}:{collapsed?:boolean}) {
  const enabled = useSyncExternalStore(subscribe,snapshot)
  return <HistoryAssetTooltip title="生涯详细战绩入口" description={`点击${enabled?'隐藏':'显示'}生涯页的详细战绩按钮`} compact asChild>
    <button type="button" className={`sona-score-system sona-profile-history-toggle${collapsed?' sona-score-system--collapsed':''}`} data-testid="profile-history-toggle"
      aria-label={`生涯详细战绩入口：${enabled?'开启':'关闭'}`} aria-pressed={enabled} onClick={()=>store.set('profileHistoryEntry',!enabled)}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
      {!collapsed && <span>生涯入口：{enabled?'开':'关'}</span>}
    </button>
  </HistoryAssetTooltip>
}
