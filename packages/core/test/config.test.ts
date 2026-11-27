import { describe, expect, it } from 'vitest'
import { defineDeck, parseDeckManifest } from '../src/index.js'

const manifest = {
  id: 'books',
  actor: 'local',
  source: {
    type: 'http-json',
    id: 'openlibrary',
    url: 'https://openlibrary.org/search.json?q={query}&page={page}',
    itemsPath: 'docs',
    map: { id: 'key', title: 'title', subtitle: 'author_name[0]' },
    pagination: { type: 'page', param: 'page' },
    attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
  },
  actions: { right: 'like', left: 'dislike' },
  prefetch: { buffer: 8, refillAt: 3 },
  undoDepth: 5,
  template: 'media',
} as const

describe('deck manifest', () => {
  it('parses a full manifest', () => {
    const parsed = parseDeckManifest(manifest)
    expect(parsed.id).toBe('books')
    expect(parsed.source.map.id).toBe('key')
    expect(parsed.source.pagination?.type).toBe('page')
  })

  it('rejects an unknown key instead of ignoring it', () => {
    expect(() => parseDeckManifest({ ...manifest, decks: [] })).toThrow()
    expect(() =>
      parseDeckManifest({ ...manifest, source: { ...manifest.source, pag: {} } }),
    ).toThrow()
    expect(() =>
      parseDeckManifest({
        ...manifest,
        source: { ...manifest.source, map: { id: 'a', title: 'b', tite: 'c' } },
      }),
    ).toThrow()
  })

  it('rejects an id that is not lower-case', () => {
    expect(() => parseDeckManifest({ ...manifest, id: 'Books' })).toThrow()
    expect(() => parseDeckManifest({ ...manifest, id: '' })).toThrow()
  })

  it('rejects an unsupported source type', () => {
    expect(() =>
      parseDeckManifest({ ...manifest, source: { ...manifest.source, type: 'sql' } }),
    ).toThrow()
  })

  it('rejects a bad pagination type and a non-string action', () => {
    expect(() =>
      parseDeckManifest({
        ...manifest,
        source: { ...manifest.source, pagination: { type: 'pages' } },
      }),
    ).toThrow()
    expect(() => parseDeckManifest({ ...manifest, actions: { right: 42 } })).toThrow()
  })

  it('accepts a custom action name, which the schema allows', () => {
    expect(parseDeckManifest({ ...manifest, actions: { right: 'buy' } }).actions?.right).toBe('buy')
  })

  it('defineDeck validates and returns the manifest', () => {
    const parsed = parseDeckManifest(manifest)
    expect(defineDeck(parsed)).toEqual(parsed)
  })
})
