# @swipeline/vector

One interface, two implementations: exact in-memory cosine and an adapter over a
SQLite vector extension.

```ts
import { memoryVectorIndex, sqliteVecIndex } from '@swipeline/vector'

const index = memoryVectorIndex({ dimensions: 384 })
await index.upsert([{ id: 'card-1', vector }])
const matches = await index.search(query, 20)
```

Vectors are L2-normalized on insert, so scores are cosine similarity. A
dimension mismatch throws `VectorDimensionError` instead of silently comparing
unrelated spaces.

`sqliteVecIndex` takes a small `SqliteVecDriver` instead of a native dependency.
The driver supplies `ensureTable`, `upsert`, `remove` and `search` over
`sqlite-vec`; the index normalizes input and converts cosine distance to the same
score the in-memory index returns. The test suite asserts both orderings agree.
