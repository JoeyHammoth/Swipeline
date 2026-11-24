# First-party adapters

Each directory here is a published `swipeline-adapter-<name>` package that maps
one source to `Card`s. The first set is arXiv, Open Library, TheMealDB and TMDB,
chosen because they have documented terms, stable endpoints and clear
attribution requirements.

Rules for anything in this directory:

- `fetch` respects rate limits, `Retry-After` and the abort signal.
- `normalize` returns `null` for records it cannot map, never throws for one bad
  row, and drops nothing silently without counting the drop.
- `attribution` is declared when the source requires credit.
- Fixtures are recorded, so tests never hit the network.
- The adapter passes `@swipeline/adapter-testkit` conformance.
- No scraping, no undocumented endpoints, no caching beyond what terms allow.

Community adapters live outside this repo and are listed in
[`registry/adapters.json`](../registry/adapters.json). Start one with the
template described in [`docs/guides/write-an-adapter.md`](../docs/guides/write-an-adapter.md).
