# Deck configuration

A deck is configured one of two ways:

- **`swipeline.deck.json`** — a manifest of data only, written by
  `swipeline init` and edited by `swipeline source add`. `swipeline dev` reads it.
- **`deck.config.ts`** — code, for a hand-written adapter, a custom ranker or a
  store that needs a function. The templates from `create-swipeline` use this.

Precedence, lowest to highest: **built-in defaults → config file → environment
variables → runtime props**.

## Manifest (`swipeline.deck.json`)

```json
{
  "id": "books",
  "actor": "local",
  "source": {
    "type": "http-json",
    "id": "openlibrary",
    "url": "https://openlibrary.org/search.json?q={query}&page={page}",
    "itemsPath": "docs",
    "map": { "id": "key", "title": "title", "subtitle": "author_name[0]" },
    "pagination": { "type": "page", "param": "page", "pageSize": 20 },
    "attribution": { "text": "Data from Open Library", "url": "https://openlibrary.org" }
  },
  "actions": { "right": "like", "left": "dislike" },
  "prefetch": { "buffer": 8, "refillAt": 3 },
  "undoDepth": 5,
  "template": "media"
}
```

| Key | Required | Notes |
|---|---|---|
| `id` | yes | Lower-case letters, digits and dashes; used as the deck id |
| `actor` | no | Local actor the playground swipes as. Defaults to `local` |
| `source` | yes | Only `http-json` today (see below) |
| `actions` | no | Gesture-to-action overrides; custom action names are allowed |
| `prefetch` | no | `buffer` and `refillAt`, both bounded |
| `undoDepth` | no | 0–50 |
| `template` | no | `text`, `media`, `facts` or `compare` |

Every object is strict: an unknown key is an error at startup, not a silently
ignored typo. `parseDeckManifest` throws a Zod error with the offending path.

The manifest cannot express rank stages yet. The ranker is the default pipeline;
a custom pipeline needs `deck.config.ts`.

## `source`

Declarative HTTP/JSON mapping:

```ts
import { httpJson } from '@swipeline/adapter-http-json'

source: httpJson({
  id: 'openlibrary',
  url: 'https://openlibrary.org/search.json?q={query}&limit=50&page={page}',
  pagination: { mode: 'page', param: 'page' },
  itemsPath: 'docs',
  map: { id: 'key', title: 'title', subtitle: 'author_name[0]', tags: 'subject[:8]' },
  attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
})
```

`type` is accepted as an alias for `mode` in a manifest, so the JSON block above
and the TypeScript call describe the same adapter.

Installed adapter packages export their own factory (`createOpenLibraryAdapter`,
`createArxivAdapter`, …), and a `SourceAdapter` you write by hand works anywhere
the factory does.

### Field expression grammar

| Syntax | Meaning |
|---|---|
| `a.b.c` | Nested property |
| `items[0]` | Array index |
| `tags[:8]` | First eight items |
| `""` (empty string) | The whole record |

Missing paths resolve to `undefined`; a card that fails the schema is dropped and
counted. Field mapping never executes code.

### Pagination

| `mode` / `type` | Options |
|---|---|
| `page` | `param` (default `page`), `pageSize`, `start` |
| `offset` | `param` (default `offset`), `pageSize`, `start` |
| `cursor` | `param`, `nextPath` (default `next`) |
| `none` | One request |

The URL can also carry `{page}`, `{offset}`, `{cursor}`, `{limit}` and `{query}`
placeholders instead of query parameters.

## Code config (`deck.config.ts`)

The file exports an object the app spreads into `createEngine`:

```ts
import { createOpenLibraryAdapter } from '@swipeline/adapter-openlibrary'

export const deck = {
  deckId: 'books',
  actor: 'local-reader',
  source: createOpenLibraryAdapter({ limit: 40 }),
}
```

```ts
const engine = createEngine({ ...deck, events: stores.events })
```

`createEngine` takes the fields below; the binding (React, the Web Component)
only ever sees the resulting store.

| Field | Default | Meaning |
|---|---|---|
| `deckId` | required | Namespace for events and profiles |
| `actor` | required | Actor id, or a function returning one |
| `source` | required | A `SourceAdapter` |
| `events` | `MemoryEventStore` | The append-only log |
| `sinks` | none | Receivers for committed batches |
| `consent` | none | Per-event gate on recording |
| `actions` | right/like, left/dislike, up/superlike, down/later | Gesture map |
| `prefetch.buffer` / `refillAt` | 8 / 3 | Cards kept ahead, refill threshold |
| `undoDepth` | 5 | How many undos are offered |
| `clock`, `idFactory` | real time, ULID | Injected in tests |

## Stores

There are no `store` shorthands in the config yet; pass the store explicitly.

| Need | Call |
|---|---|
| Ephemeral | `createMemoryStores()` from `@swipeline/store-memory` |
| Browser persistence | `createIndexedDbStores({ name })` from `@swipeline/store-indexeddb` |
| Node, Bun, CLI | `createSqliteStores({ path })` from `@swipeline/store-sqlite` |
| Postgres | `createPostgresStores({ client })` from `@swipeline/store-postgres` |
| Sync to a server | `httpEventStore` + `createOutbox` from `@swipeline/store-remote` |
