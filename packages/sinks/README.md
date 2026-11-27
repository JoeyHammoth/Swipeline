# @swipeline/sinks

Implementations of the `Sink` interface from `@swipeline/core`. A sink receives
each batch of committed swipe events, which is how a host app feeds its own
analytics or recommender without Swipeline knowing about it.

```ts
import { createEngine } from '@swipeline/core'
import { jsonlFileSink, webhookSink } from '@swipeline/sinks'

const engine = createEngine({
  deckId: 'books',
  actor: 'reader',
  source,
  sinks: [
    webhookSink({ url: 'https://api.example.com/swipes', secret: process.env.SIGNING_SECRET! }),
    jsonlFileSink({ path: './swipes.jsonl' }),
  ],
})
```

## `webhookSink`

`POST`s `{ delivery, events }` as JSON with two headers:

| Header | Value |
|---|---|
| `x-swipeline-delivery` | SHA-256 of the sorted event ids, truncated to 32 hex characters |
| `x-swipeline-signature` | `t=<unix seconds>,v1=<hex HMAC-SHA256 of `t.body`>` |

The same batch always produces the same delivery id, so a retry (the engine
retries when `deliver` throws, which it does on any non-2xx) can be deduplicated
by the receiver. Sign the exact bytes you receive, not a re-serialization.

`verifyWebhookSignature` is the receiver side: constant-time comparison plus a
timestamp tolerance (300 seconds by default) that rejects replays of an old
capture.

```ts
if (!verifyWebhookSignature({ secret, header: request.headers['x-swipeline-signature'], body })) {
  return response.status(401).end()
}
```

## `jsonlFileSink` and `consoleSink`

`jsonlFileSink` appends one JSON object per line, the format `swipeline validate`
and `swipeline import` read. `consoleSink` prints one readable line per event.

Durable delivery, ordering and replay are the caller's problem by design: a sink
is a function, and the event log is the source of truth if it goes wrong.

Apache-2.0.
