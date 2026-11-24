import type { FetchContext, SourceAdapter } from './adapter.js'
import type { Card } from './card.js'
import { compareEvents, type SwipeAction, type SwipeEvent } from './event.js'
import { createUlid } from './id.js'
import type { ConsentPolicy, Sink } from './sink.js'
import type { EventQuery, EventStore } from './store.js'

/**
 * States from the design plan (§5.7). `loading`, `committing` and `ready` are
 * the only states in which the engine does work; the rest describe what a
 * binding should render.
 */
export type DeckState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'dragging'
  | 'committing'
  | 'exhausted'
  | 'error'
  | 'offline'

export interface DeckError {
  code: string
  message: string
  retryable: boolean
}

/**
 * Immutable view of the deck. The same object is returned until something
 * changes, which is what makes framework glue (`useSyncExternalStore`,
 * `shallowRef`, a Svelte store) correct and cheap.
 */
export interface DeckSnapshot {
  readonly state: DeckState
  readonly deckId: string
  readonly actor: string
  /** Current card first, then preview cards. At most `prefetch.buffer` entries. */
  readonly cards: readonly Card[]
  /** Swipes committed this session. Does not decrease below zero on undo. */
  readonly position: number
  readonly canUndo: boolean
  readonly loadingMore: boolean
  readonly lastError?: DeckError
  /** Monotonic; changes together with the object. */
  readonly version: number
}

export type DeckCommand =
  | { type: 'swipe'; action: SwipeAction; cardId: string; dwellMs?: number }
  | { type: 'undo' }
  | { type: 'refill' }
  | { type: 'setQuery'; query: string }
  | { type: 'setFilters'; filters: Record<string, unknown> }
  | { type: 'retry' }
  | { type: 'setDragging'; dragging: boolean }
  | { type: 'setOffline'; offline: boolean }

export interface DeckStore {
  getSnapshot(): DeckSnapshot
  getServerSnapshot(): DeckSnapshot
  subscribe(listener: () => void): () => void
  dispatch(cmd: DeckCommand): void
}

/**
 * `createEngine` returns a store plus two helpers that are not part of the
 * binding contract: `whenSettled` for tests and SSR, and `close` for teardown.
 */
export interface Engine extends DeckStore {
  whenSettled(): Promise<void>
  close(): void
}

export interface EngineConfig<TRaw = unknown> {
  deckId: string
  actor: string | (() => string)
  source: SourceAdapter<TRaw>
  /** Defaults to an in-memory log. Pass a persisted store in production. */
  events?: EventStore
  sinks?: readonly Sink[]
  consent?: ConsentPolicy
  /** Gesture-to-action map. Defaults to right/like, left/dislike, up/superlike, down/later. */
  actions?: Partial<Record<'right' | 'left' | 'up' | 'down', SwipeAction>>
  prefetch?: { buffer: number; refillAt: number }
  /** Maximum number of undoable swipes. Defaults to 5. */
  undoDepth?: number
  clock?: () => number
  idFactory?: () => string
}

export const DEFAULT_ACTIONS: Readonly<Record<'right' | 'left' | 'up' | 'down', SwipeAction>> =
  Object.freeze({ right: 'like', left: 'dislike', up: 'superlike', down: 'later' })

const DEFAULT_BUFFER = 8
const DEFAULT_REFILL_AT = 3
const DEFAULT_UNDO_DEPTH = 5
/** Guards against a source that keeps returning the same cursor. */
const MAX_PAGES_PER_LOAD = 10

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function matchesQuery(event: SwipeEvent, query: EventQuery): boolean {
  if (query.actor !== undefined && event.actor !== query.actor) return false
  if (query.deckId !== undefined && event.deckId !== query.deckId) return false
  if (query.cardId !== undefined && event.cardId !== query.cardId) return false
  if (query.since !== undefined && event.ts < query.since) return false
  if (query.until !== undefined && event.ts >= query.until) return false
  if (query.afterId !== undefined && event.id <= query.afterId) return false
  return true
}

/** The default log. Small, append-only and idempotent by event id. */
export class MemoryEventStore implements EventStore {
  private events: SwipeEvent[] = []

  async append(events: readonly SwipeEvent[]): Promise<void> {
    const known = new Set(this.events.map((event) => event.id))
    for (const event of events) {
      if (known.has(event.id)) continue
      this.events.push(event)
      known.add(event.id)
    }
    this.events.sort(compareEvents)
  }

  async query(query: EventQuery): Promise<readonly SwipeEvent[]> {
    const matched = this.events.filter((event) => matchesQuery(event, query))
    return query.limit === undefined ? matched : matched.slice(0, query.limit)
  }

  async export(query: EventQuery): Promise<readonly SwipeEvent[]> {
    return this.query(query)
  }

  async erase(actor: string): Promise<number> {
    const before = this.events.length
    this.events = this.events.filter((event) => event.actor !== actor)
    return before - this.events.length
  }
}

interface UndoEntry {
  card: Card
  event: SwipeEvent
}

/**
 * Headless deck engine.
 *
 * Effects run after `dispatch` returns, through one serialized queue, so a
 * swipe's event is appended before a following undo is evaluated. Snapshots are
 * frozen and replaced only when something changed. Nothing here touches the DOM
 * and nothing runs at import time.
 */
export function createEngine<TRaw = unknown>(config: EngineConfig<TRaw>): Engine {
  const bufferSize = config.prefetch?.buffer ?? DEFAULT_BUFFER
  const refillAt = config.prefetch?.refillAt ?? DEFAULT_REFILL_AT
  const undoDepth = config.undoDepth ?? DEFAULT_UNDO_DEPTH
  const clock = config.clock ?? Date.now
  const idFactory = config.idFactory ?? (() => createUlid({ now: clock() }))
  const events = config.events ?? new MemoryEventStore()
  const actorSource = config.actor
  const actorOf = typeof actorSource === 'function' ? actorSource : (): string => actorSource

  let closed = false
  let state: DeckState = 'idle'
  let pool: Card[] = []
  let position = 0
  let cursor: string | undefined
  let query: string | undefined
  let filters: Record<string, unknown> | undefined
  let loadingMore = false
  let exhausted = false
  let lastError: DeckError | undefined
  let version = 0
  const undoStack: UndoEntry[] = []
  const seen = new Set<string>()
  const listeners = new Set<() => void>()

  let queue: Promise<void> = Promise.resolve()
  const pending = new Set<Promise<void>>()
  let hydratePromise: Promise<void> | undefined
  let abortController: AbortController | undefined

  function buildSnapshot(): DeckSnapshot {
    const base = {
      state,
      deckId: config.deckId,
      actor: actorOf(),
      cards: Object.freeze(pool.slice(0, bufferSize)),
      position,
      canUndo: undoStack.length > 0,
      loadingMore,
      version,
    }
    return Object.freeze(lastError === undefined ? base : { ...base, lastError })
  }

  const serverSnapshot = buildSnapshot()
  let snapshot = serverSnapshot

  function publish(): void {
    if (closed) return
    version += 1
    snapshot = buildSnapshot()
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue
      listener()
    }
  }

  function track(promise: Promise<void>): Promise<void> {
    pending.add(promise)
    const settle = (): void => {
      pending.delete(promise)
    }
    void promise.then(settle, settle)
    return promise
  }

  function enqueue(task: () => Promise<void>): void {
    queue = queue.then(task).catch(() => {
      // Tasks record their own failures in `lastError`; never leave an
      // unhandled rejection behind.
    })
  }

  async function hydrate(): Promise<void> {
    hydratePromise ??= (async () => {
      const past = await events.query({ actor: actorOf(), deckId: config.deckId })
      for (const event of past) seen.add(event.cardId)
    })()
    await hydratePromise
  }

  function fetchContext(signal: AbortSignal): FetchContext {
    const context: FetchContext = { signal }
    if (cursor !== undefined) context.cursor = cursor
    if (query !== undefined) context.query = query
    if (filters !== undefined) context.filters = filters
    return context
  }

  async function load(): Promise<void> {
    if (closed || loadingMore || state === 'offline') return
    loadingMore = true
    if (pool.length === 0) state = 'loading'
    lastError = undefined
    publish()

    const controller = new AbortController()
    abortController = controller
    try {
      let pages = 0
      while (!exhausted && pool.length < bufferSize && pages < MAX_PAGES_PER_LOAD) {
        pages += 1
        const batch = await config.source.fetch(fetchContext(controller.signal))
        const queued = new Set(pool.map((card) => card.id))
        for (const raw of batch.items) {
          let card: Card | null = null
          try {
            card = config.source.normalize(raw)
          } catch {
            card = null
          }
          if (!card) continue
          if (seen.has(card.id) || queued.has(card.id)) continue
          queued.add(card.id)
          pool.push(card)
        }
        cursor = batch.nextCursor
        if (batch.nextCursor === undefined) exhausted = true
      }

      loadingMore = false
      state = pool.length === 0 ? (exhausted ? 'exhausted' : 'ready') : 'ready'
      publish()
    } catch (cause) {
      loadingMore = false
      if (closed || controller.signal.aborted) return
      state = 'error'
      lastError = { code: 'source_fetch_failed', message: messageOf(cause), retryable: true }
      publish()
    } finally {
      if (abortController === controller) abortController = undefined
    }
  }

  function startLoad(): Promise<void> {
    return track(load())
  }

  function deliverInBackground(batch: readonly SwipeEvent[]): void {
    const sinks = config.sinks
    if (!sinks || sinks.length === 0) return
    for (const sink of sinks) {
      void sink.deliver(batch).catch((cause: unknown) => {
        if (closed) return
        lastError = {
          code: 'sink_delivery_failed',
          message: `sink ${sink.id}: ${messageOf(cause)}`,
          retryable: true,
        }
        publish()
      })
    }
  }

  function eventFor(
    card: Card,
    action: SwipeAction,
    cardPosition: number,
    dwellMs?: number,
  ): SwipeEvent {
    const event: SwipeEvent = {
      schemaVersion: 1,
      id: idFactory(),
      deckId: config.deckId,
      cardId: card.id,
      actor: actorOf(),
      action,
      position: cardPosition,
      ts: new Date(clock()).toISOString(),
    }
    if (dwellMs !== undefined) event.dwellMs = dwellMs
    if (query !== undefined) event.context = { query }
    return event
  }

  async function commitSwipe(command: Extract<DeckCommand, { type: 'swipe' }>): Promise<void> {
    if (state !== 'ready' && state !== 'dragging') return
    const current = pool[0]
    if (!current || current.id !== command.cardId) return

    const event = eventFor(current, command.action, position, command.dwellMs)
    if (config.consent) {
      let allowed = false
      try {
        allowed = await config.consent(event)
      } catch {
        allowed = false
      }
      if (!allowed) return
    }

    state = 'committing'
    lastError = undefined
    publish()

    try {
      await events.append([event])
    } catch (cause) {
      state = 'error'
      lastError = { code: 'event_append_failed', message: messageOf(cause), retryable: true }
      publish()
      return
    }

    deliverInBackground([event])
    seen.add(current.id)
    pool.shift()
    position += 1
    undoStack.push({ card: current, event })
    if (undoStack.length > undoDepth) undoStack.shift()

    if (pool.length === 0 && !exhausted) {
      state = 'loading'
      publish()
      await startLoad()
      return
    }

    state = pool.length === 0 ? 'exhausted' : 'ready'
    publish()
    if (pool.length <= refillAt && !exhausted) void startLoad()
  }

  async function commitUndo(): Promise<void> {
    const entry = undoStack.at(-1)
    if (!entry) return

    const undoEvent = eventFor(entry.card, 'undo', entry.event.position, undefined)
    try {
      await events.append([undoEvent])
    } catch (cause) {
      state = 'error'
      lastError = { code: 'event_append_failed', message: messageOf(cause), retryable: true }
      publish()
      return
    }

    deliverInBackground([undoEvent])
    undoStack.pop()
    pool.unshift(entry.card)
    seen.delete(entry.card.id)
    position = Math.max(0, position - 1)
    lastError = undefined
    state = 'ready'
    publish()
  }

  function resetDeck(): void {
    abortController?.abort()
    pool = []
    cursor = undefined
    exhausted = false
    position = 0
    undoStack.length = 0
    loadingMore = false
  }

  async function applyQuery(nextQuery: string): Promise<void> {
    if (nextQuery === query) return
    query = nextQuery
    resetDeck()
    state = 'loading'
    publish()
    await startLoad()
  }

  async function applyFilters(nextFilters: Record<string, unknown>): Promise<void> {
    if (JSON.stringify(nextFilters) === JSON.stringify(filters)) return
    filters = nextFilters
    resetDeck()
    state = 'loading'
    publish()
    await startLoad()
  }

  async function retry(): Promise<void> {
    if (state !== 'error') return
    lastError = undefined
    state = pool.length === 0 ? 'loading' : 'ready'
    publish()
    await startLoad()
  }

  function requestRefill(): void {
    enqueue(async () => {
      if (closed || state === 'offline' || loadingMore) return
      await hydrate()
      if (pool.length >= bufferSize || exhausted) return
      await startLoad()
    })
  }

  function setDragging(dragging: boolean): void {
    if (dragging) {
      if (state !== 'ready') return
      state = 'dragging'
      publish()
      return
    }
    if (state !== 'dragging') return
    state = 'ready'
    publish()
  }

  function setOffline(offline: boolean): void {
    if (offline) {
      if (state === 'offline') return
      abortController?.abort()
      state = 'offline'
      publish()
      return
    }
    if (state !== 'offline') return
    state = pool.length === 0 ? (exhausted ? 'exhausted' : 'idle') : 'ready'
    publish()
  }

  function dispatch(command: DeckCommand): void {
    if (closed) return
    switch (command.type) {
      case 'swipe':
        enqueue(() => commitSwipe(command))
        return
      case 'undo':
        enqueue(commitUndo)
        return
      case 'refill':
        requestRefill()
        return
      case 'setQuery':
        enqueue(() => applyQuery(command.query))
        return
      case 'setFilters':
        enqueue(() => applyFilters(command.filters))
        return
      case 'retry':
        enqueue(retry)
        return
      case 'setDragging':
        setDragging(command.dragging)
        return
      case 'setOffline':
        setOffline(command.offline)
        return
    }
  }

  async function whenSettled(): Promise<void> {
    await queue
    while (pending.size > 0) await Promise.all([...pending])
    await queue
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch,
    whenSettled,
    close: () => {
      closed = true
      abortController?.abort()
      listeners.clear()
    },
  }
}
