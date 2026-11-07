import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PlayerHistoryModal } from '@/components/ui/PlayerHistoryModal'
import { registerEmberRule } from '@/lib/ember-hook'
import { deadline } from '@/lib/history-api'
import { injector } from '@/lib/InjectorManager'
import { lcu } from '@/lib/lcu'

const label = '详细战绩'
const profileIcon = 'lol-regalia-profile-v2-element'
const profileScreen = '.rcp-fe-lol-profiles-main, .rcp-fe-lol-profiles-modal'
const postgameActions = '.scoreboard-row-actions-button, .strawberry-scoreboard-row-actions-button, .jade-scoreboard-row-actions-button'

type Identity = { puuid?: string; summonerId?: number; name?: string; ownProfile?: boolean }
type Component = { element?: Element; get(key: string): unknown; set(key: string, value: unknown): void; _super(...args: unknown[]): unknown }
type MenuItem = { label: string; target: Component; action: (() => void) | string; icon?: Element }
type MenuManager = { setMenuItems(items: MenuItem[]): void; openAtEvent(event: MouseEvent): void }

let historyRoot: Root | undefined
let profileEntry: HTMLButtonElement | undefined
let summaryEntryHost: HTMLElement | undefined
let latestRequest = 0
let friendContextMenu: MenuManager | undefined
const summaryIdentities = new WeakMap<Element, Identity>()
const rowListeners = new WeakMap<Component, (event: Event) => void>()

function playerIdentity(value: unknown): Identity | undefined {
  if (!value || typeof value !== 'object') return
  const player = value as Record<string, unknown>
  if (player.botPlayer === true) return
  const puuid = typeof player.puuid === 'string' ? player.puuid.trim() : ''
  const summonerId = Number(player.summonerId)
  if (!puuid && !(summonerId > 0)) return
  const name = player.riotIdGameName || player.gameName || player.summonerName
  const tag = player.riotIdTagLine || player.riotIdTagline || player.tagLine || player.gameTag
  return {
    puuid,
    summonerId,
    name: typeof name === 'string' ? (typeof tag === 'string' && tag && !name.includes('#') ? `${name}#${tag}` : name) : undefined,
  }
}

async function openHistory(identity: Identity) {
  const request = ++latestRequest
  try {
    const profile = identity.puuid ? null : await deadline(() => identity.ownProfile
      ? lcu.getSummonerInfo()
      : lcu.getSummonerById(identity.summonerId!), undefined, 7000)
    const puuid = identity.puuid || profile?.puuid
    if (request !== latestRequest || !puuid) return
    if (!historyRoot) {
      const container = document.createElement('div')
      document.body.append(container)
      historyRoot = createRoot(container)
    }
    const name = identity.name || playerIdentity(profile)?.name || '玩家战绩'
    const close = () => {
      latestRequest++
      historyRoot?.render(createElement(PlayerHistoryModal, { open: false, onClose: close, puuid, playerName: name }))
    }
    historyRoot.render(createElement(PlayerHistoryModal, { open: true, onClose: close, puuid, playerName: name }))
  } catch {
    if (request === latestRequest && typeof Toast !== 'undefined') Toast.error('暂时无法查询这位召唤师的战绩')
  }
}

function menuItem(identity: Identity, target: Component): MenuItem {
  // The client's context menu dispatches actions only when the item has a target.
  return { label, target, action: () => void openHistory(identity) }
}

function visible(element: Element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible'
}

function profileIdentity(screen: Element): Identity | undefined {
  const summary = screen.querySelector('.match-summary-profile-main, .match-summary-profile-overlay')
  if (summary && visible(summary)) {
    const identity = summaryIdentities.get(summary)
    if (identity) return identity
  }
  const icon = Array.from(screen.querySelectorAll(profileIcon)).find(visible)
  if (!icon) return
  return playerIdentity({ puuid: icon.getAttribute('puuid'), summonerId: icon.getAttribute('summoner-id') })
}

function activeProfileScreen() {
  const screens = Array.from(document.querySelectorAll(profileScreen)).filter(visible).reverse()
  return screens.find((screen) => screen.classList.contains('rcp-fe-lol-profiles-modal')) ?? screens[0]
}

function injectProfileButton() {
  const screen = activeProfileScreen()
  const navigation = screen?.querySelector('.style-profile-sub-nav')
  const metadata = screen?.querySelector('.match-details-layer-header .match-layer-header-info-list')
  const summaryVisible = !!metadata && visible(metadata)
  const host = summaryVisible ? metadata : navigation?.parentElement
  let navigationUncovered = false
  if (navigation && visible(navigation)) {
    const rect = navigation.getBoundingClientRect()
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    navigationUncovered = !!top && navigation.contains(top)
  }
  if (!screen || !host || (!summaryVisible && !navigationUncovered) || !profileIdentity(screen)) {
    profileEntry?.remove()
    summaryEntryHost?.remove()
    return true
  }

  if (!profileEntry) {
    profileEntry = document.createElement('button')
    profileEntry.type = 'button'
    profileEntry.className = 'sona-profile-history-entry'
    profileEntry.textContent = label
    profileEntry.addEventListener('click', () => {
      const active = activeProfileScreen()
      const current = active && profileIdentity(active)
      if (current) void openHistory(current)
    })
  }
  profileEntry.classList.toggle('sona-profile-history-entry-inline', summaryVisible)
  if (summaryVisible) {
    if (!summaryEntryHost || summaryEntryHost.parentElement !== host) {
      summaryEntryHost?.remove()
      summaryEntryHost = document.createElement(host.matches('ul,ol') ? 'li' : 'span')
      summaryEntryHost.className = 'match-layer-header-info-item'
      host.append(summaryEntryHost)
    }
    if (profileEntry.parentElement !== summaryEntryHost) summaryEntryHost.append(profileEntry)
  } else {
    summaryEntryHost?.remove()
    summaryEntryHost = undefined
    if (profileEntry.parentElement !== host) host.append(profileEntry)
  }
  return true
}

export function enableNativeProfileHistory() {
  injector.register(injectProfileButton)
}

export function registerNativeHistoryHooks(context: PenguContext) {
  context.rcp.postInit('rcp-fe-lol-uikit', (value) => {
    const api = value as { getContextMenuManager?(): MenuManager } | undefined
    friendContextMenu = api?.getContextMenuManager?.()
  }, true)

  registerEmberRule({
    name: 'friend-context-player-history',
    matcher: 'lol-social-roster-member',
    wraps: [{
      name: 'contextMenu',
      replacement(original, args) {
        const component = this as Component
        const identity = playerIdentity(component.get('friend'))
        const event = args[0]
        const manager = friendContextMenu
        if (!identity || !manager || !(event instanceof MouseEvent)) return original(...args)
        event.preventDefault()
        component.set('isContextMenuOpened', true)
        return Promise.resolve(component.get('contextMenuModel')).then((model) => {
          if (!Array.isArray(model)) return
          const items = [...model] as MenuItem[]
          const translations = component.get('tra') as { get(key: string): string } | undefined
          const profileIndex = items.findIndex((item) => item.label === translations?.get('context_menu_view_profile'))
          const item = menuItem(identity, component)
          const icon = items[profileIndex]?.icon
          if (icon instanceof Element) item.icon = icon.cloneNode(true) as Element
          items.splice(profileIndex >= 0 ? profileIndex + 1 : Math.min(1, items.length), 0, item)
          manager.setMenuItems(items)
          manager.openAtEvent(event)
        })
      },
    }],
  })

  context.rcp.postInit('rcp-fe-lol-match-history', (value) => {
    const api = value as { displayMatchSummary?(...args: unknown[]): unknown } | undefined
    const display = api?.displayMatchSummary
    if (!api || typeof display !== 'function') return
    api.displayMatchSummary = function (options: unknown, ...rest: unknown[]) {
      const target = options as { rootElement?: unknown } | undefined
      const root = target?.rootElement
      if (root instanceof Element) {
        const identity = playerIdentity(options)
        if (identity) summaryIdentities.set(root, identity)
        else if (root.classList.contains('match-summary-profile-main')) summaryIdentities.set(root, { ownProfile: true })
        else summaryIdentities.delete(root)
      }
      return display.call(this, options, ...rest)
    }
  }, true)

  registerEmberRule({
    name: 'history-scoreboard-player-menu',
    matcher: 'player-history-object',
    wraps: [{
      name: 'getMenuItemModel',
      replacement(original, args) {
        const items = original(...args)
        const component = this as Component
        const identity = playerIdentity(component.get('participant.player'))
        return identity && Array.isArray(items) ? [...items, menuItem(identity, component)] : items
      },
    }],
  })

  registerEmberRule({
    name: 'postgame-player-history-item',
    matcher: 'scoreboard-row-actions-menu-component',
    mixin: () => ({
      didRender(this: Component, ...args: unknown[]) {
        this._super(...args)
        const container = this.element?.querySelector('.player-actions-menu-container')
        const previous = container?.querySelector('.sona-postgame-history-entry')
        if (!container || previous || !playerIdentity(this.get('data'))) return
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'player-action-container sona-postgame-history-entry'
        button.textContent = label
        button.addEventListener('click', () => {
          const identity = playerIdentity(this.get('data'))
          if (identity) void openHistory(identity)
        })
        container.append(button)
      },
    }),
  })

  for (const matcher of ['scoreboard-row-component', 'strawberry-scoreboard-row-component']) {
    registerEmberRule({
      name: `postgame-history-context-${matcher}`,
      matcher,
      mixin: () => ({
        didInsertElement(this: Component, ...args: unknown[]) {
          this._super(...args)
          const listener = (event: Event) => {
            const identity = playerIdentity(this.get('player'))
            if (!identity || !(event instanceof MouseEvent)) return
            if (event.composedPath().some((node) => node instanceof Element && node.matches('.player-actions-menu-container, lc-flyout'))) return
            const trigger = this.element?.querySelector<HTMLElement>(postgameActions)
            const menu = this.get('ContextMenuManager') as MenuManager | undefined
            if (!trigger && !menu?.openAtEvent) return
            event.preventDefault()
            event.stopPropagation()
            if (trigger) trigger.click()
            else {
              menu!.setMenuItems([menuItem(identity, this)])
              menu!.openAtEvent(event)
            }
          }
          rowListeners.set(this, listener)
          this.element?.addEventListener('contextmenu', listener)
        },
        willDestroyElement(this: Component, ...args: unknown[]) {
          const listener = rowListeners.get(this)
          if (listener) this.element?.removeEventListener('contextmenu', listener)
          rowListeners.delete(this)
          this._super(...args)
        },
      }),
    })
  }
}
