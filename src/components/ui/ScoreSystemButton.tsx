import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { usePlayerScoreSystem } from '@/lib/use-player-score'
import { playerScoreName } from '@/lib/player-score'
import { store } from '@/lib/store'

export function ScoreSystemButton({ collapsed = false }: { collapsed?: boolean }) {
  const system = usePlayerScoreSystem(), next = system === 'akari' ? 'sona' : 'akari'
  return <HistoryAssetTooltip title={`评分机制：${playerScoreName(system)}`} description={`点击切换为 ${playerScoreName(next)} 评分`} compact asChild>
    <button type="button" className={`sona-score-system${collapsed?' sona-score-system--collapsed':''}`} aria-label={`评分机制：${playerScoreName(system)}`} data-testid="score-system-switch"
      onClick={()=>store.set('playerScoreSystem',next)}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 20V10m5 10V4m5 16v-7m5 7V7" /></svg>
      {!collapsed && <span>评分：{playerScoreName(system)}</span>}
    </button>
  </HistoryAssetTooltip>
}
