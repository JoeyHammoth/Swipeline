import type { EventQuery, EventStore, SwipeEvent } from '@swipeline/core'

/** A request that did not succeed. `status` is absent when the request never landed. */
export class RemoteStoreError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'RemoteStoreError'
    this.status = status
  }
}

export interface HttpEventStoreOptions {
  /** Server base URL, for example `https://swipes.example.com`. */
  url: string
  /** Sent as `authorization: Bearer <token>`. A function is re-read per request. */
  token?: string | (() => string | undefined | Promise<string | undefined>)
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Attempts per request, including the first. Defaults to 3. */
  attempts?: number
  /** First backoff delay in ms; doubles per attempt. Defaults to 100. */
  backoffMs?: number
  /** Injected in tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>
}

export interface CursorStore {
  get(key: string): string | undefined | Promise<string | undefined>
  set(key: string, value: string): void | Promise<void>
}

export interface OutboxOptions {
  /** The local log. It doubles as the outbox, so nothing needs a second queue. */
  local: EventStore
  /** Usually the result of `httpEventStore`. */
  remote: EventStore
  /** Events per push or pull batch. Defaults to 100. */
  batchSize?: number
  /** Cursor storage. Defaults to memory, which re-sends after a restart. */
  cursor?: CursorStore
}

export interface Outbox {
  /** Upload everything the server has not acknowledged yet. */
  flush(): Promise<{ pushed: number }>
  /** Download an actor's history the local log is missing. */
  pull(actor: string): Promise<{ pulled: number }>
  sync(actor: string): Promise<{ pushed: number; pulled: number }>
  /** Events still waiting for a successful push. */
  pending(): Promise<readonly SwipeEvent[]>
}

const PUSH_CURSOR = 'push'
const DEFAULT_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 100
const DEFAULT_BATCH = 100

function retryable(status: number): boolean {
  return status === 429 || status >= 500
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** In-memory cursor. A restart re-sends the log, which the server dedupes. */
export function memoryCursorStore(): CursorStore {
  const values = new Map<string, string>()
  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value)
    },
  }
}

/**
 * `EventStore` over the `@swipeline/server` HTTP API. Retries transport failures,
 * 429 and 5xx with exponential backoff; a 4xx is a caller error and is thrown
 * immediately. Queries and exports need an actor because the server scopes
 * history to one.
 */
export function httpEventStore(options: HttpEventStoreOptions): EventStore {
  const base = trimSlash(options.url)
  const fetchImpl = options.fetch ?? globalThis.fetch
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  async function headers(): Promise<Record<string, string>> {
    const token = typeof options.token === 'function' ? await options.token() : options.token
    const result: Record<string, string> = { 'content-type': 'application/json' }
    if (token) result.authorization = `Bearer ${token}`
    return result
  }

  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const requestHeaders = await headers()
    let last: unknown
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const final = attempt === attempts - 1
      let response: Response
      try {
        response = await fetchImpl(`${base}${path}`, {
          method,
          headers: requestHeaders,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      } catch (cause) {
        last = cause
        if (final) break
        await sleep(backoffMs * 2 ** attempt)
        continue
      }

      if (response.ok) return response
      const text = await response.text().catch(() => '')
      last = new RemoteStoreError(
        `${method} ${path} responded ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        response.status,
      )
      if (final || !retryable(response.status)) throw last
      await sleep(backoffMs * 2 ** attempt)
    }
    throw last instanceof RemoteStoreError
      ? last
      : new RemoteStoreError(`${method} ${path} failed: ${messageOf(last)}`)
  }

  async function exportFor(query: EventQuery): Promise<readonly SwipeEvent[]> {
    const actor = query.actor
    if (!actor) {
      throw new TypeError(
        'httpEventStore needs query.actor: the server exports one actor at a time',
      )
    }
    const params = new URLSearchParams()
    if (query.deckId !== undefined) params.set('deckId', query.deckId)
    if (query.since !== undefined) params.set('since', query.since)
    if (query.until !== undefined) params.set('until', query.until)
    if (query.afterId !== undefined) params.set('afterId', query.afterId)
    // A cardId filter runs here, so pushing `limit` to the server could truncate
    // before the filter sees the rows it needs.
    if (query.limit !== undefined && query.cardId === undefined) {
      params.set('limit', String(query.limit))
    }
    const search = params.toString()
    const response = await request(
      'GET',
      `/export/${encodeURIComponent(actor)}${search ? `?${search}` : ''}`,
    )
    const text = await response.text()
    const events = text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as SwipeEvent)
    const matched =
      query.cardId === undefined ? events : events.filter((event) => event.cardId === query.cardId)
    return query.limit === undefined ? matched : matched.slice(0, query.limit)
  }

  return {
    async append(batch: readonly SwipeEvent[]): Promise<void> {
      if (batch.length === 0) return
      await request('POST', '/events', { events: batch })
    },

    query: exportFor,
    export: exportFor,

    async erase(actor: string): Promise<number> {
      const response = await request('DELETE', `/actors/${encodeURIComponent(actor)}`)
      const body = (await response.json()) as { erased?: unknown }
      return Number(body.erased ?? 0)
    },
  }
}

/**
 * Outbox sync between a local log and a remote one. The local log is the queue:
 * events are only considered delivered once the remote call resolves, so a
 * failed push leaves them pending and nothing is lost. Because append is
 * idempotent by event id on both ends, a replayed batch cannot duplicate rows.
 */
export function createOutbox(options: OutboxOptions): Outbox {
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH)
  const cursor = options.cursor ?? memoryCursorStore()
  const { local, remote } = options

  async function flush(): Promise<{ pushed: number }> {
    let pushed = 0
    for (;;) {
      const after = await cursor.get(PUSH_CURSOR)
      const batch = await local.query(
        after === undefined ? { limit: batchSize } : { afterId: after, limit: batchSize },
      )
      if (batch.length === 0) break
      const last = batch[batch.length - 1]
      if (!last) break
      if (after !== undefined && last.id <= after) break
      await remote.append(batch)
      await cursor.set(PUSH_CURSOR, last.id)
      pushed += batch.length
      if (batch.length < batchSize) break
    }
    return { pushed }
  }

  async function pull(actor: string): Promise<{ pulled: number }> {
    const key = `pull:${actor}`
    let pulled = 0
    for (;;) {
      const after = await cursor.get(key)
      const batch = await remote.query(
        after === undefined
          ? { actor, limit: batchSize }
          : { actor, afterId: after, limit: batchSize },
      )
      if (batch.length === 0) break
      const last = batch[batch.length - 1]
      if (!last) break
      if (after !== undefined && last.id <= after) break
      await local.append(batch)
      await cursor.set(key, last.id)
      pulled += batch.length
      if (batch.length < batchSize) break
    }
    return { pulled }
  }

  return {
    flush,
    pull,
    async sync(actor: string) {
      const { pushed } = await flush()
      const { pulled } = await pull(actor)
      return { pushed, pulled }
    },
    async pending(): Promise<readonly SwipeEvent[]> {
      const after = await cursor.get(PUSH_CURSOR)
      return local.query(after === undefined ? {} : { afterId: after })
    },
  }
}
