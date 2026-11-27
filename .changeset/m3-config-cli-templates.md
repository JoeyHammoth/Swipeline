---
"@swipeline/core": minor
"@swipeline/adapter-http-json": minor
"@swipeline/server": minor
"@swipeline/cli": minor
"create-swipeline": minor
---

Finish the M3 surface: deck manifests, the CLI playground and the remaining server routes.

- `@swipeline/core`: `deckManifestSchema`, `parseDeckManifest` and `defineDeck`. A manifest is strict JSON — unknown keys are errors — and carries `id`, `actor`, `source`, `actions`, `prefetch`, `undoDepth` and `template`.
- `@swipeline/adapter-http-json`: `httpJson` and `httpJsonSourceConfig`, so a manifest's `source` block becomes an adapter without code; `pagination.type` is accepted as an alias for `mode`.
- `@swipeline/server`: `GET /deck/:id/next` ranks the item store through `defaultPipeline` and skips already-swiped cards, `GET /collections/:id` serves `later` with undo accounted for, and `GET /openapi.json` documents the implemented routes.
- `@swipeline/cli`: `init` writes a validated manifest and detects the framework, `source add` fetches a sample, infers a field map and previews the cards, and `dev` serves a playground on the real API routes with swipes stored in SQLite.
- `create-swipeline`: scaffolds `blank`, `books`, `papers`, `recipes` and `products`; `quickstart.yml` scaffolds and builds all five weekly.
