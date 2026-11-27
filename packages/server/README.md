# @swipeline/server

The optional HTTP service: append swipes, export a portable history and erase an
actor. Storage is whatever `EventStore` you pass in, so the same routes work in a
test with `MemoryEventStore` and in production with a durable store.

```ts
import { createServer } from '@swipeline/server'
import { MemoryEventStore } from '@swipeline/core'

const server = createServer({ events: new MemoryEventStore() })
const running = await server.listen(8787)
console.log(running.url) // http://127.0.0.1:8787
```

## Routes

| Method | Path | Status |
|---|---|---|
| `GET` | `/health` | Implemented |
| `POST` | `/events` | Implemented — validates, is idempotent by event id, rejects a body over `maxBodyBytes` |
| `GET` | `/export/:actor` | Implemented — JSONL, honours `deckId`, `since`, `until`, `afterId`, `limit` |
| `DELETE` | `/actors/:actor` | Implemented |
| `GET` | `/deck/:id/next` | Implemented — ranked cards, needs `items` in the options |
| `GET` | `/collections/:id` | Implemented — `later` today |
| `GET` | `/openapi.json` | Implemented — OpenAPI 3.1 for the routes above |

`POST /events` accepts either an array or `{ "events": [...] }`.

## Authentication

Swipline does not implement accounts. Pass a hook; return `null` to reject with
401. When a hook is configured, a batch may only contain events for the actor it
resolves, so a client cannot write into someone else's history.

```ts
createServer({
  events,
  authenticate: async (request) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    const claims = await verifyJwt(token)
    return claims ? { actor: claims.sub } : null
  },
})
```

## CORS

`cors` takes an origin or a list. Omit it and no CORS headers are sent. `*` and
`access-control-allow-credentials` are never combined, because browsers reject
that pair.

## Storage

`MemoryEventStore` is fine for a test, not for production. Durable stores live
next to this package:

- `@swipeline/store-sqlite` — one file, Node's `node:sqlite`, no native build.
- `@swipeline/store-postgres` — any `pg`-compatible client.

`swipeline serve --db ./swipes.db` wires the SQLite store for you.

## Ranking and collections

`GET /deck/:id/next` runs `defaultPipeline()` from `@swipeline/rank` over the
server's `ItemStore` and the actor's events, so a client sees the same order on
every device. Pass `rank` to substitute a pipeline and `rng`/`now` to make it
reproducible. `GET /collections/:id` serves `later` — the cards whose most recent
effective action was `later`, with undo taken into account.

```ts
createServer({ events, items, rank: myPipeline })
```

## Not here yet

Webhook delivery from this process: a webhook is a `Sink` from
`@swipeline/sinks`, and the server exposes history and leaves delivery to the
caller. Further collections (`starred`, shared decks) are additive. The route
list above is the honest coverage, and `/openapi.json` is generated from it.
