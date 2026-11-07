import { useSyncExternalStore } from 'react'
import { store } from './store'
import { getPlayerScoreSystem } from './player-score'

const subscribe = (callback: () => void) => store.onChange('playerScoreSystem',callback)
export function usePlayerScoreSystem() {
  return useSyncExternalStore(subscribe,getPlayerScoreSystem)
}
