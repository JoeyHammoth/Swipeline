import { createUlid, MemoryEventStore, type SwipeEvent } from '@swipeline/core'
import { createServer, type RunningServer } from '@swipeline/server'
import { afterEach, describe, expect, it } from 'vitest'
import { createOutbox, httpEventStore, RemoteStoreError } from '../src/index.js'

let running: RunningServer | undefined

function event(actor: string, index: number, overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: createUlid(),
    deckId: 'books',
    cardId: `books:${index}`,
    actor,
    action: 'like',
    position: index,
    ts: new Date(Date.UTC(2026, 10, 24, 12, 0, index)).toISOString(),
    ...overrides,
  }
}

async function startServer(): Promise<{ url: string; events: MemoryEventStore }> {
  const events = new MemoryEventStore()
  running = await createServer({ events }).listen(0, '127.0.0.1')
  return { url: running.url, events }
}

afterEach(async () => {
  await running?.close()
  running = undefined
})

describe('http event store', () => {
  it('appends, exports and erases against a real server', async () => {
    const { url } = await startServer()
    const store = httpEventStore({ url, sleep: async () => {} })

    const first = event('reader', 0)
    const second = event('reader', 1, { action: 'dislike' })
    await store.append([first, second])

    const exported = await store.export({ actor: 'reader' })
    expect(exported.map((entry) => entry.id)).toEqual([first.id, second.id])

    expect((await store.query({ actor: 'reader', limit: 1 })).map((e) => e.id)).toEqual([first.id])
    expect((await store.query({ actor: 'reader', cardId: 'books:1' })).map((e) => e.id)).toEqual([
      second.id,
    ])

    expect(await store.erase('reader')).toBe(2)
    expect(await store.export({ actor: 'reader' })).toEqual([])
  })

  it('requires an actor to export', async () => {
    const { url } = await startServer()
    const store = httpEventStore({ url, sleep: async () => {} })
    await expect(store.export({})).rejects.toBeInstanceOf(TypeError)
  })

  it('retries a transport failure and then succeeds', async () => {
    const { url } = await startServer()
    let calls = 0
    const flaky: typeof fetch = async (input, init) => {
      calls += 1
      if (calls === 1) throw new TypeError('offline')
      return fetch(input, init)
    }
    const store = httpEventStore({
      url,
      fetch: flaky,
      attempts: 2,
      sleep: async () => {},
    })
    await store.append([event('reader', 0)])
    expect(calls).toBe(2)
    expect(await store.export({ actor: 'reader' })).toHaveLength(1)
  })

  it('does not retry a 4xx and reports the status', async () => {
    let calls = 0
    const rejecting: typeof fetch = async () => {
      calls += 1
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
    const store = httpEventStore({
      url: 'http://127.0.0.1:1',
      fetch: rejecting,
      attempts: 3,
      sleep: async () => {},
    })

    const failure = await store.append([event('reader', 0)]).catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(RemoteStoreError)
    expect((failure as RemoteStoreError).status).toBe(401)
    expect(calls).toBe(1)
  })

  it('retries a 5xx before giving up', async () => {
    let calls = 0
    const failing: typeof fetch = async () => {
      calls += 1
      return new Response('boom', { status: 503 })
    }
    const store = httpEventStore({
      url: 'http://127.0.0.1:1',
      fetch: failing,
      attempts: 3,
      sleep: async () => {},
    })

    await expect(store.append([event('reader', 0)])).rejects.toMatchObject({ status: 503 })
    expect(calls).toBe(3)
  })
})

describe('outbox', () => {
  it('pushes the local log once and pulls the remote history back', async () => {
    const { url } = await startServer()
    const remote = httpEventStore({ url, sleep: async () => {} })
    const local = new MemoryEventStore()
    const outbox = createOutbox({ local, remote })

    const swipes = [event('reader', 0), event('reader', 1), event('reader', 2)]
    await local.append(swipes)
    expect(await outbox.pending()).toHaveLength(3)

    expect(await outbox.flush()).toEqual({ pushed: 3 })
    expect(await outbox.pending()).toEqual([])
    expect(await outbox.flush()).toEqual({ pushed: 0 })
    expect(await remote.query({ actor: 'reader' })).toHaveLength(3)

    const other = new MemoryEventStore()
    const puller = createOutbox({ local: other, remote })
    expect(await puller.pull('reader')).toEqual({ pulled: 3 })
    // Stores return ULID order, which is not necessarily insertion order here.
    expect((await other.query({ actor: 'reader' })).map((e) => e.id)).toEqual(
      swipes.map((e) => e.id).sort(),
    )
    // Pulling again is a no-op rather than a duplicate.
    expect(await puller.pull('reader')).toEqual({ pulled: 0 })
    expect(await other.query({ actor: 'reader' })).toHaveLength(3)
  })

  it('keeps events pending when the network is down and syncs when it returns', async () => {
    const { url } = await startServer()
    let online = false
    const flaky: typeof fetch = async (input, init) => {
      if (!online) throw new TypeError('offline')
      return fetch(input, init)
    }
    const remote = httpEventStore({ url, fetch: flaky, attempts: 1, sleep: async () => {} })
    const local = new MemoryEventStore()
    const outbox = createOutbox({ local, remote })

    const swipes = [event('reader', 0), event('reader', 1)]
    await local.append(swipes)

    await expect(outbox.flush()).rejects.toBeInstanceOf(RemoteStoreError)
    expect(await outbox.pending()).toHaveLength(2)

    online = true
    expect(await outbox.flush()).toEqual({ pushed: 2 })
    expect(await outbox.pending()).toEqual([])
  })

  it('batches the push so a large log does not go out in one request', async () => {
    const { url } = await startServer()
    const remote = httpEventStore({ url, sleep: async () => {} })
    const local = new MemoryEventStore()
    const outbox = createOutbox({ local, remote, batchSize: 2 })

    await local.append([event('reader', 0), event('reader', 1), event('reader', 2)])
    expect(await outbox.flush()).toEqual({ pushed: 3 })
    expect(await remote.query({ actor: 'reader' })).toHaveLength(3)
  })
})
