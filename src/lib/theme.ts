import { store } from '@/lib/store'
import '@/styles/Theme.css'

export type SonaTheme = 'client' | 'slate'

export function initSonaTheme() {
  const applyTheme = (theme: SonaTheme) => {
    document.documentElement.dataset.sonaTheme = theme === 'slate' ? 'slate' : 'client'
  }
  applyTheme(store.get('theme'))
  return store.onChange('theme', applyTheme)
}
