import {
  type Card,
  compareEvents,
  type EventQuery,
  type EventStore,
  type ItemStore,
  type Profile,
  type ProfileStore,
  type SwipeEvent,
} from '@swipeline/core'

const ITEMS = 'items'
const EVENTS = 'events'
const PROFILES = 'profiles'
const DEFAULT_VERSION = 2

export interface IndexedDbOptions {
  /** Database name. Required so two decks or two apps cannot collide by accident. */
  name: string
  /** Schema version. Defaults to 2 (the version that adds the `by_deck` index). */
  version?: number
  /** Injected in tests; defaults to the global `indexedDB`. */
  factory?: IDBFactory
}

export interface IndexedDbStores {
  events: EventStore
  items: ItemStore
  profiles: ProfileStore
  close(): Promise<void>
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openDatabase(factory: IDBFactory, name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ITEMS)) {
        db.createObjectStore(ITEMS, { keyPath: 'id' })
      }
      let events: IDBObjectStore | undefined
      if (!db.objectStoreNames.contains(EVENTS)) {
        events = db.createObjectStore(EVENTS, { keyPath: 'id' })
        events.createIndex('by_actor', 'actor')
      } else {
        events = request.transaction?.objectStore(EVENTS)
      }
      // v2 adds the deck index; existing v1 databases upgrade in place without
      // touching rows, which is the path the upgrade test exercises.
      if (version >= 2 && events && !events.indexNames.contains('by_deck')) {
        events.createIndex('by_deck', 'deckId')
      }
      if (!db.objectStoreNames.contains(PROFILES)) {
        db.createObjectStore(PROFILES, { keyPath: ['actor', 'deckId'] })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('could not open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })
}

function matches(event: SwipeEvent, query: EventQuery): boolean {
  if (query.actor !== undefined && event.actor !== query.actor) return false
  if (query.deckId !== undefined && event.deckId !== query.deckId) return false
  if (query.cardId !== undefined && event.cardId !== query.cardId) return false
  if (query.since !== undefined && event.ts < query.since) return false
  if (query.until !== undefined && event.ts >= query.until) return false
  if (query.afterId !== undefined && event.id <= query.afterId) return false
  return true
}

function sortById<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function makeEventStore(db: IDBDatabase): EventStore {
  function readAll<T>(store: string): Promise<T[]> {
    const transaction = db.transaction(store, 'readonly')
    return requestResult(transaction.objectStore(store).getAll() as IDBRequest<T[]>)
  }

  return {
    async append(events: readonly SwipeEvent[]): Promise<void> {
      if (events.length === 0) return
      const transaction = db.transaction(EVENTS, 'readwrite')
      const store = transaction.objectStore(EVENTS)
      for (const event of events) store.put(event)
      await transactionDone(transaction)
    },

    async query(query: EventQuery): Promise<readonly SwipeEvent[]> {
      const rows = sortById(await readAll<SwipeEvent>(EVENTS)).filter((event) =>
        matches(event, query),
      )
      return query.limit === undefined ? rows : rows.slice(0, query.limit)
    },

    async export(query: EventQuery): Promise<readonly SwipeEvent[]> {
      const rows = sortById(await readAll<SwipeEvent>(EVENTS)).filter((event) =>
        matches(event, query),
      )
      return query.limit === undefined ? rows : rows.slice(0, query.limit)
    },

    async erase(actor: string): Promise<number> {
      const events = (await readAll<SwipeEvent>(EVENTS)).filter((event) => event.actor === actor)
      const profiles = (await readAll<Profile>(PROFILES)).filter(
        (profile) => profile.actor === actor,
      )
      const transaction = db.transaction([EVENTS, PROFILES], 'readwrite')
      const eventStore = transaction.objectStore(EVENTS)
      for (const event of events) eventStore.delete(event.id)
      const profileStore = transaction.objectStore(PROFILES)
      for (const profile of profiles) profileStore.delete([profile.actor, profile.deckId])
      await transactionDone(transaction)
      return events.length
    },
  }
}

function makeItemStore(db: IDBDatabase): ItemStore {
  return {
    async get(id: string): Promise<Card | undefined> {
      const transaction = db.transaction(ITEMS, 'readonly')
      const card = await requestResult<Card | undefined>(transaction.objectStore(ITEMS).get(id))
      return card
    },
    async put(cards: readonly Card[]): Promise<void> {
      if (cards.length === 0) return
      const transaction = db.transaction(ITEMS, 'readwrite')
      const store = transaction.objectStore(ITEMS)
      for (const card of cards) store.put(card)
      await transactionDone(transaction)
    },
    async list(): Promise<readonly Card[]> {
      const transaction = db.transaction(ITEMS, 'readonly')
      return sortById(await requestResult<Card[]>(transaction.objectStore(ITEMS).getAll()))
    },
    async delete(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return
      const transaction = db.transaction(ITEMS, 'readwrite')
      const store = transaction.objectStore(ITEMS)
      for (const id of ids) store.delete(id)
      await transactionDone(transaction)
    },
    async clear(): Promise<void> {
      const transaction = db.transaction(ITEMS, 'readwrite')
      transaction.objectStore(ITEMS).clear()
      await transactionDone(transaction)
    },
  }
}

function makeProfileStore(db: IDBDatabase): ProfileStore {
  return {
    async get(actor: string, deckId: string): Promise<Profile | undefined> {
      const transaction = db.transaction(PROFILES, 'readonly')
      return requestResult<Profile | undefined>(
        transaction.objectStore(PROFILES).get([actor, deckId]),
      )
    },
    async put(profile: Profile): Promise<void> {
      const transaction = db.transaction(PROFILES, 'readwrite')
      transaction.objectStore(PROFILES).put(profile)
      await transactionDone(transaction)
    },
    async delete(actor: string, deckId: string): Promise<void> {
      const transaction = db.transaction(PROFILES, 'readwrite')
      transaction.objectStore(PROFILES).delete([actor, deckId])
      await transactionDone(transaction)
    },
  }
}

/**
 * IndexedDB-backed stores with one versioned schema. Rows are validated by the
 * caller (Card/Event schemas in core); the stores keep ids, order and erase
 * semantics identical to the memory implementation, which the shared
 * conformance suite enforces.
 */
export async function createIndexedDbStores(options: IndexedDbOptions): Promise<IndexedDbStores> {
  const factory = options.factory ?? globalThis.indexedDB
  if (!factory) throw new TypeError('createIndexedDbStores needs indexedDB or a factory')
  const db = await openDatabase(factory, options.name, options.version ?? DEFAULT_VERSION)
  return {
    events: makeEventStore(db),
    items: makeItemStore(db),
    profiles: makeProfileStore(db),
    async close(): Promise<void> {
      db.close()
    },
  }
}

export { compareEvents }
