type Identity = { puuid?: string; summonerId?: number; name?: string; ownProfile?: boolean }
type MenuItem = { label?: string; action?: unknown; target?: unknown; args?: unknown[]; icon?: unknown }
type Reader = (value: unknown) => Identity | undefined
const managers = new WeakSet<object>()
const apis = new WeakSet<object>()

function read(target: unknown, key: string): unknown {
  if (!target || typeof target !== 'object') return undefined
  const object = target as Record<string, unknown>
  try { if (typeof object.get === 'function') { const value=object.get.call(target,key); if(value!==undefined) return value } } catch {}
  return object[key]
}

function profileItem(item: MenuItem): boolean {
  if (typeof item.action === 'string' && /view.*profile/i.test(item.action)) return true
  const icon = item.icon as Element | undefined
  if (typeof icon?.getAttribute === 'function') {
    const classes = icon.getAttribute('class') || ''
    if (/(?:^|\s)(?:profile|icon-profile)(?:\s|$)/.test(classes)) return true
    if ((icon.getAttribute('style') || '').includes('profile-mask')) return true
  }
  return /^(?:查看生涯|查看资料|view profile|profile)$/i.test(item.label?.trim() || '')
}

function profileIcon(original: unknown): Element {
  const node = original as Element | undefined
  if (node?.nodeType === 1 && typeof node.cloneNode === 'function') return node.cloneNode(true) as Element
  const icon = document.createElement('div')
  icon.className = 'lol-social-context-menu-icon profile'
  icon.setAttribute('aria-hidden','true')
  icon.style.cssText = 'width:18px;height:18px;display:block;background-color:#c8aa6e;-webkit-mask:url(/fe/lol-social/profile-mask.svg) no-repeat center / contain;'
  return icon
}

function augment(items: MenuItem[], identify: Reader, open: (identity: Identity) => void, label: string): MenuItem[] {
  if (items.some((item)=>item.label===label)) return items
  const index = items.findIndex(profileItem)
  if (index < 0) return items
  const profile = items[index]
  const candidates = [...(profile.args || []),read(profile.target,'friend'),read(profile.target,'data.friend'),read(read(profile.target,'data'),'friend')]
  const identity = candidates.map(identify).find(Boolean)
  if (!identity) return items
  const entry = {label,target:profile.target || {},icon:profileIcon(profile.icon),disabled:false,action:()=>open(identity)}
  return [...items.slice(0,index+1),entry,...items.slice(index+1)]
}

export function installFriendHistoryMenu(apiValue: unknown, identify: Reader, open: (identity: Identity) => void, label: string) {
  const api = apiValue as {getContextMenuManager?:(...args: unknown[])=>unknown} | undefined
  if (!api || typeof api.getContextMenuManager !== 'function') return
  const install = (value: unknown) => {
    if (!value || typeof value !== 'object' || managers.has(value)) return
    const manager = value as Record<string,unknown>
    if (typeof manager.setMenuItems !== 'function') return
    for (const name of ['setMenuItems','setCustomMenuItems']) {
      const original = manager[name]
      if (typeof original !== 'function') continue
      manager[name] = function(this:unknown,...args:unknown[]) {
        if (Array.isArray(args[0])) {
          try { args[0] = augment(args[0],identify,open,label) } catch { /* Preserve the native menu on malformed data. */ }
        }
        return original.apply(this,args)
      }
    }
    managers.add(value)
  }
  const observe = (value: unknown) => {
    if (value && typeof (value as Promise<unknown>).then === 'function') void Promise.resolve(value).then(install).catch(()=>{})
    else install(value)
  }
  if (!apis.has(api)) {
    const original = api.getContextMenuManager
    api.getContextMenuManager = function(...args:unknown[]) { const result=original.apply(this,args); observe(result); return result }
    apis.add(api)
  }
  try { observe(api.getContextMenuManager()) } catch { /* Later calls to the getter will install the hook. */ }
}
