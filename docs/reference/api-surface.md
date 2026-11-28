# API surface and promises

Every symbol in [the API reference](/reference/api) carries one of three
promises. The levels are decided in [ADR-0015](/adr/0015-public-api-freeze);
this page is the current classification, and the review that produced it.

| Level | Promise |
|---|---|
| **Contract** | Named in [the contracts](/architecture/contracts) or taught by a guide as how to use the package. Covered by the deprecation policy from 1.0; a change needs an RFC and a `breaking` label. |
| **Supported** | Types, option objects, errors and helpers that make a contract usable. Same stability; a change needs a changeset and, if it breaks compatibility, a `breaking` label — not an RFC. |
| **Internal** | Exported for tests, fixtures, the CLI's dispatcher or the scaffolder's data. May change in any release without notice. Not taught anywhere. |
| **Decision** | Fits none of the above, or a consumer would plausibly reach for it. Listed under [Decisions](#decisions); it stays unresolved until one is recorded. |

## How a symbol gets classified

1. Named in [the contracts](/architecture/contracts): **contract**.
2. Taught by a quickstart, guide or package README as the way to use the
   package: **contract** for the entry point, **supported** for the types and
   helpers that make it usable.
3. A parameter, return type or thrown error of a contract or supported symbol:
   **supported**.
4. Reachable only from tests, fixtures, the CLI's own dispatcher, the benchmark
   harness or the scaffolder's data: **internal**.
5. Anything else: **decision**, with a line saying what has to be decided.

A new export is classified in the same pull request that adds it. Adding one is
not a breaking change, but leaving it unclassified is what this page exists to
prevent.

## Classification

Thirty packages, 262 exports. Each row gives the default level for the package and
the symbols that differ from it.

| Package | Default | Exceptions |
|---|---|---|
| `@swipeline/core` | contract | `Engine`, `MemoryEventStore`, `createUlid`, `isUlid`, `ULID_PATTERN`, `compareEvents`, `RebuildProfileOptions`: supported |
| `@swipeline/gestures` | supported | `computeSwipeIntent`, `createGestureController`, `actionButtons`: contract |
| `@swipeline/rank` | supported | `RankStage`, `RankContext`, `Candidate`, `pipeline`, `defaultPipeline`, `explain`, `hardFilters`, `seenFilter`, `popularityRecency`, `tagAffinity`, `prefVector`, `epsilonRandom`, `mmr`, `thompson`: contract |
| `@swipeline/theme` | supported | `TOKEN_NAMES`, `TokenName`, `Theme`, `lightTheme`, `darkTheme`, `mergeTheme`, `themeCss`: contract |
| `@swipeline/vector` | supported | `VectorIndex`, `VectorEntry`, `VectorMatch`, `SqliteVecDriver`, `memoryVectorIndex`, `sqliteVecIndex`: contract |
| `@swipeline/i18n` | supported | `createTranslator`, `en`, `Messages`, `Translator`: contract |
| `@swipeline/cards` | supported | `CARD_TEMPLATES`, `CardTemplate`, `cardView`: contract |
| `@swipeline/embed` | supported | `Embedder`, `openAiCompatibleEmbedder`, `transformersEmbedder`: contract |
| `@swipeline/sinks` | supported | `consoleSink`, `jsonlFileSink`, `webhookSink`, `verifyWebhookSignature`: contract |
| `@swipeline/server` | contract | `RunningServer`: supported |
| `@swipeline/store-remote` | supported | `createOutbox`, `httpEventStore`, `CursorStore`, `Outbox`: contract |
| `@swipeline/store-memory` | supported | `createMemoryStores`: contract |
| `@swipeline/store-sqlite` | supported | `createSqliteStores`: contract |
| `@swipeline/store-indexeddb` | supported | `createIndexedDbStores`: contract; `compareEvents`: internal (see [Decisions](#decisions)) |
| `@swipeline/store-postgres` | supported | `createPostgresStores`, `PostgresClient`: contract |
| `@swipeline/adapter-http-json` | supported | `createHttpJsonAdapter`, `httpJson`: contract |
| `@swipeline/adapter-openlibrary` | supported | `createOpenLibraryAdapter`: contract |
| `@swipeline/adapter-themealdb` | supported | `createTheMealDbAdapter`: contract |
| `@swipeline/adapter-tmdb` | supported | `createTmdbAdapter`: contract |
| `@swipeline/adapter-arxiv` | supported | `createArxivAdapter`: contract; `parseArxivFeed`: internal |
| `@swipeline/adapter-testkit` | supported | `assertAdapterConformance`: contract |
| `@swipeline/binding-testkit` | supported | `assertBindingConformance`, `BindingFixture`, `BindingHandle`: contract |
| `@swipeline/react` | contract | — |
| `@swipeline/react-native` | supported | `SwipeDeck`, `SwipeDeckProps`, `useDeck`: contract |
| `@swipeline/element` | contract | — |
| `@swipeline/vue` | contract | — |
| `@swipeline/svelte` | contract | — |
| `@swipeline/bench` | supported | — |
| `@swipeline/cli` | internal | — |
| `create-swipeline` | supported | `TEMPLATES`: internal |

## What the review changed

- **The generated reference was incomplete.** `pnpm api:docs` missed every
  `export async function` — so the IndexedDB and Postgres store factories,
  `runBenchmark`, `scaffold`, the CLI's `run` and `validateHistoryFile` were real
  exports nobody could look up — and it could not see the Svelte component,
  which is a compiled default export. It also documented `deck` for
  `create-swipeline`, a symbol that exists only inside a template literal in that
  package's source. All three are fixed in `scripts/api-reference.mjs`, and the
  reference gained eight symbols while losing the phantom one.
- **The classification itself.** This page is the result: 262 exports, one level
  each, with the 77 that are not the package default listed above.

## Decisions

Each of these is a real choice rather than a default, and remains open:

- **`@swipeline/cli` is a program, not a library.** All ten exports are internal:
  a consumer embedding the server should use `@swipeline/server`, and the CLI's
  `run`, `CliDeps`, `parseServeOptions` and `USAGE` exist so the command can be
  tested. If programmatic use should be supported, it needs a documented entry
  point instead of the internals.
- **`compareEvents` is re-exported from `@swipeline/store-indexeddb`.** It is a
  `@swipeline/core` helper with nothing to do with IndexedDB; either justify the
  convenience or drop it in the next minor.
- **`@swipeline/bench` exports only types plus `runBenchmark`.** The benchmark is
  documented as a CI gate and a CLI command; whether an app should call
  `runBenchmark` is undecided.
- **`parseArxivFeed` is documented as "exported for fixture tests".** It is the
  clearest internal leak in a first-party adapter: keep it and call it internal,
  or move it behind a test-only entry point.
- **`@swipeline/core`'s ULID helpers.** `createUlid`, `isUlid`, `ULID_PATTERN`
  and `compareEvents` are useful to anyone writing a store, and supported for
  that reason — they are not part of the `DeckStore` contract.

## Freeze status

Not frozen yet. The classification exists and the generator is correct; the five
decisions above and the maintainer's sign-off on this table are what remain. Until
then the roadmap's M5 "API review and freeze" line stays open.
