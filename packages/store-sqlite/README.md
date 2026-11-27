# @swipeline/store-sqlite

The same `EventStore`, `ItemStore` and `ProfileStore` contracts as
`@swipeline/store-memory`, persisted in one SQLite file. Built on Node's
`node:sqlite`, so there is no native build step and no bundled database engine:
Node 24 or newer is the only requirement.

```ts
import { createSqliteStores } from '@swipeline/store-sqlite'

const stores = createSqliteStores({ path: './swipes.db' })
const server = createServer({ events: stores.events })
// ... on shutdown
stores.close()
```

Pass `path: ':memory:'` for a throwaway database with the same SQL semantics as
the file-backed one, which is useful in tests.

## Semantics

`append` is idempotent by event id and transactional per call, `query` returns
events in ULID order, and every filter combines with `AND`. `erase` removes an
actor's events and its derived profiles in one transaction, so a delete request
cannot leave orphaned state behind.

`ts` is stored as text and compared lexicographically. That matches the memory
store exactly and is correct for the ISO 8601 UTC timestamps the `SwipeEvent`
schema produces.

The schema version is recorded in `pragma user_version`; it is `1` today and the
stores refuse nothing — a future migration will read it before altering tables.

The full `@swipeline/store-memory/conformance` suite runs against this package,
so its behaviour tracks the reference implementation rather than drifting.

Apache-2.0.
