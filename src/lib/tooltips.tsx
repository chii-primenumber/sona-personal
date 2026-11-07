import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TooltipBubble } from '@/components/ui/HistoryAssetTooltip'

const PLUGIN_SURFACES = '#sona-root, .sona-modal-overlay, .sobp, .sona-entry-btn, .sona-profile-history-entry, [data-sona-team-history], [data-sona-opgg-preselect-build], [data-sona-opgg-ingame-build]'
let initialized = false
let tooltipRoot: Root | undefined
let active: HTMLElement | undefined

export function initSonaTooltips() {
  if (initialized) return
  initialized = true
  function hide() {
    if (!active) return
    active = undefined
    tooltipRoot?.render(null)
  }
  function show(event: Event) {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[title], [data-sona-tooltip]') : null
    if (!(element instanceof HTMLElement) || !element.closest(PLUGIN_SURFACES)) { hide(); return }
    const text = element.getAttribute('title') || element.dataset.sonaTooltip
    if (!text) { hide(); return }
    if (element.hasAttribute('title')) {
      element.dataset.sonaTooltip = text
      element.removeAttribute('title')
      if (!element.hasAttribute('aria-description')) element.setAttribute('aria-description', text)
    }
    active = element
    if (!tooltipRoot) {
      const host = document.createElement('div')
      document.body.append(host)
      tooltipRoot = createRoot(host)
    }
    const [title, ...lines] = text.split('\n')
    tooltipRoot.render(createElement(TooltipBubble, {
      anchor: element, title, description: lines.join('\n'), compact: !lines.length,
    }))
  }
  function leave(event: MouseEvent | FocusEvent) {
    if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) hide()
  }
  document.addEventListener('mouseover', show, true)
  document.addEventListener('focusin', show, true)
  document.addEventListener('mouseout', leave, true)
  document.addEventListener('focusout', leave, true)
  window.addEventListener('blur', hide)
}
