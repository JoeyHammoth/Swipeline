# @swipeline/core

## 0.4.1

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

### Minor Changes

- dfab5fa: Add the headless deck engine: `createEngine` with the observable `DeckStore`
  contract, a prefetch buffer, an undo stack, consent and sink hooks, ULID
  generation, and the `SourceAdapter` and store interfaces it compiles against.
- 04c638f: Finish the M3 surface: deck manifests, the CLI playground and the remaining server routes.
  
  - `@swipeline/core`: `deckManifestSchema`, `parseDeckManifest` and `defineDeck`. A manifest is strict JSON — unknown keys are errors — and carries `id`, `actor`, `source`, `actions`, `prefetch`, `undoDepth` and `template`.
  - `@swipeline/adapter-http-json`: `httpJson` and `httpJsonSourceConfig`, so a manifest's `source` block becomes an adapter without code; `pagination.type` is accepted as an alias for `mode`.
  - `@swipeline/server`: `GET /deck/:id/next` ranks the item store through `defaultPipeline` and skips already-swiped cards, `GET /collections/:id` serves `later` with undo accounted for, and `GET /openapi.json` documents the implemented routes.
  - `@swipeline/cli`: `init` writes a validated manifest and detects the framework, `source add` fetches a sample, infers a field map and previews the cards, and `dev` serves a playground on the real API routes with swipes stored in SQLite.
  - `create-swipeline`: scaffolds `blank`, `books`, `papers`, `recipes` and `products`; `quickstart.yml` scaffolds and builds all five weekly.

### Patch Changes

- 0b76495: Fall back to `event.context.tags` in `rebuildProfile` when `tagsByCardId` is omitted or lacks an entry for the card, while keeping `tagsByCardId` precedence and ignoring malformed `context.tags` values.
- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
