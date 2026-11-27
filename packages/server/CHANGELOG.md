# @swipeline/server

## 0.4.0

### Patch Changes

- @swipeline/core@0.4.0
  - @swipeline/rank@0.4.0

## 0.3.0

### Minor Changes

- 04c638f: Finish the M3 surface: deck manifests, the CLI playground and the remaining server routes.
  
  - `@swipeline/core`: `deckManifestSchema`, `parseDeckManifest` and `defineDeck`. A manifest is strict JSON — unknown keys are errors — and carries `id`, `actor`, `source`, `actions`, `prefetch`, `undoDepth` and `template`.
  - `@swipeline/adapter-http-json`: `httpJson` and `httpJsonSourceConfig`, so a manifest's `source` block becomes an adapter without code; `pagination.type` is accepted as an alias for `mode`.
  - `@swipeline/server`: `GET /deck/:id/next` ranks the item store through `defaultPipeline` and skips already-swiped cards, `GET /collections/:id` serves `later` with undo accounted for, and `GET /openapi.json` documents the implemented routes.
  - `@swipeline/cli`: `init` writes a validated manifest and detects the framework, `source add` fetches a sample, infers a field map and previews the cards, and `dev` serves a playground on the real API routes with swipes stored in SQLite.
  - `create-swipeline`: scaffolds `blank`, `books`, `papers`, `recipes` and `products`; `quickstart.yml` scaffolds and builds all five weekly.
- 5342b8a: Start M3 with a working slice: `@swipeline/server` serves `/health`, validates and appends `POST /events` idempotently, exports a JSONL history, erases an actor, and supports an auth hook plus allow-listed CORS. `@swipeline/cli` ships the `swipeline` binary with `serve` and `validate`, and reports exit codes 0/1/2.

### Patch Changes

- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
- Updated dependencies [0b76495]
- Updated dependencies [dfab5fa]
- Updated dependencies [04c638f]
- Updated dependencies [309801d]
- Updated dependencies [34e8d5d]
  - @swipeline/core@0.3.0
  - @swipeline/rank@0.3.0
