import { init } from '@/index'
import { enableNativeProfileHistory } from '@/lib/features/native-history-entry'

type Prototype = Record<string, unknown>
type FixtureClass = { proto(): Prototype; extend(...mixins: Prototype[]): FixtureClass }

function extend(parent: Prototype, ...mixins: Prototype[]): FixtureClass {
  const prototype: Prototype = Object.create(parent)
  for (const mixin of mixins) {
    for (const [key, value] of Object.entries(mixin)) {
      const original = prototype[key]
      prototype[key] = typeof value === 'function' ? function (this: Prototype, ...args: unknown[]) {
        this._super = typeof original === 'function' ? original.bind(this) : () => {}
        return value.apply(this, args)
      } : value
    }
  }
  return { proto: () => prototype, extend: (...next) => extend(prototype, ...next) }
}

export async function setupNativeHistoryFixture(socket: PenguContext['socket']) {
  const friendMenuManager = {
    items: [] as Array<{label: string; icon?: Element; action: () => void; target: unknown}>,
    setMenuItems(items: typeof this.items) { this.items = items },
    openAtEvent() {
      document.querySelector('.qa-friend-context-menu')?.remove()
      const menu = document.createElement('div')
      menu.className = 'qa-friend-context-menu'
      for (const item of this.items) {
        const button = document.createElement('button')
        button.className = 'menu-item with-icon'
        if (item.icon) button.append(item.icon.cloneNode(true))
        button.append(item.label)
        button.addEventListener('click', () => { item.action.call(item.target); menu.remove() })
        menu.append(button)
      }
      document.body.append(menu)
    },
  }
  const matchApi = { displayMatchSummary(_options: unknown) {} }
  const emberApi = { getEmber: async () => ({ Component: extend({}) }) }
  const context = {
    meta: { name: 'sona' },
    socket,
    rcp: {
      postInit(name: string, callback: (api: unknown) => void) {
        if (name === 'rcp-fe-lol-match-history') callback(matchApi)
        if (name === 'rcp-fe-ember-libs') callback(emberApi)
        if (name === 'rcp-fe-lol-uikit') callback({ getContextMenuManager: () => friendMenuManager })
      },
    },
  } as unknown as PenguContext
  init(context)
  enableNativeProfileHistory()
  const { Component } = await emberApi.getEmber()
  const summonerClass = Component.extend({ classNames: ['summoner-object'] })

  function mountSummoner(element: HTMLElement, data: Record<string, unknown>) {
    const row = Object.assign(Object.create(summonerClass.proto()), { element, get: (key: string) => data[key] })
    row.didInsertElement()
    return {
      update(patch: Record<string, unknown>) {
        Object.assign(data, patch)
        row.didRender()
      },
      destroy: () => row.willDestroyElement(),
    }
  }

  function mountHistory() {
    const fixture = document.createElement('section')
    fixture.innerHTML = `
      <div class="rcp-fe-lol-profiles-main" style="position:relative;min-height:175px">
        <div class="style-profile-sub-nav">自己的生涯导航</div>
        <lol-regalia-profile-v2-element puuid="preview-player-0">我的生涯</lol-regalia-profile-v2-element>
        <input aria-label="原生搜索框" style="position:absolute;right:70px;top:93px;width:240px;height:32px">
      </div>
      <button type="button" id="qa-open-profile">查看他人生涯</button>
      <button type="button" id="qa-customize-profile">编辑身份</button>
      <button type="button" id="qa-close-profile">关闭他人生涯</button>
      <div class="rcp-fe-lol-profiles-modal" style="position:relative;min-height:60px">
        <div class="style-profile-sub-nav">生涯导航</div>
        <lol-regalia-profile-v2-element puuid="deadbeef-cafe-5eed-babe-f00df00df00d">召唤师生涯</lol-regalia-profile-v2-element>
      </div>
      <button type="button" id="qa-open-summary">切换至对局记录</button>
      <div class="lol-social-roster-member" style="padding:8px">好友玩家</div>
      <div class="player-history-object" style="padding:8px">历史战报玩家</div>
      <div class="scoreboard-row-component" style="padding:8px"><span>结算玩家</span>
        <button type="button" class="scoreboard-row-actions-button">更多操作</button>
      </div>`
    document.body.prepend(fixture)
    const profile = fixture.querySelector('.rcp-fe-lol-profiles-modal')!
    profile.remove()
    fixture.querySelector('#qa-open-profile')!.addEventListener('click', () => fixture.prepend(profile))
    fixture.querySelector('#qa-customize-profile')!.addEventListener('click', () => {
      const overlay = document.createElement('div')
      overlay.className = 'qa-identity-overlay'
      overlay.style.cssText = 'position:fixed;inset:0;background:#101a24;z-index:15000'
      const close = document.createElement('button')
      close.textContent = '关闭身份'
      close.addEventListener('click', () => overlay.remove())
      overlay.append(close)
      document.body.append(overlay)
    })
    fixture.querySelector('#qa-close-profile')!.addEventListener('click', () => profile.remove())
    fixture.querySelector('#qa-open-summary')!.addEventListener('click', () => {
      profile.querySelector('lol-regalia-profile-v2-element')?.remove()
      const summary = document.createElement('div')
      summary.className = 'match-summary-profile-overlay'
      summary.style.cssText = 'position:relative;min-height:60px'
      summary.innerHTML = '<div class="match-details-layer-header"><div class="match-layer-header-info-list" style="display:flex;gap:6px;width:300px">对局记录</div><button data-testid="qa-native-replay" style="position:absolute;right:0;top:0">下载回放</button></div>'
      profile.append(summary)
      matchApi.displayMatchSummary({ rootElement: summary, summonerId: 103 })
    })
    const createInstance = (klass: FixtureClass, element: Element, data: Record<string, unknown>) =>
      Object.assign(Object.create(klass.proto()), { element, get: (key: string) => data[key], set: (key: string, value: unknown) => { data[key] = value } })
    const friendRow = fixture.querySelector('.lol-social-roster-member')!
    const profileIcon = document.createElement('span')
    profileIcon.className = 'menu-item-icon icon-profile'
    const friendClass = Component.extend({ classNames: ['lol-social-roster-member'], contextMenu() {} })
    const friend = createInstance(friendClass, friendRow, {
      friend: { puuid: 'preview-player-6', gameName: '云端烟火', gameTag: 'DEMO' },
      tra: { get: () => '查看生涯' },
      contextMenuModel: Promise.resolve([
        { label: '发送信息', action() {}, icon: profileIcon },
        { label: '查看生涯', action() {}, icon: profileIcon },
      ]),
    })
    friendRow.addEventListener('contextmenu', (event) => friend.contextMenu(event))
    const historyClass = Component.extend({
      classNames: ['player-history-object'],
      getMenuItemModel() { return [{ label: '查看资料', target: this, action() {} }] },
    })
    const historyRow = fixture.querySelector('.player-history-object')!
    const history = createInstance(historyClass, historyRow, {
      'participant.player': { puuid: 'preview-player-4', summonerName: '海盐风铃' },
    })
    historyRow.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      fixture.querySelector('.qa-context-menu')?.remove()
      const menu = document.createElement('div')
      menu.className = 'qa-context-menu'
      for (const item of history.getMenuItemModel()) {
        const button = document.createElement('button')
        button.textContent = item.label
        button.addEventListener('click', () => {
          if (!item.target) return
          item.action.call(item.target)
          menu.remove()
        })
        menu.append(button)
      }
      historyRow.after(menu)
    })
    const row = fixture.querySelector('.scoreboard-row-component')!
    const player = { puuid: 'preview-player-5', riotIdGameName: '白昼拾荒', riotIdTagLine: 'DEMO' }
    const rowClass = Component.extend({ classNames: ['scoreboard-row-component'] })
    const postgame = createInstance(rowClass, row, { player })
    postgame.didInsertElement()
    row.querySelector('button')!.addEventListener('click', () => {
      row.querySelector('.scoreboard-row-actions-menu-component')?.remove()
      const menu = document.createElement('div')
      menu.className = 'scoreboard-row-actions-menu-component'
      menu.innerHTML = '<div class="player-actions-menu-container"><button>查看资料</button></div>'
      row.append(menu)
      const menuClass = Component.extend({ classNames: ['scoreboard-row-actions-menu-component'] })
      const actions = createInstance(menuClass, menu, { data: player })
      actions.didRender()
      menu.addEventListener('click', () => menu.remove())
    })
  }
  return { mountHistory, mountSummoner }
}
