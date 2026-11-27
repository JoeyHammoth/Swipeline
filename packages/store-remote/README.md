# @swipeline/store-remote

Two pieces that let a deck keep working offline and sync later:

- `httpEventStore` — an `EventStore` backed by the `@swipeline/server` routes.
- `createOutbox` — pushes the local log to that server and pulls the actor's
  history back, with the local log acting as the outbox.

```ts
import { createOutbox, httpEventStore } from '@swipeline/store-remote'
import { createIndexedDbStores } from '@swipeline/store-indexeddb'

const local = await createIndexedDbStores({ name: 'books' })
const remote = httpEventStore({ url: 'https://swipes.example.com', token: getJwt })
const outbox = createOutbox({ local: local.events, remote })

// Offline: swipes land in the local log.
await local.events.append(swipe)
// Later: push what the server has not seen, then pull what we have not seen.
await outbox.sync('reader')
```

## What is durable

The local event log *is* the queue. A push is only recorded as delivered after
the server answers, so a crash or a failed request leaves the events pending and
`outbox.pending()` still lists them. `flush` advances a cursor after each batch
instead of relying on memory, and because `append` is idempotent by event id on
both sides, re-sending a batch never duplicates rows.

The cursor defaults to memory: a restarted process re-sends the log from the
beginning, which is correct but does more work. Pass your own `cursor` (a row in
IndexedDB, a file, a `localStorage` key) to persist it.

## Retries

`httpEventStore` retries transport failures, `429` and `5xx` three times with
exponential backoff; `4xx` responses are caller errors and thrown immediately.
`RemoteStoreError.status` tells the two apart. Both `fetch`, `sleep` and the
attempt count are injectable, so tests do not wait.

Queries and exports require `actor`: the server only exports one actor's history
at a time, and throwing beats silently returning someone else's rows.

Apache-2.0.
