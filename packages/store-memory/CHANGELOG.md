# @swipeline/store-memory

## 0.3.0

### Minor Changes

- 0b1e746: Add `@swipeline/store-memory` and `@swipeline/store-indexeddb`, both implementing `EventStore`, `ItemStore` and `ProfileStore`. The shared `describeStoreConformance` suite (exported from the memory package) runs against both, and the IndexedDB schema upgrade from v1 to v2 is tested.

### Patch Changes

- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
- Updated dependencies [0b76495]
- Updated dependencies [dfab5fa]
- Updated dependencies [04c638f]
- Updated dependencies [309801d]
  - @swipeline/core@0.3.0
