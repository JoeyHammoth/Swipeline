# Deck configuration

A deck is configured in `deck.config.ts` (code) or `*.deck.json` (a manifest, data
only). Precedence, lowest to highest: **built-in defaults → config file →
environment variables → runtime props**.

## Shape

```ts
interface DeckConfig {
  id: string
  source: SourceAdapter | HttpJsonOptions | DeckManifestSource
  store?: ItemStore | EventStore | ProfileStore
  items?: ItemStore
  events?: EventStore
  profiles?: ProfileStore
  embedder?: Embedder
  index?: VectorIndex
  rank?: RankStage
  actions?: Partial<Record<'right' | 'left' | 'up' | 'down', SwipeAction>>
  prefetch?: { buffer: number; refillAt: number }
  undoDepth?: number
  sinks?: Sink[]
  consent?: ConsentPolicy
  template?: 'text' | 'media' | 'facts' | 'compare'
  theme?: ThemeTokens
}
```

Unknown keys are rejected with an actionable error at startup. Everything except
functions and adapters is serializable, which is what makes a manifest possible.

## `source`

Three forms:

```ts
// 1. Declarative HTTP/JSON mapping
source: httpJson({
  id: 'openlibrary',
  url: 'https://openlibrary.org/search.json?q={query}&limit=50&page={page}',
  pagination: { type: 'page', param: 'page' },
  itemsPath: 'docs',
  map: { id: 'key', title: 'title', subtitle: 'author_name[0]', tags: 'subject[:8]' },
  attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
})

// 2. An installed adapter package
source: arxiv({ categories: ['cs.LG'] })

// 3. Your own implementation
source: myPapersAdapter
```

### Field expression grammar

| Syntax | Meaning |
|---|---|
| `a.b.c` | nested property |
| `items[0]` | array index |
| `tags[:8]` | first eight items |
| `{cover_i}` in a URL | interpolation from the same record |
| `"literal"` | literal when the value starts with a quote |

Missing paths resolve to `undefined`; a card that fails the schema is dropped and
counted. Field mapping never executes code.

### Pagination

| Form | Options |
|---|---|
| `{ type: 'page', param: 'page' }` | Increments a page number |
| `{ type: 'offset', param: 'offset', limitParam, limit }` | Offset/limit |
| `{ type: 'cursor', param: 'cursor', nextPath: 'next' }` | Reads the next cursor from the response |
| `{ type: 'none' }` | One request |

## `store`

Shorthands install all three stores; finer control uses `items`, `events`,
`profiles` separately.

```ts
store: memoryStore()            // ephemeral
store: indexedDbStore({ name: 'swipeline', version: 1 })
store: remoteStore({ url, token: () => getJwt() })
```

## `rank`

```ts
rank: pipeline(
  seenFilter(),
  hardFilters({ minPrice: 0, maxPrice: 500, excludeTags: ['ads'] }),
  tagAffinity({ weight: 0.4 }),
  prefVector({ weight: 0.6, dislikeDiscount: 0.5, halfLifeDays: 30 }),
  thompson({ strength: 0.15 }),
  epsilonRandom({ epsilon: 0.05 }),
  mmr({ lambda: 0.75 }),
)
```

Order matters. `seenFilter` first, diversification last, exploration before
diversification. See [Ranking](/concepts/ranking).

## `actions`

```ts
actions: { right: 'like', left: 'dislike', up: 'superlike', down: 'later' }
```

Custom actions (`buy`, `share`, `report`) are allowed; they are recorded as events
with weight 0 unless you assign one. Every action must also be reachable by button
and keyboard.

## `prefetch` and `undoDepth`

| Option | Default | Notes |
|---|---|---|
| `prefetch.buffer` | 8 | Cards kept ahead of the current one |
| `prefetch.refillAt` | 3 | Refill when this many remain |
| `undoDepth` | 5 | How many undos are offered |

## `theme`

```ts
theme: { accent: '#25c2a0', radiusCard: 18, motion: 'full' | 'reduced' }
```

CSS custom properties for web, a token object for React Native, same names in both.

## Manifest form

```json
{
  "id": "books",
  "source": {
    "type": "http-json",
    "id": "openlibrary",
    "url": "https://openlibrary.org/search.json?q={query}&page={page}",
    "pagination": { "type": "page", "param": "page" },
    "itemsPath": "docs",
    "map": { "id": "key", "title": "title" }
  },
  "rank": [
    { "stage": "seenFilter" },
    { "stage": "tagAffinity", "options": { "weight": 0.4 } },
    { "stage": "mmr", "options": { "lambda": 0.75 } }
  ],
  "actions": { "right": "like", "left": "dislike" }
}
```

Manifests name stages and options; they never embed code. An unknown stage or
field is refused, which is what makes importing a shared manifest safe.
