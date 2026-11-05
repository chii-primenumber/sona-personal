import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EnemyOpggMatchupModal } from '@/components/ui/EnemyOpggMatchupModal'
import { injector } from '@/lib/InjectorManager'
import { lcu, LcuEventUri, type ChampSelectSession } from '@/lib/lcu'
import { mapAssignedPosition, type OpggPosition } from '@/lib/opgg-api'
import type { GameflowPhase } from '@/types/lcu'

const ENEMY_ICON = '.party.visible .summoner-wrapper.visible.right .champion-icon-container'
const ATTR = 'data-sona-enemy-matchup'
let started = false
let inChampSelect = false
let phaseRevision = 0
let sessionRevision = 0
let queueId = 0
let lockedPicks = new Map<number, OpggPosition>()
let root: Root | undefined
let host: HTMLElement | undefined
let openChampion = 0

function championIdFromIcon(icon: Element): number {
  const image = icon.querySelector('img[src*="/champion-icons/"]')
  const portrait = icon.querySelector('.portrait-icon[style*="/champion-icons/"]')
  const source = image?.getAttribute('src') ?? portrait?.getAttribute('style') ?? ''
  return Number(source.match(/\/champion-icons\/(\d+)\.(?:png|jpg|webp)\b/i)?.[1] ?? 0)
}

function markEnemyIcons() {
  for (const icon of document.querySelectorAll(`${ENEMY_ICON}, [${ATTR}]`)) {
    const clickable = icon.matches(ENEMY_ICON) && lockedPicks.has(championIdFromIcon(icon))
    if (clickable !== icon.hasAttribute(ATTR)) icon.toggleAttribute(ATTR, clickable)
  }
  return true
}

function closeMatchups() {
  openChampion = 0
  root?.unmount()
  root = undefined
  host?.remove()
  host = undefined
}

function updatePicks(session: ChampSelectSession | null) {
  const next = new Map<number, OpggPosition>()
  if (session && !session.isCustomGame && !session.isSpectating && (session.queueId === 420 || session.queueId === 440)) {
    const completed = new Map(session.actions?.flat(2)
      .filter((action) => action.type === 'pick' && action.completed && action.championId > 0)
      .map((action) => [action.actorCellId, action.championId]))
    const finalized = session.timer?.phase === 'FINALIZATION' || session.timer?.phase === 'GAME_STARTING'
    for (const player of session.theirTeam ?? []) {
      const picked = completed.get(player.cellId)
      if (!picked) continue
      const championId = finalized && player.championId > 0 ? player.championId : picked
      next.set(championId, mapAssignedPosition(player.assignedPosition))
    }
  }
  const hadPicks = lockedPicks.size > 0
  lockedPicks = next
  queueId = session?.queueId ?? 0
  if (openChampion && !lockedPicks.has(openChampion)) closeMatchups()
  if (!hadPicks && next.size) injector.register(markEnemyIcons)
  else if (hadPicks && !next.size) injector.unregister(markEnemyIcons)
  if (hadPicks || next.size) {
    markEnemyIcons()
    if (next.size) requestAnimationFrame(markEnemyIcons)
  }
}

function handleEnemyIconClick(event: MouseEvent) {
  if (event.button !== 0 || !lockedPicks.size || !(event.target instanceof Element)) return
  const icon = event.target.closest(ENEMY_ICON)
  if (!icon) return
  const championId = championIdFromIcon(icon)
  const initialPosition = lockedPicks.get(championId)
  if (!initialPosition) return
  event.preventDefault()
  event.stopPropagation()
  if (!root) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }
  openChampion = championId
  root.render(createElement(EnemyOpggMatchupModal, { key: championId, championId, queueId, initialPosition, onClose: closeMatchups }))
}

function changePhase(phase: GameflowPhase) {
  inChampSelect = phase === 'ChampSelect'
  const revision = ++sessionRevision
  if (!inChampSelect) {
    updatePicks(null)
    return
  }
  void lcu.getChampSelectSession().then((session) => {
    if (revision === sessionRevision) updatePicks(session)
  }).catch(() => {})
}

export function enableEnemyOpggMatchups() {
  if (started) return
  started = true
  document.addEventListener('click', handleEnemyIconClick, true)
  lcu.observe(LcuEventUri.CHAMP_SELECT, (event) => {
    if (!inChampSelect) return
    sessionRevision++
    updatePicks(event.eventType === 'Delete' ? null : event.data as ChampSelectSession | null)
  })
  lcu.observe(LcuEventUri.GAMEFLOW_PHASE_CHANGE, (event) => {
    phaseRevision++
    changePhase(event.data as GameflowPhase)
  })
  const revision = phaseRevision
  void lcu.getGameflowPhase().then((phase) => {
    if (revision === phaseRevision) changePhase(phase)
  }).catch(() => {})
}
