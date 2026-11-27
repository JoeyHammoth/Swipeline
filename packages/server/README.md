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
| `GET` | `/deck/:id/next` | Planned (needs the item store and ranking) |
| `GET` | `/collections/:id` | Planned |
| `GET` | `/openapi.json` | Planned |

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

## Not here yet

Server-side ranking, collections, the OpenAPI document and webhook delivery from
this process. Webhooks are a `Sink` from `@swipeline/sinks`; the server exposes
history and leaves delivery to the caller. The route list above is the honest
coverage; the design plan's M3 section has the rest.
