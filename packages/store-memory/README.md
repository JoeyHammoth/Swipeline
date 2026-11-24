# @swipeline/store-memory

In-memory implementations of `EventStore`, `ItemStore` and `ProfileStore` from
`@swipeline/core`. Fast enough for tests, SSR and small demos; nothing is
persisted.

```ts
import { createMemoryStores } from '@swipeline/store-memory'

const { events, items, profiles } = createMemoryStores()
```

`eventStore.append` is idempotent by event id and keeps ULID order; `erase`
also drops derived profiles for that actor so a delete request cannot leave
stale state behind.

## Conformance suite

`@swipeline/store-memory/conformance` exports `describeStoreConformance`, the
suite `@swipeline/store-indexeddb` also runs. Both implementations must pass the
same spec, which is what keeps the store seam honest.

Apache-2.0.
