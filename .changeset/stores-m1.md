---
"@swipeline/store-memory": minor
"@swipeline/store-indexeddb": minor
---

Add `@swipeline/store-memory` and `@swipeline/store-indexeddb`, both implementing `EventStore`, `ItemStore` and `ProfileStore`. The shared `describeStoreConformance` suite (exported from the memory package) runs against both, and the IndexedDB schema upgrade from v1 to v2 is tested.
