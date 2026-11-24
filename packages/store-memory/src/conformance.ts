import type {
  Card,
  EventQuery,
  EventStore,
  ItemStore,
  Profile,
  ProfileStore,
  SwipeEvent,
} from '@swipeline/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

export interface StoreSuite {
  events: EventStore
  items: ItemStore
  profiles: ProfileStore
  /** Delete the database (IndexedDB) or release handles. */
  cleanup?: () => Promise<void> | void
}

export type StoreSuiteFactory = () => StoreSuite | Promise<StoreSuite>

const ISO = new Date(Date.UTC(2026, 10, 24, 12, 0, 0)).toISOString()
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function makeEvent(index: number, overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  let value = index
  let suffix = ''
  for (let digit = 0; digit < 4; digit += 1) {
    suffix = ALPHABET.charAt(value % 32) + suffix
    value = Math.floor(value / 32)
  }
  const event: SwipeEvent = {
    schemaVersion: 1,
    id: `01JC0B5V6Q9F3ZK2M4N7P8R${suffix}`,
    deckId: 'books',
    cardId: `demo:${index}`,
    actor: 'actor-1',
    action: 'like',
    position: index,
    ts: ISO,
    ...overrides,
  }
  return event
}

export function makeCard(index: number): Card {
  return {
    schemaVersion: 1,
    id: `demo:${index}`,
    sourceId: 'demo',
    title: `Card ${index}`,
    tags: ['fiction'],
    fetchedAt: ISO,
  }
}

function makeProfile(actor = 'actor-1', deckId = 'books'): Profile {
  return {
    actor,
    deckId,
    tagStats: { fiction: { a: 1, b: 0 } },
    counts: { seen: 1, liked: 1, disliked: 0 },
    updatedAt: ISO,
  }
}

/**
 * The one conformance suite both store implementations run. A second
 * implementation is what makes the store seam real, so the suite is the spec:
 * append is idempotent and ordered, queries combine with AND, erase removes
 * every event for an actor and drops derived profiles, items upsert by id.
 */
export function describeStoreConformance(label: string, factory: StoreSuiteFactory): void {
  describe(label, () => {
    let suite: StoreSuite

    beforeEach(async () => {
      suite = await factory()
    })

    afterEach(async () => {
      await suite.cleanup?.()
    })

    it('appends idempotently and returns events in ULID order', async () => {
      const first = makeEvent(1)
      const second = makeEvent(2)
      await suite.events.append([second, first])
      await suite.events.append([first])

      expect((await suite.events.query({})).map((event) => event.id)).toEqual([first.id, second.id])
    })

    it('combines query filters with AND and honours limit', async () => {
      await suite.events.append([
        makeEvent(1),
        makeEvent(2, { actor: 'actor-2' }),
        makeEvent(3, { deckId: 'recipes', ts: new Date(Date.UTC(2026, 10, 25)).toISOString() }),
        makeEvent(4, { ts: new Date(Date.UTC(2026, 10, 26)).toISOString() }),
      ])

      expect((await suite.events.query({ actor: 'actor-1' })).map((event) => event.cardId)).toEqual(
        ['demo:1', 'demo:3', 'demo:4'],
      )
      expect(
        (await suite.events.query({ deckId: 'recipes' })).map((event) => event.cardId),
      ).toEqual(['demo:3'])
      expect(
        (await suite.events.query({ actor: 'actor-1', limit: 2 })).map((e) => e.cardId),
      ).toEqual(['demo:1', 'demo:3'])
      expect(
        (await suite.events.query({ since: new Date(Date.UTC(2026, 10, 25)).toISOString() })).map(
          (event) => event.cardId,
        ),
      ).toEqual(['demo:3', 'demo:4'])
      expect(
        (await suite.events.query({ until: new Date(Date.UTC(2026, 10, 25)).toISOString() })).map(
          (event) => event.cardId,
        ),
      ).toEqual(['demo:1', 'demo:2'])
    })

    it('supports the afterId cursor and cardId lookup', async () => {
      const events = [makeEvent(1), makeEvent(2), makeEvent(3)]
      await suite.events.append(events)
      const after = await suite.events.query({ afterId: events[0]?.id ?? '' })
      expect(after.map((event) => event.cardId)).toEqual(['demo:2', 'demo:3'])
      expect((await suite.events.query({ cardId: 'demo:2' })).map((event) => event.id)).toEqual([
        events[1]?.id,
      ])
    })

    it('exports the same rows as query', async () => {
      await suite.events.append([makeEvent(1), makeEvent(2, { actor: 'actor-2' })])
      const query: EventQuery = { actor: 'actor-1' }
      const exported = await suite.events.export(query)
      expect(exported).toEqual(await suite.events.query(query))
    })

    it('erase removes every event for the actor and drops derived profiles', async () => {
      await suite.events.append([
        makeEvent(1),
        makeEvent(2, { actor: 'actor-2' }),
        makeEvent(3, { deckId: 'recipes' }),
      ])
      await suite.profiles.put(makeProfile())
      await suite.profiles.put(makeProfile('actor-2'))

      expect(await suite.events.erase('actor-1')).toBe(2)
      expect((await suite.events.query({})).map((event) => event.actor)).toEqual(['actor-2'])
      expect(await suite.profiles.get('actor-1', 'books')).toBeUndefined()
      expect(await suite.profiles.get('actor-2', 'books')).toBeDefined()
    })

    it('leaves the log untouched when the actor is unknown', async () => {
      await suite.events.append([makeEvent(1)])
      expect(await suite.events.erase('nobody')).toBe(0)
      expect(await suite.events.query({})).toHaveLength(1)
    })

    it('upserts items by id and lists them deterministically', async () => {
      await suite.items.put([makeCard(2), makeCard(1)])
      await suite.items.put([{ ...makeCard(1), title: 'Updated' }])

      expect((await suite.items.get('demo:1'))?.title).toBe('Updated')
      expect((await suite.items.list()).map((card) => card.id)).toEqual(['demo:1', 'demo:2'])
      expect(await suite.items.get('demo:9')).toBeUndefined()
    })

    it('deletes items by id and clears the cache', async () => {
      await suite.items.put([makeCard(1), makeCard(2), makeCard(3)])
      await suite.items.delete(['demo:1', 'demo:3'])
      expect((await suite.items.list()).map((card) => card.id)).toEqual(['demo:2'])
      await suite.items.clear()
      expect(await suite.items.list()).toEqual([])
    })

    it('stores profiles by actor and deck', async () => {
      await suite.profiles.put(makeProfile())
      await suite.profiles.put(makeProfile('actor-1', 'recipes'))
      expect((await suite.profiles.get('actor-1', 'books'))?.deckId).toBe('books')

      await suite.profiles.delete('actor-1', 'books')
      expect(await suite.profiles.get('actor-1', 'books')).toBeUndefined()
      expect(await suite.profiles.get('actor-1', 'recipes')).toBeDefined()
    })

    it('accepts an empty append without error', async () => {
      await expect(suite.events.append([])).resolves.toBeUndefined()
      expect(await suite.events.query({})).toEqual([])
    })
  })
}
