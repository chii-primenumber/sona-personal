import { useSyncExternalStore } from 'react'
import { store } from '@/lib/store'

function subscribe(callback: () => void) {
  return store.onChange('historyHiddenFields', callback)
}

function snapshot() {
  return store.get('historyHiddenFields')
}

export function useHistoryHiddenFields() {
  return useSyncExternalStore(subscribe, snapshot)
}
