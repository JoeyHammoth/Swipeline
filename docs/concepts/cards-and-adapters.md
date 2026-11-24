# Cards and adapters

A **Card** is the normalized item a person swipes on. A **source adapter** turns
one API, file or database into Cards.

## Card anatomy

```ts
interface Card {
  schemaVersion: 1
  id: string              // `${sourceId}:${externalId}`
  sourceId: string
  title: string
  subtitle?: string       // author, brand, place
  body?: string           // abstract, description, snippet
  media?: Array<{ kind: 'image' | 'video'; url: string; alt?: string; width?: number; height?: number }>
  tags?: string[]         // categories, genres, keywords
  facts?: Array<{ label: string; value: string | number; unit?: string }>
  url?: string            // canonical link-out
  attribution?: { text: string; url?: string; required?: boolean }
  extra?: Record<string, unknown>
  embedding?: number[]
  fetchedAt: string
}
```

Four choices worth knowing:

- **`id` is namespaced by source.** One history can span many sources without
  collisions, and a card keeps its identity across refetches.
- **`facts` is a generic spec strip.** Products, rentals, recipes and papers all
  need a few labelled numbers; per-domain schemas are not worth it.
- **`attribution` is part of the schema.** Many APIs require credit and limit
  caching. Adapters declare it, the default templates render it.
- **`extra` is the escape hatch.** Source-specific fields go there, so the schema
  stays closed and migrations stay possible.

## Three ways to define a source

### 1. Declarative mapping (most REST/JSON APIs)

```ts
httpJson({
  id: 'openlibrary',
  url: 'https://openlibrary.org/search.json?q={query}&limit=50&page={page}',
  pagination: { type: 'page', param: 'page' },
  itemsPath: 'docs',
  map: {
    id: 'key',
    title: 'title',
    subtitle: 'author_name[0]',
    tags: 'subject[:8]',
    media: [{ kind: 'image', url: 'https://covers.openlibrary.org/b/id/{cover_i}-M.jpg' }],
    url: 'https://openlibrary.org{key}',
  },
  attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
})
```

The mapping is JSON, so it can live in a shareable manifest with no executable
code. Supported field expressions are documented in
[Deck configuration](/reference/config).

### 2. An adapter package

`swipeline-adapter-<name>` on npm, typed, tested against recorded fixtures, listed
in [`registry/adapters.json`](https://github.com/JoeyHammoth/Swipeline/blob/main/registry/adapters.json).
See [Write a source adapter](/guides/write-an-adapter).

### 3. A custom implementation

```ts
const papers: SourceAdapter<PaperRow> = {
  id: 'my-papers',
  capabilities: { pagination: 'cursor', search: true },
  async fetch({ cursor, query, signal }) {
    const res = await myDb.papers.search({ after: cursor, q: query, limit: 40, signal })
    return { items: res.rows, nextCursor: res.next }
  },
  normalize: (row) => ({
    schemaVersion: 1,
    id: `my-papers:${row.id}`,
    sourceId: 'my-papers',
    title: row.title,
    body: row.abstract,
    tags: row.categories,
    url: row.url,
    fetchedAt: new Date().toISOString(),
  }),
}
```

## Adapter responsibilities

| Responsibility | Rule |
|---|---|
| Pagination | Honour `cursor`/`nextCursor` or offset; never loop forever |
| Rate limits | Back off on 429/5xx, respect `Retry-After` |
| Abort | Pass the signal through to `fetch` |
| Bad data | `normalize` returns `null`; a single bad row never empties a deck |
| Attribution | Declare it when the source requires credit |
| Terms | Documented APIs and user-owned data only; no scraping |

The adapter test kit (`@swipeline/adapter-testkit`, M2) checks normalization
validity, pagination and attribution against recorded fixtures, so a new adapter
can be reviewed quickly.
