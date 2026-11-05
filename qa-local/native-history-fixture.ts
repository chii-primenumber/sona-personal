import { installEmberHook } from '@/lib/ember-hook'
import { enableNativeProfileHistory, registerNativeHistoryHooks } from '@/lib/features/native-history-entry'

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

export async function setupNativeHistoryFixture() {
  const matchApi = { displayMatchSummary(_options: unknown) {} }
  const emberApi = { getEmber: async () => ({ Component: extend({}) }) }
  const context = {
    rcp: {
      postInit(name: string, callback: (api: unknown) => void) {
        if (name === 'rcp-fe-lol-match-history') callback(matchApi)
        if (name === 'rcp-fe-ember-libs') callback(emberApi)
      },
    },
  } as unknown as PenguContext
  installEmberHook(context)
  registerNativeHistoryHooks(context)
  enableNativeProfileHistory()
  const { Component } = await emberApi.getEmber()

  return function mount() {
    const fixture = document.createElement('section')
    fixture.innerHTML = `
      <div class="rcp-fe-lol-profiles-modal" style="position:relative;min-height:60px">
        <div class="style-profile-sub-nav">生涯导航</div>
        <lol-regalia-profile-v2-element puuid="preview-player-2">召唤师生涯</lol-regalia-profile-v2-element>
      </div>
      <button type="button" id="qa-open-summary">切换至对局记录</button>
      <div class="player-history-object" style="padding:8px">历史战报玩家</div>
      <div class="scoreboard-row-component" style="padding:8px"><span>结算玩家</span>
        <button type="button" class="scoreboard-row-actions-button">更多操作</button>
      </div>`
    document.body.prepend(fixture)
    const profile = fixture.querySelector('.rcp-fe-lol-profiles-modal')!
    fixture.querySelector('#qa-open-summary')!.addEventListener('click', () => {
      profile.querySelector('lol-regalia-profile-v2-element')?.remove()
      const summary = document.createElement('div')
      summary.className = 'match-summary-profile-overlay'
      summary.textContent = '对局记录'
      profile.append(summary)
      matchApi.displayMatchSummary({ rootElement: summary, summonerId: 103 })
    })
    const createInstance = (klass: FixtureClass, element: Element, data: Record<string, unknown>) =>
      Object.assign(Object.create(klass.proto()), { element, get: (key: string) => data[key] })
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
}
