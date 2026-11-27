import { parseDeckManifest } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import { httpJson, httpJsonSourceConfig } from '../src/index.js'

const source = parseDeckManifest({
  id: 'books',
  source: {
    type: 'http-json',
    id: 'openlibrary',
    url: 'https://openlibrary.org/search.json?q={query}&page={page}',
    itemsPath: 'docs',
    map: { id: 'key', title: 'title', subtitle: 'author_name[0]' },
    pagination: { type: 'page', param: 'page', pageSize: 2 },
  },
}).source

describe('httpJson from a manifest', () => {
  it('maps the manifest source onto the adapter config', () => {
    const config = httpJsonSourceConfig(source)
    expect(config.id).toBe('openlibrary')
    expect(config.itemsPath).toBe('docs')
    expect(config.map).toEqual({ id: 'key', title: 'title', subtitle: 'author_name[0]' })
    expect(config.pagination).toEqual({ mode: 'page', param: 'page', pageSize: 2 })
    // Optional keys are absent rather than set to undefined.
    expect('queryParam' in config).toBe(false)
    expect('attribution' in config).toBe(false)
  })

  it('follows the page pagination without any code', async () => {
    const requested: string[] = []
    const fetchStub: typeof fetch = async (input) => {
      requested.push(String(input))
      const page = new URL(String(input)).searchParams.get('page') ?? '1'
      return new Response(
        JSON.stringify({
          docs: [
            { key: `/works/OL${page}W`, title: `Book ${page}`, author_name: ['A'] },
            { key: `/works/OL${page}xW`, title: `Book ${page}b`, author_name: ['B'] },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const adapter = httpJson({ ...httpJsonSourceConfig(source), fetch: fetchStub })
    const first = await adapter.fetch({ query: 'dune' })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).toBe('2')

    const cursor = first.nextCursor ?? ''
    await adapter.fetch({ query: 'dune', cursor })
    expect(requested[1]).toContain('page=2')
    expect(adapter.normalize(first.items[0])).toMatchObject({
      id: 'openlibrary:/works/OL1W',
      title: 'Book 1',
      subtitle: 'A',
    })
  })
})
