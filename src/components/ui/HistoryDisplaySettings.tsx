import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { HISTORY_DISPLAY_FIELDS, isHistoryFieldVisible, type HistoryDisplayField, type HistoryDisplaySection } from '@/lib/history-display'
import { useHistoryHiddenFields, useHistoryPerformanceFields } from '@/lib/use-history-display'
import { DEFAULT_PERFORMANCE_FIELDS, PERFORMANCE_STATS } from '@/lib/history-performance'
import { store } from '@/lib/store'

const SECTION_LABELS: Record<HistoryDisplaySection, string> = {
  team: '五人／双方总览',
  history: '个人详细战绩',
  report: '单场详细战报',
}
const sections: HistoryDisplaySection[] = ['team', 'history', 'report']

export function HistoryDisplaySettings({ open, onClose, initialSection }: {
  open: boolean
  onClose: () => void
  initialSection: HistoryDisplaySection
}) {
  const [section, setSection] = useState(initialSection)
  const hidden = useHistoryHiddenFields()
  const performance = useHistoryPerformanceFields()
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) { setSection(initialSection); setQuery('') }
  }, [open, initialSection])

  function toggle(field: HistoryDisplayField<HistoryDisplaySection>, checked: boolean) {
    const current = store.get('historyHiddenFields')
    const list = Array.isArray(current?.[section]) ? current[section] : []
    const next = new Set(list)
    if (checked) next.delete(field)
    else next.add(field)
    store.set('historyHiddenFields', { ...current, [section]: [...next] })
  }

  const needle = query.trim().toLowerCase()
  const original = HISTORY_DISPLAY_FIELDS[section].filter(([,label]) => !needle || label.toLowerCase().includes(needle))
  const dataFields = PERFORMANCE_STATS.filter((stat) => stat.sections.includes(section) && (!needle || `${stat.label} ${stat.short} ${stat.group}`.toLowerCase().includes(needle)))
  const groups = [...new Set(dataFields.map((stat)=>stat.group))]
  const selected = performance[section] ?? DEFAULT_PERFORMANCE_FIELDS[section] ?? []
  function toggleData(key: string, checked: boolean) {
    const current = store.get('historyPerformanceFields')
    const fields = new Set(current[section] ?? DEFAULT_PERFORMANCE_FIELDS[section] ?? [])
    if (checked) fields.add(key); else fields.delete(key)
    store.set('historyPerformanceFields',{...current,[section]:[...fields]})
  }
  function selectData(checked: boolean) {
    const current = store.get('historyPerformanceFields')
    const fields = new Set(current[section] ?? DEFAULT_PERFORMANCE_FIELDS[section] ?? [])
    for (const stat of dataFields) { if (checked) fields.add(stat.key); else fields.delete(stat.key) }
    store.set('historyPerformanceFields',{...current,[section]:[...fields]})
  }

  return (
    <Modal open={open} onClose={onClose} width="min(740px, 94vw)" height="min(640px, 86vh)">
      <div className="rh-shell rh-display-settings" data-testid="history-display-settings">
        <header>
          <h2>战绩显示设置</h2>
          <p className="rh-muted">勾选要显示的项目，修改即时生效。</p>
        </header>
        <nav className="rh-tabs" aria-label="显示范围">
          {sections.map((key) => (
            <button type="button" key={key} className={key === section ? 'is-active' : ''}
              aria-pressed={key === section} onClick={() => { setSection(key); setQuery('') }}>{SECTION_LABELS[key]}</button>
          ))}
        </nav>
        <div className="rh-display-search"><input type="search" aria-label="搜索显示选项" placeholder="搜索数据项" value={query} onChange={(event)=>setQuery(event.target.value)} />
          <button type="button" className="rh-text-button" onClick={()=>selectData(true)}>全选数据</button>
          <button type="button" className="rh-text-button" onClick={()=>selectData(false)}>清空数据</button>
        </div>
        <div className="rh-display-options" role="group" aria-label={SECTION_LABELS[section]}>
          {groups.map((group)=><section className="rh-display-group" key={group}><h3>{group}</h3><div className="rh-display-group-fields">
            {dataFields.filter((stat)=>stat.group===group).map((stat)=><label key={stat.key}>
              <input type="checkbox" checked={selected.includes(stat.key)} onChange={(event)=>toggleData(stat.key,event.target.checked)} />{stat.label}
            </label>)}
          </div></section>)}
          {original.length > 0 && <section className="rh-display-group"><h3>原有显示项目</h3><div className="rh-display-group-fields">{original.map(([field, label]) => (
            <label key={field}>
              <input type="checkbox" checked={isHistoryFieldVisible(hidden, section, field)}
                onChange={(event) => toggle(field, event.target.checked)} />
              {label}
            </label>
          ))}</div></section>}
          {!original.length && !dataFields.length && <p className="rh-muted">没有匹配的数据项</p>}
        </div>
        <footer>
          <button type="button" className="rh-button"
            onClick={() => {
              store.set('historyHiddenFields', { ...store.get('historyHiddenFields'), [section]: [] })
              store.set('historyPerformanceFields',{...store.get('historyPerformanceFields'),[section]:[...(DEFAULT_PERFORMANCE_FIELDS[section] ?? [])]})
            }}>恢复本页默认</button>
          <button type="button" className="rh-button" onClick={onClose}>完成</button>
        </footer>
      </div>
    </Modal>
  )
}
