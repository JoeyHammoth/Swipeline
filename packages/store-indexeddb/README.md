# @swipeline/store-indexeddb

IndexedDB implementations of `EventStore`, `ItemStore` and `ProfileStore` for
the browser. Same contracts, same conformance suite as
`@swipeline/store-memory`.

```ts
import { createIndexedDbStores } from '@swipeline/store-indexeddb'

const stores = await createIndexedDbStores({ name: 'swipeline' })
// stores.events, stores.items, stores.profiles
```

Schema v1 creates the three stores; v2 adds the `by_deck` event index and
upgrades existing databases in place without touching rows. `erase(actor)`
deletes that actor's events and derived profiles in one transaction, so a
delete request cannot leave stale state behind.

Apache-2.0.
