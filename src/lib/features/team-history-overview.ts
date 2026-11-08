import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TeamHistoryModal, type TeamHistoryMode } from '@/components/ui/TeamHistoryModal'
import { injector } from '@/lib/InjectorManager'
import { lcu, LcuEventUri } from '@/lib/lcu'
import type { GameflowPhase, Lobby } from '@/types/lcu'
import { syncInGameDetailsLayout } from './in-game-details-layout'

const ATTR = 'data-sona-team-history'
let mode: TeamHistoryMode | null = null
let button: HTMLElement | null = null
let gameContainer: Element | null = null
let root: Root | null = null
let host: HTMLDivElement | null = null
let unsub: (() => void) | null = null
let subscriptionId = 0
let phaseEvents = 0
let lobbyEvents = 0
let phase: GameflowPhase = 'None'
let party = new Set<string>()

function trackLobby(lobby: Lobby | null) {
  if (phase !== 'Lobby' && phase !== 'Matchmaking' && phase !== 'ReadyCheck') return
  if (!lobby && phase !== 'Lobby') return
  party = new Set(lobby?.gameConfig?.isCustom === false && Array.isArray(lobby.members)
    ? lobby.members.filter((member) => !member.isBot && member.puuid).map((member) => member.puuid)
    : [])
}

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
  root?.render(createElement(TeamHistoryModal, { open: true, mode: currentMode, onClose: close, party }))
}

function injectButton() {
  if (!mode) return false
  const container = document.querySelector(mode === 'bp' ? '.bottom-right-buttons' : '.game-in-progress-container')
  if (!container) {
    button?.remove()
    button = null
    syncInGameDetailsLayout(gameContainer); gameContainer = null
    return false
  }
  if (gameContainer && gameContainer !== container) {
    button?.remove(); button = null; syncInGameDetailsLayout(gameContainer); gameContainer = null
  }
  // The existing auto-popup feature has its own in-game button. It opens the same enhanced view.
  if (mode === 'game' && container?.querySelector('[data-sona-game-analysis]')) {
    button?.remove(); button = null; gameContainer = container; syncInGameDetailsLayout(container); return true
  }
  if (button && !button.isConnected) button = null
  if (!button) {
    button = document.createElement(mode === 'game' ? 'lol-uikit-flat-button' : 'button')
    if (button instanceof HTMLButtonElement) button.type = 'button'
    button.setAttribute(ATTR, mode)
    button.className = mode === 'bp' ? 'rh-team-entry' : 'rh-game-details-entry'
    button.textContent = mode === 'bp' ? '对局信息' : '对局详情'
    button.setAttribute('role','button'); button.setAttribute('tabindex','0')
    button.title = mode === 'bp' ? '查看英雄选择阶段的己方队伍' : '查看本局双方队伍的近期战绩'
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showOverview() })
    if (mode === 'game') button.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();showOverview()}})
  }
  if (button.parentElement !== container) {
    const build = mode === 'game' ? container.querySelector('[data-sona-opgg-ingame-build]') : null
    if (build?.parentElement === container) container.insertBefore(button,build); else container.appendChild(button)
  }
  if (mode === 'game') { gameContainer = container; syncInGameDetailsLayout(container) }
  return true
}

function changePhase(nextPhase: GameflowPhase) {
  const next = nextPhase === 'ChampSelect' ? 'bp' : nextPhase === 'InProgress' || nextPhase === 'Reconnect' ? 'game' : null
  if (nextPhase === phase && next === mode) return
  phase = nextPhase
  if (phase === 'None' || phase === 'Lobby') party = new Set()
  if (phase === 'Lobby' || phase === 'Matchmaking' || phase === 'ReadyCheck') {
    const version = phaseEvents
    const lobbyVersion = lobbyEvents
    void lcu.getLobby().then((lobby) => {
      if (version === phaseEvents && lobbyVersion === lobbyEvents) trackLobby(lobby)
    }).catch(() => {})
  }
  if (next === mode) return
  injector.unregister(injectButton)
  button?.remove(); button = null
  syncInGameDetailsLayout(gameContainer); gameContainer = null
  destroyModal()
  mode = next
  if (mode) injector.register(injectButton)
}

export function updateTeamHistoryOverview(enabled: boolean) {
  if (enabled && !unsub) {
    const id = ++subscriptionId, seen = phaseEvents
    const stopPhase = lcu.observe(LcuEventUri.GAMEFLOW_PHASE_CHANGE, (event) => { phaseEvents++; changePhase(event.data as GameflowPhase) })
    const stopSession = lcu.observe(LcuEventUri.GAMEFLOW_PHASE, (event) => {
      const current = event.data as { phase?: unknown } | null
      if (typeof current?.phase === 'string') {
        phaseEvents++
        changePhase(current.phase as GameflowPhase)
      }
    })
    const stopLobby = lcu.observe(LcuEventUri.LOBBY, (event) => {
      lobbyEvents++
      trackLobby(event.eventType === 'Delete' ? null : event.data as Lobby)
    })
    unsub = () => { stopPhase(); stopSession(); stopLobby() }
    void lcu.getGameflowPhase().then((phase) => { if (id === subscriptionId && seen === phaseEvents) changePhase(phase) }).catch(() => {})
  } else if (!enabled && unsub) {
    subscriptionId++
    unsub(); unsub = null
    changePhase('None')
  }
}
