import { type Card, createEngine, type Engine, type SourceAdapter } from '@swipeline/core'
import { createMemoryStores, type MemoryEventStore } from '@swipeline/store-memory'

/**
 * A fixed deck instead of a network adapter: the smoke app has to prove the
 * binding and the engine work on a device, and a live API makes that result
 * depend on someone else's uptime. The web examples still share
 * `examples/shared/decks.ts`; this app is the native smoke path.
 */
const CARDS: readonly Card[] = [
  {
    schemaVersion: 1,
    id: 'expo:1',
    sourceId: 'expo-smoke',
    title: 'Project Hail Mary',
    subtitle: 'Andy Weir',
    body: 'A lone astronaut wakes with no memory and one job: save the solar system.',
    tags: ['science fiction', 'space'],
    facts: [
      { label: 'Pages', value: 496 },
      { label: 'Rating', value: 4.5, unit: '★' },
    ],
    fetchedAt: '2026-11-27T00:00:00.000Z',
  },
  {
    schemaVersion: 1,
    id: 'expo:2',
    sourceId: 'expo-smoke',
    title: 'The Left Hand of Darkness',
    subtitle: 'Ursula K. Le Guin',
    body: 'An envoy on a frozen world learns how much of gender is assumption.',
    tags: ['science fiction', 'classic'],
    fetchedAt: '2026-11-27T00:00:00.000Z',
  },
  {
    schemaVersion: 1,
    id: 'expo:3',
    sourceId: 'expo-smoke',
    title: 'Piranesi',
    subtitle: 'Susanna Clarke',
    body: 'A man keeps a journal of an infinite house and the tides that flood it.',
    tags: ['fantasy', 'mystery'],
    fetchedAt: '2026-11-27T00:00:00.000Z',
  },
  {
    schemaVersion: 1,
    id: 'expo:4',
    sourceId: 'expo-smoke',
    title: 'The Overstory',
    subtitle: 'Richard Powers',
    body: 'Nine strangers, one forest, and the time scale trees actually live on.',
    tags: ['literary fiction', 'nature'],
    fetchedAt: '2026-11-27T00:00:00.000Z',
  },
]

const fixtureSource: SourceAdapter<Card> = {
  id: 'expo-smoke',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: [...CARDS] }
  },
  normalize(raw) {
    return raw
  },
}

export interface SmokeDeck {
  store: Engine
  events: MemoryEventStore
}

/** One deck with a memory log, so a scripted swipe is visible and inspectable. */
export function createSmokeDeck(): SmokeDeck {
  const stores = createMemoryStores()
  const store = createEngine({
    deckId: 'books',
    actor: 'expo-smoke',
    source: fixtureSource,
    events: stores.events,
  })
  return { store, events: stores.events }
}
