import { AdapterConformanceError, assertAdapterConformance } from '@swipeline/adapter-testkit'
import type { Card, SourceAdapter } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import {
  createHttpJsonAdapter,
  type HttpJsonAdapterConfig,
  HttpJsonError,
  readPath,
} from '../src/index.js'

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)

interface RawDoc {
  key: string | number
  title?: string
  author_name?: string[]
  subject?: (string | number)[]
  cover_i?: number
  [field: string]: unknown
}

const VALID_DOC: RawDoc = {
  key: '/works/OL1W',
  title: 'A Book',
  author_name: ['Ada Lovelace'],
  subject: ['Science Fiction', ' space ', 'science fiction'],
  cover_i: 42,
}

const INVALID_DOC: RawDoc = { key: '/works/OL2W', title: '   ' }

const EMPTY_TITLE_DOC: RawDoc = { key: '/works/OL3W' }

const BASE: HttpJsonAdapterConfig = {
  id: 'openlibrary',
  url: 'https://example.test/search.json',
  itemsPath: 'docs',
  map: {
    id: 'key',
    title: 'title',
    subtitle: 'author_name[0]',
    tags: 'subject[:8]',
  },
  pagination: { mode: 'page', pageSize: 2 },
  now: () => NOW,
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function fakeFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(
      init === undefined ? { url: url.toString(), init: undefined } : { url: url.toString(), init },
    )
    return handler(url, init)
  }) as typeof fetch
  return { impl, calls }
}

describe('readPath', () => {
  it('reads nested properties, indexes and slices', () => {
    const value = { a: { b: [{ c: 7 }] }, tags: ['a', 'b', 'c'] }
    expect(readPath(value, 'a.b[0].c')).toBe(7)
    expect(readPath(value, 'tags[:2]')).toEqual(['a', 'b'])
    expect(readPath(value, 'a.b[1].c')).toBeUndefined()
    expect(readPath(value, '')).toBe(value)
  })
})

describe('createHttpJsonAdapter normalization', () => {
  it('maps a valid row and drops a bad title', async () => {
    const { impl } = fakeFetch(() =>
      jsonResponse({ docs: [VALID_DOC, INVALID_DOC, EMPTY_TITLE_DOC] }),
    )
    const adapter = createHttpJsonAdapter({ ...BASE, fetch: impl, pagination: { mode: 'none' } })
    const page = await adapter.fetch({})
    expect(page.items).toHaveLength(3)
    expect(adapter.stats.fetched).toBe(3)

    const card = adapter.normalize(page.items[0])
    expect(card).toMatchObject({
      schemaVersion: 1,
      id: 'openlibrary:/works/OL1W',
      sourceId: 'openlibrary',
      title: 'A Book',
      subtitle: 'Ada Lovelace',
      tags: ['science fiction', 'space'],
      fetchedAt: new Date(NOW).toISOString(),
    })
    expect(adapter.normalize(page.items[1])).toBeNull()
    expect(adapter.normalize(page.items[2])).toBeNull()
    expect(adapter.stats.dropped).toBe(2)
  })

  it('keeps a valid http url and rejects other schemes', () => {
    const adapter = createHttpJsonAdapter({
      ...BASE,
      map: { ...BASE.map, url: 'url' },
      fetch: fakeFetch(() => jsonResponse({})).impl,
    })
    const withUrl = adapter.normalize({ ...VALID_DOC, url: 'https://example.test/work' })
    const badUrl = adapter.normalize({ ...VALID_DOC, url: 'javascript:alert(1)' })
    expect(withUrl?.url).toBe('https://example.test/work')
    expect(badUrl?.url).toBeUndefined()
  })

  it('maps media and facts defensively', () => {
    const adapter = createHttpJsonAdapter({
      ...BASE,
      map: { id: 'key', title: 'title', media: 'media', facts: 'facts' },
      fetch: fakeFetch(() => jsonResponse({})).impl,
    })
    const card = adapter.normalize({
      ...VALID_DOC,
      media: [{ url: 'https://example.test/a.jpg', alt: 'Cover' }, 'not-a-url'],
      facts: [{ label: 'Pages', value: 320 }, { label: 'Broken' }],
    })
    expect(card?.media).toEqual([
      { kind: 'image', url: 'https://example.test/a.jpg', alt: 'Cover' },
    ])
    expect(card?.facts).toEqual([{ label: 'Pages', value: 320 }])
  })

  it('is deterministic for fetchedAt and stable across calls', () => {
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: fakeFetch(() => jsonResponse({})).impl,
    })
    expect(adapter.normalize(VALID_DOC)?.id).toBe(adapter.normalize(VALID_DOC)?.id)
    expect(adapter.normalize(VALID_DOC)?.fetchedAt).toBe(new Date(NOW).toISOString())
  })
})

describe('createHttpJsonAdapter pagination and requests', () => {
  it('advances page cursors and terminates on a short page', async () => {
    const pages: Record<string, unknown> = {
      '1': { docs: [VALID_DOC, { ...VALID_DOC, key: '/works/OL9W', title: 'Second' }] },
      '2': { docs: [VALID_DOC] },
    }
    const { impl, calls } = fakeFetch((url) =>
      jsonResponse(pages[url.searchParams.get('page') ?? '']),
    )
    const adapter = createHttpJsonAdapter({ ...BASE, fetch: impl })

    const first = await adapter.fetch({})
    expect(first.nextCursor).toBe('2')
    expect(calls[0]?.url).toContain('page=1')
    expect(calls[0]?.url).toContain('limit=2')

    const second = await adapter.fetch(
      first.nextCursor === undefined ? {} : { cursor: first.nextCursor },
    )
    expect(second.nextCursor).toBeUndefined()
    expect(calls[1]?.url).toContain('page=2')
  })

  it('advances offset cursors by the page size', async () => {
    const pages: Record<string, unknown> = {
      '0': { docs: [VALID_DOC, { ...VALID_DOC, key: '/works/OL9W', title: 'Second' }] },
      '2': { docs: [VALID_DOC] },
    }
    const { impl, calls } = fakeFetch((url) =>
      jsonResponse(pages[url.searchParams.get('offset') ?? '']),
    )
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      pagination: { mode: 'offset', pageSize: 2 },
    })

    const first = await adapter.fetch({})
    expect(first.nextCursor).toBe('2')
    await adapter.fetch(first.nextCursor === undefined ? {} : { cursor: first.nextCursor })
    expect(calls[1]?.url).toContain('offset=2')
  })

  it('reads an opaque cursor from the response', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse({ docs: [VALID_DOC], next: 'abc123' }))
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      pagination: { mode: 'cursor', param: 'after' },
    })
    const page = await adapter.fetch({})
    expect(page.nextCursor).toBe('abc123')
    await adapter.fetch(page.nextCursor === undefined ? {} : { cursor: page.nextCursor })
    expect(calls[1]?.url).toContain('after=abc123')
  })

  it('passes search, declared filters and ignores undeclared ones', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse({ docs: [] }))
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      pagination: { mode: 'none' },
      queryParam: 'search',
      filters: ['language'],
    })
    await adapter.fetch({ query: 'dune', filters: { language: 'en', secret: 'x' } })
    const url = new URL(calls[0]?.url ?? '')
    expect(url.searchParams.get('search')).toBe('dune')
    expect(url.searchParams.get('language')).toBe('en')
    expect(url.searchParams.get('secret')).toBeNull()
  })

  it('substitutes url placeholders instead of duplicating parameters', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse({ docs: [] }))
    const adapter = createHttpJsonAdapter({
      ...BASE,
      url: 'https://example.test/search.json?page={page}&q={query}',
      fetch: impl,
    })
    await adapter.fetch({ query: 'space opera' })
    const url = new URL(calls[0]?.url ?? '')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('q')).toBe('space opera')
    expect(url.searchParams.getAll('page')).toHaveLength(1)
  })
})

describe('createHttpJsonAdapter failures', () => {
  it('retries 429 with Retry-After and succeeds', async () => {
    let attempts = 0
    const sleeps: number[] = []
    const { impl } = fakeFetch(() => {
      attempts += 1
      if (attempts === 1) return jsonResponse({}, 429, { 'retry-after': '2' })
      return jsonResponse({ docs: [VALID_DOC] })
    })
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      pagination: { mode: 'none' },
      retry: { maxRetries: 2, sleep: async (ms) => void sleeps.push(ms) },
    })
    const page = await adapter.fetch({})
    expect(attempts).toBe(2)
    expect(sleeps).toEqual([2000])
    expect(page.items).toHaveLength(1)
  })

  it('throws with the status after retries are exhausted', async () => {
    const { impl } = fakeFetch(() => jsonResponse({}, 503))
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      retry: { maxRetries: 1, sleep: async () => {} },
    })
    await expect(adapter.fetch({})).rejects.toMatchObject({ name: 'HttpJsonError', status: 503 })
  })

  it('does not retry a 403', async () => {
    let attempts = 0
    const { impl } = fakeFetch(() => {
      attempts += 1
      return jsonResponse({}, 403)
    })
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: impl,
      retry: { maxRetries: 3, sleep: async () => {} },
    })
    await expect(adapter.fetch({})).rejects.toBeInstanceOf(HttpJsonError)
    expect(attempts).toBe(1)
  })

  it('reports a non-array itemsPath', async () => {
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: fakeFetch(() => jsonResponse({ docs: 'nope' })).impl,
      pagination: { mode: 'none' },
    })
    await expect(adapter.fetch({})).rejects.toThrow(/array/)
  })

  it('forwards the abort signal and refuses an already-aborted request', async () => {
    const controller = new AbortController()
    const { impl, calls } = fakeFetch(() => jsonResponse({ docs: [] }))
    const adapter = createHttpJsonAdapter({ ...BASE, fetch: impl })
    await adapter.fetch({ signal: controller.signal })
    expect(calls[0]?.init?.signal).toBe(controller.signal)

    controller.abort()
    await expect(adapter.fetch({ signal: controller.signal })).rejects.toThrow(/aborted/)
  })
})

describe('adapter conformance', () => {
  it('passes for the http-json adapter', async () => {
    const adapter = createHttpJsonAdapter({
      ...BASE,
      fetch: fakeFetch(() => jsonResponse({})).impl,
    })
    const report = assertAdapterConformance(adapter, {
      validRaw: [VALID_DOC],
      invalidRaw: [INVALID_DOC, EMPTY_TITLE_DOC, null],
    })
    expect(report).toEqual({ adapterId: 'openlibrary', checked: 1, dropped: 3 })
  })

  it('passes for a second, hand-written adapter', () => {
    const adapter: SourceAdapter<{ id: string; name: string }> = {
      id: 'demo',
      capabilities: { pagination: 'none' },
      async fetch() {
        return { items: [{ id: '1', name: 'One' }] }
      },
      normalize(raw): Card {
        return {
          schemaVersion: 1,
          id: `demo:${raw.id}`,
          sourceId: 'demo',
          title: raw.name,
          fetchedAt: new Date(NOW).toISOString(),
        }
      },
    }
    expect(
      assertAdapterConformance(adapter, {
        validRaw: [{ id: '1', name: 'One' }],
        invalidRaw: [{ id: '', name: '' }],
      }).checked,
    ).toBe(1)
  })

  it('explains what a broken adapter got wrong', () => {
    const broken: SourceAdapter<{ id: string }> = {
      id: 'broken',
      capabilities: { pagination: 'none' },
      async fetch() {
        return { items: [] }
      },
      normalize(raw) {
        return {
          schemaVersion: 1,
          id: raw.id,
          sourceId: 'other',
          title: 'x',
          fetchedAt: new Date(NOW).toISOString(),
        }
      },
    }
    expect(() => assertAdapterConformance(broken, { validRaw: [{ id: '1' }] })).toThrow(
      AdapterConformanceError,
    )
  })
})
