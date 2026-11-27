import {
  type Card,
  createUlid,
  type ItemStore,
  MemoryEventStore,
  type SwipeEvent,
} from '@swipeline/core'
import type { RankStage } from '@swipeline/rank'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type RunningServer, type ServerOptions } from '../src/index.js'

let running: RunningServer | undefined

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()

function card(id: string, title: string, tags: string[] = ['fiction']): Card {
  return { schemaVersion: 1, id, sourceId: 'books', title, tags, fetchedAt: ISO }
}

function items(cards: readonly Card[]): ItemStore {
  const map = new Map(cards.map((entry) => [entry.id, entry]))
  return {
    get: async (id) => map.get(id),
    put: async (batch) => {
      for (const entry of batch) map.set(entry.id, entry)
    },
    list: async () => [...map.values()],
    delete: async (ids) => {
      for (const id of ids) map.delete(id)
    },
    clear: async () => map.clear(),
  }
}

function event(overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: createUlid(),
    deckId: 'books',
    cardId: 'books:1',
    actor: 'reader',
    action: 'like',
    position: 0,
    ts: new Date(Date.UTC(2026, 10, 24, 12, 0, 0)).toISOString(),
    ...overrides,
  }
}

/** Sorts by title so the route tests do not depend on the ranker's randomness. */
const byTitle: RankStage = {
  name: 'by-title',
  run: (ctx) => ({
    ...ctx,
    candidates: [...ctx.candidates].sort((a, b) => a.card.title.localeCompare(b.card.title)),
  }),
}

async function start(overrides: Partial<ServerOptions> = {}): Promise<string> {
  const server = createServer({ events: new MemoryEventStore(), ...overrides })
  running = await server.listen(0, '127.0.0.1')
  return running.url
}

afterEach(async () => {
  await running?.close()
  running = undefined
})

describe('GET /deck/:id/next', () => {
  it('ranks the item store and skips cards the actor already saw', async () => {
    const base = await start({
      items: items([card('books:1', 'Beta'), card('books:2', 'Alpha'), card('books:3', 'Gamma')]),
      rank: byTitle,
      rng: () => 0.5,
    })
    await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [event()] }),
    })

    const response = await fetch(`${base}/deck/books/next?actor=reader`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { deckId: string; cards: Card[] }
    expect(body.deckId).toBe('books')
    // books:1 was swiped, so it is not offered again.
    expect(body.cards.map((entry) => entry.id)).toEqual(['books:2', 'books:3'])
  })

  it('honours limit and reports reasons when a stage adds them', async () => {
    const explain: RankStage = {
      name: 'explain',
      run: (ctx) => ({
        ...ctx,
        candidates: ctx.candidates.map((candidate) => ({
          ...candidate,
          reasons: ['test reason'],
        })),
      }),
    }
    const base = await start({
      items: items([card('books:1', 'One'), card('books:2', 'Two')]),
      rank: explain,
    })

    const response = await fetch(`${base}/deck/books/next?actor=reader&limit=1`)
    const body = (await response.json()) as {
      cards: Card[]
      reasons: { cardId: string; reasons: string[] }[]
    }
    expect(body.cards).toHaveLength(1)
    expect(body.reasons[0]).toEqual({ cardId: body.cards[0]?.id, reasons: ['test reason'] })
  })

  it('needs an item store', async () => {
    const base = await start()
    const response = await fetch(`${base}/deck/books/next?actor=reader`)
    expect(response.status).toBe(501)
  })

  it('needs an actor and refuses another one', async () => {
    const base = await start({ items: items([]) })
    expect((await fetch(`${base}/deck/books/next`)).status).toBe(400)

    const authed = await start({
      items: items([]),
      authenticate: () => ({ actor: 'reader' }),
    })
    expect((await fetch(`${authed}/deck/books/next?actor=someone-else`)).status).toBe(403)
  })

  it('rejects a bad limit and a non-GET method', async () => {
    const base = await start({ items: items([]) })
    expect((await fetch(`${base}/deck/books/next?actor=reader&limit=0`)).status).toBe(400)
    expect((await fetch(`${base}/deck/books/next?actor=reader&limit=500`)).status).toBe(400)
    const wrongMethod = await fetch(`${base}/deck/books/next`, { method: 'POST' })
    expect(wrongMethod.status).toBe(405)
  })
})

describe('GET /collections/:id', () => {
  it('returns the cards the actor saved for later', async () => {
    const base = await start({
      items: items([card('books:1', 'One'), card('books:2', 'Two')]),
    })
    await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [event({ cardId: 'books:1', action: 'later' }), event({ cardId: 'books:2' })],
      }),
    })

    const response = await fetch(`${base}/collections/later?actor=reader`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { cards: Card[] }
    expect(body.cards.map((entry) => entry.id)).toEqual(['books:1'])
  })

  it('drops a card whose later action was undone', async () => {
    const base = await start({ items: items([card('books:1', 'One')]) })
    await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Order comes from the ULID, not `ts`, so the ids are ascending here.
        events: [
          event({
            id: '01JC0B5V6Q9F3ZK2M4N7P8RAAAA',
            cardId: 'books:1',
            action: 'later',
            ts: '2026-11-24T12:00:00.000Z',
          }),
          event({
            id: '01JC0B5V6Q9F3ZK2M4N7P8RAAAB',
            cardId: 'books:1',
            action: 'undo',
            ts: '2026-11-24T12:00:01.000Z',
          }),
        ],
      }),
    })

    const response = await fetch(`${base}/collections/later?actor=reader`)
    expect(((await response.json()) as { cards: Card[] }).cards).toEqual([])
  })

  it('404s an unknown collection', async () => {
    const base = await start({ items: items([]) })
    expect((await fetch(`${base}/collections/starred?actor=reader`)).status).toBe(404)
  })
})

describe('GET /openapi.json', () => {
  it('describes the routes the server implements', async () => {
    const base = await start({ version: '9.9.9' })
    const response = await fetch(`${base}/openapi.json`)
    expect(response.status).toBe(200)
    const document = (await response.json()) as {
      openapi: string
      info: { version: string; license: { identifier: string } }
      paths: Record<string, unknown>
    }
    expect(document.openapi).toBe('3.1.0')
    expect(document.info.version).toBe('9.9.9')
    expect(document.info.license.identifier).toBe('Apache-2.0')
    expect(Object.keys(document.paths).sort()).toEqual([
      '/actors/{actor}',
      '/collections/{id}',
      '/deck/{id}/next',
      '/events',
      '/export/{actor}',
      '/health',
    ])
  })
})
