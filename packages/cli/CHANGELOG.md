# @swipeline/cli

## 0.4.1

### Patch Changes

- @swipeline/adapter-http-json@0.4.1
  - @swipeline/bench@0.4.1
  - @swipeline/core@0.4.1
  - @swipeline/server@0.4.1
  - @swipeline/store-sqlite@0.4.1

## 0.4.0

### Patch Changes

- @swipeline/adapter-http-json@0.4.0
  - @swipeline/bench@0.4.0
  - @swipeline/core@0.4.0
  - @swipeline/server@0.4.0
  - @swipeline/store-sqlite@0.4.0

## 0.3.0

### Minor Changes

- 04c638f: Finish the M3 surface: deck manifests, the CLI playground and the remaining server routes.
  
  - `@swipeline/core`: `deckManifestSchema`, `parseDeckManifest` and `defineDeck`. A manifest is strict JSON — unknown keys are errors — and carries `id`, `actor`, `source`, `actions`, `prefetch`, `undoDepth` and `template`.
  - `@swipeline/adapter-http-json`: `httpJson` and `httpJsonSourceConfig`, so a manifest's `source` block becomes an adapter without code; `pagination.type` is accepted as an alias for `mode`.
  - `@swipeline/server`: `GET /deck/:id/next` ranks the item store through `defaultPipeline` and skips already-swiped cards, `GET /collections/:id` serves `later` with undo accounted for, and `GET /openapi.json` documents the implemented routes.
  - `@swipeline/cli`: `init` writes a validated manifest and detects the framework, `source add` fetches a sample, infers a field map and previews the cards, and `dev` serves a playground on the real API routes with swipes stored in SQLite.
  - `create-swipeline`: scaffolds `blank`, `books`, `papers`, `recipes` and `products`; `quickstart.yml` scaffolds and builds all five weekly.
- 5342b8a: Start M3 with a working slice: `@swipeline/server` serves `/health`, validates and appends `POST /events` idempotently, exports a JSONL history, erases an actor, and supports an auth hook plus allow-listed CORS. `@swipeline/cli` ships the `swipeline` binary with `serve` and `validate`, and reports exit codes 0/1/2.
- ddbb83c: Continue M3 with the storage and delivery slice.
  
  - `@swipeline/store-sqlite`: `EventStore`, `ItemStore` and `ProfileStore` in one SQLite file through Node's `node:sqlite`, so there is no native build. Runs the shared store conformance suite.
  - `@swipeline/store-postgres`: the same contracts over any `pg`-compatible client, with tables created on open; the conformance suite runs against PGlite.
  - `@swipeline/store-remote`: `httpEventStore` over the server routes, with retry and backoff, and `createOutbox` for offline-then-online sync where the local log itself is the queue.
  - `@swipeline/sinks`: `webhookSink` with HMAC-SHA256 signatures, a replay window and a stable delivery id, plus `verifyWebhookSignature`, `jsonlFileSink` and `consoleSink`.
  - `@swipeline/cli`: `serve --db` persists the log in SQLite, and `export`, `import`, `doctor` and `bench` are new. `bench --gate` exits 3 on a ranking regression.

### Patch Changes

- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
- Updated dependencies [22f64cc]
- Updated dependencies [0b76495]
- Updated dependencies [dfab5fa]
- Updated dependencies [6f80074]
- Updated dependencies [04c638f]
- Updated dependencies [5342b8a]
- Updated dependencies [ddbb83c]
- Updated dependencies [309801d]
- Updated dependencies [34e8d5d]
  - @swipeline/adapter-http-json@0.3.0
  - @swipeline/core@0.3.0
  - @swipeline/server@0.3.0
  - @swipeline/store-sqlite@0.3.0
  - @swipeline/bench@0.3.0
