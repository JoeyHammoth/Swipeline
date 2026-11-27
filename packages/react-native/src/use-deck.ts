import type { DeckSnapshot, DeckStore } from '@swipeline/core'
import { useSyncExternalStore } from 'react'

/**
 * Subscribes a component to the engine's snapshot. `getServerSnapshot` keeps the
 * hook safe if an app also renders this tree with React Native Web on a server.
 */
export function useDeck(store: DeckStore): DeckSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
