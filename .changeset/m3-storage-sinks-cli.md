---
"@swipeline/store-sqlite": minor
"@swipeline/store-postgres": minor
"@swipeline/store-remote": minor
"@swipeline/sinks": minor
"@swipeline/cli": minor
---

Continue M3 with the storage and delivery slice.

- `@swipeline/store-sqlite`: `EventStore`, `ItemStore` and `ProfileStore` in one SQLite file through Node's `node:sqlite`, so there is no native build. Runs the shared store conformance suite.
- `@swipeline/store-postgres`: the same contracts over any `pg`-compatible client, with tables created on open; the conformance suite runs against PGlite.
- `@swipeline/store-remote`: `httpEventStore` over the server routes, with retry and backoff, and `createOutbox` for offline-then-online sync where the local log itself is the queue.
- `@swipeline/sinks`: `webhookSink` with HMAC-SHA256 signatures, a replay window and a stable delivery id, plus `verifyWebhookSignature`, `jsonlFileSink` and `consoleSink`.
- `@swipeline/cli`: `serve --db` persists the log in SQLite, and `export`, `import`, `doctor` and `bench` are new. `bench --gate` exits 3 on a ranking regression.
