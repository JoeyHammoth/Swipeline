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

function matches(event: SwipeEvent, query: EventQuery): boolean {
  if (query.actor !== undefined && event.actor !== query.actor) return false
  if (query.deckId !== undefined && event.deckId !== query.deckId) return false
  if (query.cardId !== undefined && event.cardId !== query.cardId) return false
  if (query.since !== undefined && event.ts < query.since) return false
  if (query.until !== undefined && event.ts >= query.until) return false
  if (query.afterId !== undefined && event.id <= query.afterId) return false
  return true
}

/** Append-only, idempotent-by-id event log. Small enough for tests and SSR. */
export class MemoryEventStore implements EventStore {
  private events: SwipeEvent[] = []
  private readonly profiles: MemoryProfileStore | undefined

  constructor(profiles?: MemoryProfileStore) {
    this.profiles = profiles
  }

  async append(batch: readonly SwipeEvent[]): Promise<void> {
    const known = new Set(this.events.map((event) => event.id))
    for (const event of batch) {
      if (known.has(event.id)) continue
      this.events.push(event)
      known.add(event.id)
    }
    this.events.sort(compareEvents)
  }

  async query(query: EventQuery): Promise<readonly SwipeEvent[]> {
    const matched = this.events.filter((event) => matches(event, query))
    return query.limit === undefined ? matched : matched.slice(0, query.limit)
  }

  async export(query: EventQuery): Promise<readonly SwipeEvent[]> {
    return this.query(query)
  }

  async erase(actor: string): Promise<number> {
    const before = this.events.length
    this.events = this.events.filter((event) => event.actor !== actor)
    await this.profiles?.deleteAllForActor(actor)
    return before - this.events.length
  }
}

/** Upsert-by-id cache of normalized cards. */
export class MemoryItemStore implements ItemStore {
  private readonly items = new Map<string, Card>()

  async get(id: string): Promise<Card | undefined> {
    return this.items.get(id)
  }

  async put(cards: readonly Card[]): Promise<void> {
    for (const card of cards) this.items.set(card.id, card)
  }

  async list(): Promise<readonly Card[]> {
    return [...this.items.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.items.delete(id)
  }

  async clear(): Promise<void> {
    this.items.clear()
  }
}

function profileKey(actor: string, deckId: string): string {
  return `${actor}\u0000${deckId}`
}

/** Derived profiles, keyed by actor and deck. */
export class MemoryProfileStore implements ProfileStore {
  private readonly profiles = new Map<string, Profile>()

  async get(actor: string, deckId: string): Promise<Profile | undefined> {
    return this.profiles.get(profileKey(actor, deckId))
  }

  async put(profile: Profile): Promise<void> {
    this.profiles.set(profileKey(profile.actor, profile.deckId), profile)
  }

  async delete(actor: string, deckId: string): Promise<void> {
    this.profiles.delete(profileKey(actor, deckId))
  }

  async deleteAllForActor(actor: string): Promise<void> {
    for (const key of [...this.profiles.keys()]) {
      if (key.startsWith(`${actor}\u0000`)) this.profiles.delete(key)
    }
  }
}

export interface MemoryStores {
  events: MemoryEventStore
  items: MemoryItemStore
  profiles: MemoryProfileStore
}

/** One call that wires the three stores together, including erase semantics. */
export function createMemoryStores(): MemoryStores {
  const profiles = new MemoryProfileStore()
  return { events: new MemoryEventStore(profiles), items: new MemoryItemStore(), profiles }
}
