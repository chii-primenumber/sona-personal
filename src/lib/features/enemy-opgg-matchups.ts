import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EnemyOpggMatchupModal } from '@/components/ui/EnemyOpggMatchupModal'
import { registerEmberRule } from '@/lib/ember-hook'
import { lcu, LcuEventUri } from '@/lib/lcu'
import { mapAssignedPosition } from '@/lib/opgg-api'

const ATTR = 'data-sona-enemy-matchup'
const DRAFT_MODES = new Set(['DraftModeSinglePickStrategy', 'TeamBuilderSimulBanStrategy', 'TeamBuilderDraftPickStrategy', 'TournamentPickStrategy'])

interface SummonerRow {
  element?: HTMLElement
  get(key: string): unknown
  _super(...args: unknown[]): unknown
}

const bindings = new WeakMap<SummonerRow, { icon: HTMLElement; click: (event: MouseEvent) => void }>()
let root: Root | undefined
let host: HTMLElement | undefined
let openRow: SummonerRow | undefined
let openChampion = 0

function enemyPick(row: SummonerRow) {
  const queueId = Number(row.get('queueId')) || 0
  const allowed = row.get('isCustomGame')
    ? DRAFT_MODES.has(String(row.get('summoner.root.queue.pickMode')))
    : queueId === 420 || queueId === 440
  if (!allowed || row.get('summoner.root.isSpectating') || row.get('isChampSelectShown') === false ||
      row.get('isLeft') !== false || row.get('summoner.isOnPlayersTeam') !== false ||
      row.get('summoner.isDonePicking') !== true) return null
  const championId = Number(row.get('summoner.championId'))
  if (!Number.isInteger(championId) || championId <= 0) return null
  const position = row.get('summoner.assignedPosition')
  return { championId, queueId, initialPosition: mapAssignedPosition(typeof position === 'string' ? position : undefined) }
}

function closeMatchups() {
  openRow = undefined
  openChampion = 0
  root?.unmount()
  root = undefined
  host?.remove()
  host = undefined
}

function removeBinding(row: SummonerRow) {
  const binding = bindings.get(row)
  if (!binding) return
  binding.icon.removeEventListener('click', binding.click, true)
  binding.icon.removeAttribute(ATTR)
  bindings.delete(row)
}

function syncBinding(row: SummonerRow) {
  // Read the same hero and lock state used by the native summoner row to render its portrait.
  const pick = enemyPick(row)
  const icon = row.element?.querySelector<HTMLElement>('.champion-icon-container')
  if (openRow === row && pick?.championId !== openChampion) closeMatchups()
  if (!pick || !icon) {
    removeBinding(row)
    return
  }
  if (bindings.get(row)?.icon === icon) return
  removeBinding(row)

  const click = (event: MouseEvent) => {
    if (event.button !== 0) return
    const current = enemyPick(row)
    if (!current) return
    event.preventDefault()
    event.stopPropagation()
    if (!root) {
      host = document.createElement('div')
      document.body.appendChild(host)
      root = createRoot(host)
    }
    openRow = row
    openChampion = current.championId
    root.render(createElement(EnemyOpggMatchupModal, {
      ...current,
      key: current.championId,
      onClose: closeMatchups,
    }))
  }
  icon.setAttribute(ATTR, '')
  icon.addEventListener('click', click, true)
  bindings.set(row, { icon, click })
}

export function registerEnemyOpggMatchups() {
  registerEmberRule({
    name: 'enemy-opgg-matchup-row',
    matcher: 'summoner-object',
    mixin: () => ({
      didInsertElement(this: SummonerRow, ...args: unknown[]) {
        this._super(...args)
        syncBinding(this)
      },
      didRender(this: SummonerRow, ...args: unknown[]) {
        this._super(...args)
        syncBinding(this)
      },
      willDestroyElement(this: SummonerRow, ...args: unknown[]) {
        removeBinding(this)
        if (openRow === this) closeMatchups()
        this._super(...args)
      },
    }),
  })
  lcu.observe(LcuEventUri.GAMEFLOW_PHASE_CHANGE, (event) => {
    if (event.data !== 'ChampSelect' && openRow) closeMatchups()
  })
}
