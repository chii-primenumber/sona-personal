import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { HISTORY_DISPLAY_FIELDS, isHistoryFieldVisible, type HistoryDisplayField, type HistoryDisplaySection } from '@/lib/history-display'
import { useHistoryHiddenFields } from '@/lib/use-history-display'
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
  useEffect(() => {
    if (open) setSection(initialSection)
  }, [open, initialSection])

  function toggle(field: HistoryDisplayField<HistoryDisplaySection>, checked: boolean) {
    const current = store.get('historyHiddenFields')
    const list = Array.isArray(current?.[section]) ? current[section] : []
    const next = new Set(list)
    if (checked) next.delete(field)
    else next.add(field)
    store.set('historyHiddenFields', { ...current, [section]: [...next] })
  }

  return (
    <Modal open={open} onClose={onClose} width="min(580px, 94vw)" height="min(420px, 86vh)">
      <div className="rh-shell rh-display-settings" data-testid="history-display-settings">
        <header>
          <span className="rh-eyebrow">SONA · 战绩增强</span>
          <h2>战绩显示设置</h2>
          <p className="rh-muted">勾选要显示的项目，修改即时生效。</p>
        </header>
        <nav className="rh-tabs" aria-label="显示范围">
          {sections.map((key) => (
            <button type="button" key={key} className={key === section ? 'is-active' : ''}
              aria-pressed={key === section} onClick={() => setSection(key)}>{SECTION_LABELS[key]}</button>
          ))}
        </nav>
        <fieldset className="rh-display-options" aria-label={SECTION_LABELS[section]}>
          {HISTORY_DISPLAY_FIELDS[section].map(([field, label]) => (
            <label key={field}>
              <input type="checkbox" checked={isHistoryFieldVisible(hidden, section, field)}
                onChange={(event) => toggle(field, event.target.checked)} />
              {label}
            </label>
          ))}
        </fieldset>
        <footer>
          <button type="button" className="rh-button"
            onClick={() => store.set('historyHiddenFields', { ...store.get('historyHiddenFields'), [section]: [] })}>恢复本页默认</button>
          <button type="button" className="rh-button" onClick={onClose}>完成</button>
        </footer>
      </div>
    </Modal>
  )
}
