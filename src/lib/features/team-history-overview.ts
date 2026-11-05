import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TeamHistoryModal, type TeamHistoryMode } from '@/components/ui/TeamHistoryModal'
import { injector } from '@/lib/InjectorManager'
import { lcu, LcuEventUri } from '@/lib/lcu'
import type { GameflowPhase } from '@/types/lcu'

const ATTR = 'data-sona-team-history'
let mode: TeamHistoryMode | null = null
let button: HTMLButtonElement | null = null
let root: Root | null = null
let host: HTMLDivElement | null = null
let unsub: (() => void) | null = null
let subscriptionId = 0
let phaseEvents = 0

function destroyModal() {
  root?.unmount(); root = null
  host?.remove(); host = null
}

function showOverview() {
  if (!mode) return
  if (!host) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }
  const currentMode = mode
  const close = () => root?.render(createElement(TeamHistoryModal, { open: false, mode: currentMode, onClose: close }))
  root?.render(createElement(TeamHistoryModal, { open: true, mode: currentMode, onClose: close }))
}

function injectButton() {
  if (!mode) return false
  const container = document.querySelector(mode === 'bp' ? '.bottom-right-buttons' : '.game-in-progress-container')
  // The existing auto-popup feature has its own in-game button. It opens the same enhanced view.
  if (mode === 'game' && container?.querySelector('[data-sona-game-analysis]')) {
    button?.remove(); button = null; return true
  }
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.setAttribute(ATTR, mode)
    button.className = 'rh-team-entry'
    button.textContent = mode === 'bp' ? '己方五人战绩' : '十人战绩总览'
    button.title = mode === 'bp' ? '查看英雄选择阶段的己方队伍' : '查看本局双方队伍的近期战绩'
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showOverview() })
  }
  const destination = container || document.body
  if (button.parentElement !== destination) destination.appendChild(button)
  button.classList.toggle('rh-team-entry-floating', !container)
  return true
}

function changePhase(phase: GameflowPhase) {
  const next = phase === 'ChampSelect' ? 'bp' : phase === 'InProgress' || phase === 'Reconnect' ? 'game' : null
  if (next === mode) return
  injector.unregister(injectButton)
  button?.remove(); button = null
  destroyModal()
  mode = next
  if (mode) injector.register(injectButton)
}

export function updateTeamHistoryOverview(enabled: boolean) {
  if (enabled && !unsub) {
    const id = ++subscriptionId, seen = phaseEvents
    unsub = lcu.observe(LcuEventUri.GAMEFLOW_PHASE_CHANGE, (event) => { phaseEvents++; changePhase(event.data as GameflowPhase) })
    void lcu.getGameflowPhase().then((phase) => { if (id === subscriptionId && seen === phaseEvents) changePhase(phase) }).catch(() => {})
  } else if (!enabled && unsub) {
    subscriptionId++
    unsub(); unsub = null
    changePhase('None')
  }
}
