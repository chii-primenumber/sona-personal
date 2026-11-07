import { useMemo } from 'react'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { DEFAULT_PERFORMANCE_FIELDS, performanceSummary, performanceText } from '@/lib/history-performance'
import { useHistoryPerformanceFields } from '@/lib/use-history-display'
import type { HistoryMatch } from '@/lib/history-model'

export function HistoryPerformanceStats({ matches, section }: { matches: HistoryMatch[]; section: 'team' | 'history' }) {
  const selection = useHistoryPerformanceFields()
  const selected = selection[section] ?? DEFAULT_PERFORMANCE_FIELDS[section] ?? []
  const stats = useMemo(() => performanceSummary(matches,selected,section), [matches,selected,section])
  if (!stats.length) return null
  if (section === 'team') return <span className="rh-performance-tags" data-testid="team-performance">
    {stats.map(({stat,value,count}) => <HistoryAssetTooltip key={stat.key} title={stat.label} description={`${stat.definition}\n有效数据 ${count} 场`} compact={false} focusable={false} asChild>
      <span className="rh-team-tag rh-team-tag-gold" data-stat={stat.key}>{stat.short} {performanceText(stat,value)}</span>
    </HistoryAssetTooltip>)}
  </span>
  return <dl className="rh-stats rh-performance-stats" data-testid="history-performance">
    {stats.map(({stat,value,count}) => <HistoryAssetTooltip key={stat.key} title={stat.label} description={`${stat.definition}\n有效数据 ${count} 场`} focusable={false} asChild>
      <div data-stat={stat.key}><dt>{stat.label}</dt><dd>{performanceText(stat,value)}</dd></div>
    </HistoryAssetTooltip>)}
  </dl>
}
