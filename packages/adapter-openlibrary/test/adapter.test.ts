import { assertAdapterConformance } from '@swipeline/adapter-testkit'
import { describe, expect, it, vi } from 'vitest'
import { createOpenLibraryAdapter, type OpenLibraryDoc } from '../src/index.js'
import fixture from './fixtures/search.json' with { type: 'json' }

const docs = fixture.docs as OpenLibraryDoc[]

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('openlibrary adapter', () => {
  it('passes adapter conformance', () => {
    const report = assertAdapterConformance(createOpenLibraryAdapter(), {
      validRaw: docs,
      invalidRaw: [{ title: 'No key' }, { key: '/works/missing' }] as OpenLibraryDoc[],
    })
    expect(report.checked).toBe(2)
    expect(report.dropped).toBe(2)
  })

  it('maps covers, tags and links', () => {
    const card = createOpenLibraryAdapter().normalize(docs[0] as OpenLibraryDoc)
    expect(card?.id).toBe('openlibrary:OL123W')
    expect(card?.subtitle).toBe('Andy Weir')
    expect(card?.tags).toEqual(['science fiction', 'space', 'survival'])
    expect(card?.media?.[0]?.url).toContain('987654-M.jpg')
    expect(card?.url).toBe('https://openlibrary.org/works/OL123W')
  })

  it('requests the next page and maps a query', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) => response(fixture))
    const adapter = createOpenLibraryAdapter({
      fetch: fetch as unknown as typeof globalThis.fetch,
      limit: 1,
      now: () => Date.UTC(2026, 10, 24),
    })
    const page = await adapter.fetch({ query: 'hail mary' })
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.searchParams.get('q')).toBe('hail mary')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(page.nextCursor).toBe('2')
    expect(page.items).toHaveLength(2)
  })
})
