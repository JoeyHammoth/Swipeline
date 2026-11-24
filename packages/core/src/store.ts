import type { Card } from './card.js'
import type { SwipeEvent } from './event.js'
import type { Profile } from './profile.js'

/** Filters for event queries. All fields are optional and combine with AND. */
export interface EventQuery {
  actor?: string
  deckId?: string
  cardId?: string
  /** ISO 8601, inclusive. */
  since?: string
  /** ISO 8601, exclusive. */
  until?: string
  /** ULID cursor: return only events after this id. */
  afterId?: string
  limit?: number
}

/**
 * Append-only event log. `append` is idempotent by event id and atomic per
 * call; `query` returns events in ULID order. Implementations live in the
 * store packages (`@swipeline/store-memory`, `@swipeline/store-indexeddb`);
 * core only needs the interface to hydrate the engine.
 */
export interface EventStore {
  append(events: readonly SwipeEvent[]): Promise<void>
  query(q: EventQuery): Promise<readonly SwipeEvent[]>
  export(q: EventQuery): Promise<readonly SwipeEvent[]>
  erase(actor: string): Promise<number>
}

/** Cache of normalized cards, used for tags and offline renders. */
export interface ItemStore {
  get(id: string): Promise<Card | undefined>
  put(cards: readonly Card[]): Promise<void>
  list(): Promise<readonly Card[]>
  delete(ids: readonly string[]): Promise<void>
  clear(): Promise<void>
}

/** Derived state, rebuilt from the event log rather than written by hand. */
export interface ProfileStore {
  get(actor: string, deckId: string): Promise<Profile | undefined>
  put(profile: Profile): Promise<void>
  delete(actor: string, deckId: string): Promise<void>
}
