import { assertAdapterConformance } from '@swipeline/adapter-testkit'
import { describe, expect, it, vi } from 'vitest'
import { createTmdbAdapter, type TmdbMovie } from '../src/index.js'
import fixture from './fixtures/discover.json' with { type: 'json' }

const movies = fixture.results as TmdbMovie[]

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('tmdb adapter', () => {
  it('passes adapter conformance', () => {
    const report = assertAdapterConformance(createTmdbAdapter({ apiKey: 'test' }), {
      validRaw: movies,
      invalidRaw: [{ title: 'No id' }, { id: 1 }] as TmdbMovie[],
    })
    expect(report.checked).toBe(2)
    expect(report.dropped).toBe(2)
  })

  it('maps posters, ratings and genre names', () => {
    const card = createTmdbAdapter({
      apiKey: 'test',
      genres: { 18: 'Drama', 53: 'Thriller' },
    }).normalize(movies[0] as TmdbMovie)
    expect(card?.id).toBe('tmdb:550')
    expect(card?.subtitle).toBe('1999')
    expect(card?.tags).toContain('drama')
    expect(card?.facts).toContainEqual({ label: 'Rating', value: 8.4, unit: '/10' })
    expect(card?.media?.[0]?.url).toContain('/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg')
  })

  it('uses discover without a query and search with one', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) => response(fixture))
    const adapter = createTmdbAdapter({
      apiKey: 'secret',
      fetch: fetch as unknown as typeof globalThis.fetch,
    })
    const page = await adapter.fetch({ filters: { genre: 18 } })
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.pathname).toContain('/discover/movie')
    expect(url.searchParams.get('api_key')).toBe('secret')
    expect(url.searchParams.get('with_genres')).toBe('18')
    expect(page.nextCursor).toBe('2')

    await adapter.fetch({ query: 'matrix' })
    expect(String(fetch.mock.calls[1]?.[0])).toContain('/search/movie')
  })
})
