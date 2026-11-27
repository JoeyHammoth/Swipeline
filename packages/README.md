# Packages

One package per seam. A package may depend only on packages below it in this
list; see [`docs/architecture/overview.md`](../docs/architecture/overview.md).

| Package | Status | Purpose |
|---|---|---|
| `core` | M0 — schemas done, engine in M1 | Card/event/profile schemas, config, deck engine, outbox |
| `rank` | M1 | Rank stages, pipeline, default pipeline, tracing |
| `adapters` | M1 | `http-json` and `csv` generic adapters |
| `adapter-testkit` | M2 | Fixtures + conformance tests for adapter authors |
| `store-memory` | M1 | In-memory item/event/profile stores |
| `store-indexeddb` | M1 | IndexedDB stores for the web |
| `gestures` | M1 | Framework-free pointer, keyboard and reduced-motion controller |
| `element` | M2 | `<swipe-deck>` Web Component, the reference binding |
| `react` | M1 | React binding over `core` + `gestures` |
| `vue` | M4 | Vue 3 binding over `core` + `gestures` |
| `binding-testkit` | M2 | Conformance suite every binding must pass |
| `cards` | M4 | Built-in card templates: `text`, `media`, `facts` |
| `theme` | M4 | Design tokens, light and dark palettes, CSS output |
| `i18n` | M4 | Message catalog and translator for binding strings |
| `react-native` | M4 | React Native / Expo binding |
| `svelte` | M4 | Svelte 5 binding over `core` + `gestures` |
| `embed` | M2 | Transformers.js, OpenAI-compatible and Ollama embedders |
| `vector` | M2 | Brute-force exact index, `sqlite-vec` and `pgvector` drivers |
| `store-sqlite` | M3 | SQLite stores via `node:sqlite`, no native build |
| `store-postgres` | M3 | Postgres stores over any `pg`-compatible client |
| `store-remote` | M3 | HTTP event store and outbox sync against the server |
| `sinks` | M3 | HMAC-signed webhook, JSONL, console |
| `bench` | M2 | Synthetic-user benchmark harness |
| `server` | M3 | Optional Hono server: sync, ranking, webhooks |
| `cli` | M3 | `swipeline` command |
| `create-swipeline` | M3 | `npm create swipeline@latest` |

Packages are introduced when they have a working seam, tests and a README, not
as empty directories. The plan's advice is to start with fewer, larger packages
and split only for a real dependency-weight reason; `embed`, `vector` and the
server stores are the first candidates for merging into their consumers if they
stay thin.

Every package must pass:

- `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm publint`
- `pnpm check:boundaries` (no framework imports outside bindings)
- `pnpm licenses:check`
- a changeset for any user-facing change
