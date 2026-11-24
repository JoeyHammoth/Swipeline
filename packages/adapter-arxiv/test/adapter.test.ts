import { assertAdapterConformance } from '@swipeline/adapter-testkit'
import { describe, expect, it, vi } from 'vitest'
import { createArxivAdapter, parseArxivFeed } from '../src/index.js'

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v2</id>
    <title>Retrieval Augmented Deck Ranking</title>
    <summary>We study ranking for swipe interfaces with a small preference budget.</summary>
    <published>2024-01-02T18:00:00Z</published>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
    <link rel="alternate" href="http://arxiv.org/abs/2401.00001v2"/>
    <category term="cs.LG"/>
    <category term="cs.IR"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.00002v1</id>
    <title>Local-First Recommendation &amp; Privacy</title>
    <summary>A privacy-preserving design for on-device profiles.</summary>
    <published>2024-01-03T09:00:00Z</published>
    <author><name>Grace Hopper</name></author>
    <category term="cs.CR"/>
  </entry>
</feed>`

const entries = parseArxivFeed(FEED)

function xml(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/atom+xml' } })
}

describe('arxiv adapter', () => {
  it('parses entries and decodes entities', () => {
    expect(entries).toHaveLength(2)
    expect(entries[1]?.title).toBe('Local-First Recommendation & Privacy')
    expect(entries[0]?.categories).toEqual(['cs.LG', 'cs.IR'])
  })

  it('passes adapter conformance', () => {
    const report = assertAdapterConformance(createArxivAdapter(), {
      validRaw: entries,
      invalidRaw: [{ id: '', title: '' }, { title: 'No id' }] as never[],
    })
    expect(report.checked).toBe(2)
    expect(report.dropped).toBe(2)
  })

  it('strips the version from the id and keeps the published date', () => {
    const card = createArxivAdapter().normalize(entries[0] as (typeof entries)[number])
    expect(card?.id).toBe('arxiv:2401.00001')
    expect(card?.subtitle).toContain('Ada Lovelace')
    expect(card?.facts?.[0]?.value).toBe('2024-01-02')
  })

  it('builds a category query and an offset cursor', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) => xml(FEED))
    const adapter = createArxivAdapter({
      fetch: fetch as unknown as typeof globalThis.fetch,
      categories: ['cs.LG', 'cs.CL'],
      limit: 2,
    })
    const page = await adapter.fetch({})
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.searchParams.get('search_query')).toBe('cat:cs.LG OR cat:cs.CL')
    expect(url.searchParams.get('max_results')).toBe('2')
    expect(page.nextCursor).toBe('2')
  })
})
