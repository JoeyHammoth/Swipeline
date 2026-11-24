import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  type Card,
  compareEvents,
  createEngine,
  createUlid,
  type EventQuery,
  type EventStore,
  isUlid,
  type SourceAdapter,
  type SwipeEvent,
} from '../src/index.js'

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)
const ISO = new Date(NOW).toISOString()

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Deterministic ULID-shaped ids: 23-character prefix plus a base32 counter. */
function sequentialIds(): () => string {
  let counter = 0
  return () => {
    let value = counter
    counter += 1
    let suffix = ''
    for (let index = 0; index < 3; index += 1) {
      suffix = ALPHABET.charAt(value % 32) + suffix
      value = Math.floor(value / 32)
    }
    return `01JC0B5V6Q9F3ZK2M4N7P8R${suffix}`
  }
}

class RecordingEventStore implements EventStore {
  readonly events: SwipeEvent[] = []
  failNextAppend = false

  async append(batch: readonly SwipeEvent[]): Promise<void> {
    if (this.failNextAppend) {
      this.failNextAppend = false
      throw new Error('disk full')
    }
    for (const event of batch) {
      if (this.events.some((existing) => existing.id === event.id)) continue
      this.events.push(event)
    }
    this.events.sort(compareEvents)
  }

  async query(query: EventQuery): Promise<readonly SwipeEvent[]> {
    return this.events.filter(
      (event) =>
        (query.actor === undefined || event.actor === query.actor) &&
        (query.deckId === undefined || event.deckId === query.deckId),
    )
  }

  async export(query: EventQuery): Promise<readonly SwipeEvent[]> {
    return this.query(query)
  }

  async erase(actor: string): Promise<number> {
    const before = this.events.length
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (this.events[index]?.actor === actor) this.events.splice(index, 1)
    }
    return before - this.events.length
  }
}

interface RawItem {
  id: string
  title: string
  tags: string[]
}

interface SourceOptions {
  pageSize?: number
  failFirst?: boolean
  queryLog?: string[]
}

function makeSource(total = 12, options: SourceOptions = {}): SourceAdapter<RawItem> {
  const pageSize = options.pageSize ?? 5
  let failed = false

  return {
    id: 'test',
    capabilities: { pagination: 'cursor', search: true },
    async fetch(context) {
      options.queryLog?.push(context.query ?? '')
      if (options.failFirst && !failed) {
        failed = true
        throw new Error('network down')
      }
      const start = context.cursor === undefined ? 0 : Number(context.cursor)
      const end = Math.min(total, start + pageSize)
      const items: RawItem[] = []
      for (let index = start; index < end; index += 1) {
        items.push({ id: String(index), title: `Card ${index}`, tags: ['fiction'] })
      }
      const nextCursor = end < total ? String(end) : undefined
      return nextCursor === undefined ? { items } : { items, nextCursor }
    },
    normalize(raw) {
      const card: Card = {
        schemaVersion: 1,
        id: `test:${raw.id}`,
        sourceId: 'test',
        title: raw.title,
        tags: raw.tags,
        fetchedAt: ISO,
      }
      return card
    },
  }
}

function makeEvent(overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: '01JC0B5V6Q9F3ZK2M4N7P8RS0',
    deckId: 'books',
    cardId: 'test:0',
    actor: 'actor-1',
    action: 'like',
    position: 0,
    ts: ISO,
    ...overrides,
  }
}

function setup(
  options: { total?: number; source?: SourceAdapter<RawItem>; events?: RecordingEventStore } = {},
) {
  const events = options.events ?? new RecordingEventStore()
  const store = createEngine({
    deckId: 'books',
    actor: 'actor-1',
    source: options.source ?? makeSource(options.total ?? 12),
    events,
    clock: () => NOW,
    idFactory: sequentialIds(),
  })
  return { store, events }
}

async function loaded(options: Parameters<typeof setup>[0] = {}) {
  const context = setup(options)
  context.store.dispatch({ type: 'refill' })
  await context.store.whenSettled()
  return context
}

describe('createUlid', () => {
  it('produces Crockford base32 ULIDs', () => {
    const id = createUlid({ now: NOW, random: () => 0.5 })
    expect(id).toHaveLength(26)
    expect(isUlid(id)).toBe(true)
  })

  it('sorts by time', () => {
    const earlier = createUlid({ now: NOW, random: () => 0.1 })
    const later = createUlid({ now: NOW + 1, random: () => 0.1 })
    expect(earlier < later).toBe(true)
  })

  it('is deterministic when now and random are injected', () => {
    expect(createUlid({ now: NOW, random: () => 0.25 })).toBe(
      createUlid({ now: NOW, random: () => 0.25 }),
    )
  })
})

describe('deck engine snapshots', () => {
  it('starts idle with a stable frozen server snapshot', () => {
    const { store } = setup()
    const snapshot = store.getSnapshot()
    expect(snapshot.state).toBe('idle')
    expect(snapshot.cards).toEqual([])
    expect(snapshot.position).toBe(0)
    expect(snapshot.canUndo).toBe(false)
    expect(snapshot.version).toBe(0)
    expect(store.getServerSnapshot()).toBe(snapshot)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.cards)).toBe(true)
  })

  it('notifies subscribers and returns the same object when nothing changed', async () => {
    const { store } = await loaded()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })

    const snapshot = store.getSnapshot()
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    expect(store.getSnapshot()).toBe(snapshot)
    expect(calls).toBe(0)

    unsubscribe()
    store.dispatch({ type: 'setDragging', dragging: true })
    expect(calls).toBe(0)
    expect(store.getSnapshot().state).toBe('dragging')
  })

  it('keeps the server snapshot frozen at the initial state', async () => {
    const { store } = await loaded()
    const server = store.getServerSnapshot()
    expect(server.state).toBe('idle')
    expect(server.cards).toEqual([])
    expect(store.getSnapshot()).not.toBe(server)
  })
})

describe('deck engine loading', () => {
  it('prefetches to the buffer size and keeps a preview', async () => {
    const { store } = await loaded()
    const snapshot = store.getSnapshot()
    expect(snapshot.state).toBe('ready')
    expect(snapshot.cards).toHaveLength(8)
    expect(snapshot.loadingMore).toBe(false)
  })

  it('refetches when the buffer drops to the refill threshold', async () => {
    const queryLog: string[] = []
    const { store } = await loaded({ source: makeSource(9, { pageSize: 4, queryLog }) })
    expect(store.getSnapshot().cards).toHaveLength(8)

    for (let index = 0; index < 6; index += 1) {
      const card = store.getSnapshot().cards[0]
      expect(card).toBeDefined()
      store.dispatch({ type: 'swipe', action: 'like', cardId: card?.id ?? '' })
      await store.whenSettled()
    }

    expect(store.getSnapshot().cards).toHaveLength(3)
    expect(queryLog.length).toBeGreaterThan(1)
  })

  it('reaches exhausted when the source runs out', async () => {
    const { store } = await loaded({ total: 3, source: makeSource(3, { pageSize: 2 }) })
    expect(store.getSnapshot().cards).toHaveLength(3)

    for (let index = 0; index < 3; index += 1) {
      const card = store.getSnapshot().cards[0]
      store.dispatch({ type: 'swipe', action: 'like', cardId: card?.id ?? '' })
      await store.whenSettled()
    }

    expect(store.getSnapshot().state).toBe('exhausted')
    expect(store.getSnapshot().cards).toEqual([])
  })

  it('excludes cards already present in the event log', async () => {
    const events = new RecordingEventStore()
    await events.append([makeEvent()])
    const { store } = await loaded({ events })
    expect(store.getSnapshot().cards[0]?.id).toBe('test:1')
  })

  it('surfaces a source failure and recovers on retry', async () => {
    const { store } = await loaded({ source: makeSource(12, { failFirst: true }) })
    const failed = store.getSnapshot()
    expect(failed.state).toBe('error')
    expect(failed.lastError?.code).toBe('source_fetch_failed')
    expect(failed.lastError?.retryable).toBe(true)

    store.dispatch({ type: 'retry' })
    await store.whenSettled()
    expect(store.getSnapshot().state).toBe('ready')
    expect(store.getSnapshot().lastError).toBeUndefined()
  })

  it('reloads with a new query and resets the session', async () => {
    const queryLog: string[] = []
    const { store } = await loaded({ source: makeSource(12, { queryLog }) })
    const card = store.getSnapshot().cards[0]
    store.dispatch({ type: 'swipe', action: 'like', cardId: card?.id ?? '' })
    await store.whenSettled()
    expect(store.getSnapshot().position).toBe(1)

    store.dispatch({ type: 'setQuery', query: 'space opera' })
    await store.whenSettled()
    expect(queryLog).toContain('space opera')
    expect(store.getSnapshot().position).toBe(0)
    expect(store.getSnapshot().canUndo).toBe(false)
    expect(store.getSnapshot().state).toBe('ready')
  })

  it('blocks fetching while offline and resumes afterwards', async () => {
    const { store } = setup()
    store.dispatch({ type: 'setOffline', offline: true })
    expect(store.getSnapshot().state).toBe('offline')

    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    expect(store.getSnapshot().cards).toEqual([])

    store.dispatch({ type: 'setOffline', offline: false })
    expect(store.getSnapshot().state).toBe('idle')
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    expect(store.getSnapshot().state).toBe('ready')
    expect(store.getSnapshot().cards.length).toBeGreaterThan(0)
  })
})

describe('deck engine swiping', () => {
  it('ignores a swipe for a card that is not current', async () => {
    const { store, events } = await loaded()
    const before = store.getSnapshot()
    store.dispatch({ type: 'swipe', action: 'like', cardId: 'test:does-not-exist' })
    await store.whenSettled()
    expect(store.getSnapshot()).toBe(before)
    expect(events.events).toHaveLength(0)
  })

  it('appends a valid event and advances the deck', async () => {
    const { store, events } = await loaded()
    const first = store.getSnapshot().cards[0]
    expect(first).toBeDefined()

    store.dispatch({ type: 'swipe', action: 'like', cardId: first?.id ?? '', dwellMs: 900 })
    await store.whenSettled()

    const snapshot = store.getSnapshot()
    expect(snapshot.position).toBe(1)
    expect(snapshot.canUndo).toBe(true)
    expect(snapshot.cards[0]?.id).not.toBe(first?.id)

    const event = events.events[0]
    expect(event).toBeDefined()
    expect(event?.cardId).toBe(first?.id)
    expect(event?.action).toBe('like')
    expect(event?.position).toBe(0)
    expect(event?.dwellMs).toBe(900)
    expect(event?.ts).toBe(ISO)
    expect(event?.id).toHaveLength(26)
    expect(isUlid(event?.id ?? '')).toBe(true)
  })

  it('leaves the previous snapshot untouched', async () => {
    const { store } = await loaded()
    const before = store.getSnapshot()
    const first = before.cards[0]
    store.dispatch({ type: 'swipe', action: 'dislike', cardId: first?.id ?? '' })
    await store.whenSettled()

    expect(before.position).toBe(0)
    expect(before.cards[0]?.id).toBe(first?.id)
    expect(store.getSnapshot().version).toBeGreaterThan(before.version)
  })

  it('does not commit when consent refuses the event', async () => {
    const events = new RecordingEventStore()
    const store = createEngine({
      deckId: 'books',
      actor: 'actor-1',
      source: makeSource(),
      events,
      consent: () => false,
      clock: () => NOW,
      idFactory: sequentialIds(),
    })
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    const first = store.getSnapshot().cards[0]
    store.dispatch({ type: 'swipe', action: 'like', cardId: first?.id ?? '' })
    await store.whenSettled()

    expect(events.events).toHaveLength(0)
    expect(store.getSnapshot().position).toBe(0)
    expect(store.getSnapshot().cards[0]?.id).toBe(first?.id)
  })

  it('reports an append failure without losing the card', async () => {
    const { store, events } = await loaded()
    const first = store.getSnapshot().cards[0]
    events.failNextAppend = true
    store.dispatch({ type: 'swipe', action: 'like', cardId: first?.id ?? '' })
    await store.whenSettled()

    const snapshot = store.getSnapshot()
    expect(snapshot.state).toBe('error')
    expect(snapshot.lastError?.code).toBe('event_append_failed')
    expect(snapshot.position).toBe(0)
    expect(snapshot.cards[0]?.id).toBe(first?.id)
    expect(events.events).toHaveLength(0)
  })

  it('keeps delivery failures non-fatal', async () => {
    const events = new RecordingEventStore()
    const store = createEngine({
      deckId: 'books',
      actor: 'actor-1',
      source: makeSource(),
      events,
      sinks: [{ id: 'broken', deliver: async () => Promise.reject(new Error('webhook down')) }],
      clock: () => NOW,
      idFactory: sequentialIds(),
    })
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    const first = store.getSnapshot().cards[0]
    store.dispatch({ type: 'swipe', action: 'like', cardId: first?.id ?? '' })
    await store.whenSettled()

    const snapshot = store.getSnapshot()
    expect(snapshot.state).toBe('ready')
    expect(snapshot.lastError?.code).toBe('sink_delivery_failed')
    expect(events.events).toHaveLength(1)
  })

  it('accepts a swipe while dragging and maps drag state', async () => {
    const { store } = await loaded()
    store.dispatch({ type: 'setDragging', dragging: true })
    expect(store.getSnapshot().state).toBe('dragging')

    const first = store.getSnapshot().cards[0]
    store.dispatch({ type: 'swipe', action: 'superlike', cardId: first?.id ?? '' })
    await store.whenSettled()
    expect(['ready', 'loading']).toContain(store.getSnapshot().state)
    expect(store.getSnapshot().position).toBe(1)
  })

  it('ignores drag commands when a swipe is not possible', async () => {
    const { store } = setup()
    store.dispatch({ type: 'setDragging', dragging: true })
    expect(store.getSnapshot().state).toBe('idle')
  })
})

describe('deck engine undo', () => {
  it('restores the card and appends an undo event', async () => {
    const { store, events } = await loaded()
    const first = store.getSnapshot().cards[0]
    store.dispatch({ type: 'swipe', action: 'like', cardId: first?.id ?? '' })
    await store.whenSettled()

    store.dispatch({ type: 'undo' })
    await store.whenSettled()

    const snapshot = store.getSnapshot()
    expect(snapshot.position).toBe(0)
    expect(snapshot.canUndo).toBe(false)
    expect(snapshot.cards[0]?.id).toBe(first?.id)
    expect(events.events).toHaveLength(2)
    expect(events.events[1]?.action).toBe('undo')
    expect(events.events[1]?.cardId).toBe(first?.id)
    expect(events.events[1]?.position).toBe(0)
  })

  it('ignores an undo with nothing to undo', async () => {
    const { store, events } = await loaded()
    const before = store.getSnapshot()
    store.dispatch({ type: 'undo' })
    await store.whenSettled()
    expect(store.getSnapshot()).toBe(before)
    expect(events.events).toHaveLength(0)
  })

  it('caps the undo stack at the configured depth', async () => {
    const { store } = await loaded({ total: 12 })
    for (let index = 0; index < 6; index += 1) {
      const card = store.getSnapshot().cards[0]
      store.dispatch({ type: 'swipe', action: 'like', cardId: card?.id ?? '' })
      await store.whenSettled()
    }

    for (let index = 0; index < 5; index += 1) {
      store.dispatch({ type: 'undo' })
      await store.whenSettled()
    }

    expect(store.getSnapshot().canUndo).toBe(false)
    expect(store.getSnapshot().position).toBe(1)

    store.dispatch({ type: 'undo' })
    await store.whenSettled()
    expect(store.getSnapshot().position).toBe(1)
  })
})

describe('deck engine invariants (property-based)', () => {
  it('keeps position, undo and the log coherent across random commands', async () => {
    const commands = fc.array(
      fc.oneof(fc.constant('swipe' as const), fc.constant('undo' as const)),
      { maxLength: 24 },
    )

    await fc.assert(
      fc.asyncProperty(commands, async (types) => {
        const { store, events } = await loaded({ total: 6 })
        let swipes = 0
        let undos = 0

        for (const type of types) {
          const snapshot = store.getSnapshot()
          const card = snapshot.cards[0]
          if (
            type === 'swipe' &&
            card !== undefined &&
            (snapshot.state === 'ready' || snapshot.state === 'dragging')
          ) {
            store.dispatch({ type: 'swipe', action: 'like', cardId: card.id })
            swipes += 1
          } else if (type === 'undo' && snapshot.canUndo) {
            store.dispatch({ type: 'undo' })
            undos += 1
          }
          await store.whenSettled()

          const after = store.getSnapshot()
          expect(after.position).toBe(swipes - undos)
          expect(after.cards.length).toBeLessThanOrEqual(8)
          expect(after.version).toBeGreaterThanOrEqual(0)
        }

        expect(events.events).toHaveLength(swipes + undos)
        const ids = new Set(events.events.map((event) => event.id))
        expect(ids.size).toBe(events.events.length)
        store.close()
      }),
      { numRuns: 12 },
    )
  })
})
