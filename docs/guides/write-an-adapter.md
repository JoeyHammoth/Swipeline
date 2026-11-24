# Write a source adapter

An adapter turns one source into [`Card`s](/concepts/cards-and-adapters). It is the
most useful contribution to the project and usually a day's work, most of it
reading the source's terms.

## Start manually

There is no published adapter generator yet. The manual path below is the
supported way to create an adapter; a generator is planned for the
`create-swipeline` package in M3.

## Implement `SourceAdapter`

```ts
import type { SourceAdapter } from '@swipeline/core'

interface Row {
  id: string
  name: string
  summary: string
  categories: string[]
  image?: { url: string; alt?: string }
  permalink: string
}

export const adapter: SourceAdapter<Row> = {
  id: 'my-source',
  capabilities: { pagination: 'offset', search: true, filters: ['category'] },

  attribution: { text: 'Data from My Source', url: 'https://my-source.example', required: true },

  async fetch({ cursor, query, filters, signal }) {
    const offset = cursor ? Number(cursor) : 0
    const url = new URL('https://api.my-source.example/items')
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('limit', '40')
    if (query) url.searchParams.set('q', query)
    if (typeof filters?.category === 'string') url.searchParams.set('category', filters.category)

    const response = await globalThis.fetch(url, {
      signal,
      headers: { accept: 'application/json' },
    })

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '1')
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      // One retry only; let the engine back off after that.
    }
    if (!response.ok) throw new Error(`my-source: HTTP ${response.status}`)

    const body = (await response.json()) as { items: Row[]; next?: string | null }
    return {
      items: body.items,
      ...(body.next ? { nextCursor: String(body.next) } : {}),
    }
  },

  normalize(row) {
    if (!row.id || !row.name) return null
    return {
      schemaVersion: 1,
      id: `my-source:${row.id}`,
      sourceId: 'my-source',
      title: row.name,
      body: row.summary || undefined,
      tags: row.categories.map((tag) => tag.trim().toLowerCase()).slice(0, 12),
      media: row.image ? [{ kind: 'image', url: row.image.url, alt: row.image.alt }] : undefined,
      url: row.permalink,
      attribution: { text: 'Data from My Source', url: 'https://my-source.example', required: true },
      fetchedAt: new Date().toISOString(),
    }
  },
}
```

## Rules the review enforces

| Rule | Why |
|---|---|
| `normalize` returns `null` for unmappable rows | One bad row must not empty a deck |
| `fetch` passes `signal` through | Cancelling a deck must cancel requests |
| 429 and 5xx are handled | A retry storm gets the adapter blocked |
| `attribution` is declared when required | Terms, and the default UI renders it |
| `id` never changes silently | Ids are history keys; changing one orphans likes |
| Tags are lower-cased and deduplicated | Profiles key on normalized tags |
| No scraping undocumented endpoints | Legal and ethical baseline |
| Fixtures, not live network, in tests | CI cannot depend on a third party |

## Tests

```ts
import { describe, expect, it } from 'vitest'
import { cardSchema } from '@swipeline/core'
import { adapter } from '../src/index.js'
import fixture from './fixtures/search.json' with { type: 'json' }

describe('my-source adapter', () => {
  it('normalizes a real payload', async () => {
    const cards = (fixture.items as unknown[])
      .map((row) => adapter.normalize(row))
      .filter((card) => card !== null)

    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(cardSchema.safeParse(card).success).toBe(true)
      expect(card.id.startsWith('my-source:')).toBe(true)
    }
  })

  it('drops rows it cannot map instead of throwing', () => {
    expect(adapter.normalize({} as never)).toBeNull()
  })
})
```

The workspace package `@swipeline/adapter-testkit` provides shared conformance
assertions for pagination termination, required attribution and schema validity
for every fixture row.

## Publish and register

1. Publish as `swipeline-adapter-<name>` with the `swipeline-adapter` keyword.
2. Add an entry to
   [`registry/adapters.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/adapters.json)
   in a separate PR. The schema is `registry/schema.json`.
3. The registry PR must state: license (permissive), terms URL, rate limits, and
   whether attribution is required.

Registry entries show license, maintainers and last publish date in the docs
catalog. Being listed is a convenience, not an endorsement.
