# @swipeline/adapter-http-json

## 0.4.1

### Patch Changes

- @swipeline/core@0.4.1

## 0.4.0

### Patch Changes

- @swipeline/core@0.4.0

## 0.3.0

### Minor Changes

- 22f64cc: Add `@swipeline/adapter-http-json` (declarative field mapping, page/offset/cursor/none pagination, `Retry-After` backoff, abort support, dropped-row stats) and `@swipeline/adapter-testkit`, the conformance suite every adapter runs.
- 04c638f: Finish the M3 surface: deck manifests, the CLI playground and the remaining server routes.
  
  - `@swipeline/core`: `deckManifestSchema`, `parseDeckManifest` and `defineDeck`. A manifest is strict JSON — unknown keys are errors — and carries `id`, `actor`, `source`, `actions`, `prefetch`, `undoDepth` and `template`.
  - `@swipeline/adapter-http-json`: `httpJson` and `httpJsonSourceConfig`, so a manifest's `source` block becomes an adapter without code; `pagination.type` is accepted as an alias for `mode`.
  - `@swipeline/server`: `GET /deck/:id/next` ranks the item store through `defaultPipeline` and skips already-swiped cards, `GET /collections/:id` serves `later` with undo accounted for, and `GET /openapi.json` documents the implemented routes.
  - `@swipeline/cli`: `init` writes a validated manifest and detects the framework, `source add` fetches a sample, infers a field map and previews the cards, and `dev` serves a playground on the real API routes with swipes stored in SQLite.
  - `create-swipeline`: scaffolds `blank`, `books`, `papers`, `recipes` and `products`; `quickstart.yml` scaffolds and builds all five weekly.

### Patch Changes

- 6f80074: When a pending HTTP JSON request settles after cancellation, reject with `HttpJsonError('request aborted')` without retry backoff. Discard responses and parsed bodies that arrive after cancellation.
- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
- Updated dependencies [0b76495]
- Updated dependencies [dfab5fa]
- Updated dependencies [04c638f]
- Updated dependencies [309801d]
  - @swipeline/core@0.3.0
