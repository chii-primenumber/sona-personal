import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { splitRiotId } from '@/lib/history-model'

export function HistoryPlayerName({ name, showTag = false, color }: {
  name: string; showTag?: boolean; color?: string
}) {
  const identity = splitRiotId(name)
  return <HistoryAssetTooltip className="rh-player-name" title={name} compact focusable={false}>
    <span className="rh-player-name-text" style={{ color }}>{identity.name}</span>
    {showTag && identity.tag && <span className="rh-id-tag">{identity.tag}</span>}
  </HistoryAssetTooltip>
}
