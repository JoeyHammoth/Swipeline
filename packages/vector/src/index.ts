export interface VectorEntry {
  id: string
  vector: ArrayLike<number>
}

export interface VectorMatch {
  id: string
  /** Cosine similarity in [-1, 1]; higher is closer. */
  score: number
}

/**
 * The index contract. Implementations may be exact (brute force) or backed by a
 * database extension; callers see the same ordering for the same input.
 */
export interface VectorIndex {
  readonly dimensions: number | undefined
  readonly size: number
  upsert(entries: readonly VectorEntry[]): Promise<void>
  remove(ids: readonly string[]): Promise<void>
  search(vector: ArrayLike<number>, k: number): Promise<VectorMatch[]>
  clear(): Promise<void>
}

export class VectorDimensionError extends Error {
  constructor(expected: number, actual: number) {
    super(`vector has ${actual} dimensions, index expects ${expected}`)
    this.name = 'VectorDimensionError'
  }
}

function normalized(vector: ArrayLike<number>, expected?: number): Float32Array {
  if (vector.length === 0) throw new VectorDimensionError(expected ?? 0, 0)
  if (expected !== undefined && vector.length !== expected) {
    throw new VectorDimensionError(expected, vector.length)
  }
  const result = new Float32Array(vector.length)
  let norm = 0
  for (const [index, value] of Array.from(vector).entries()) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('vectors must contain finite numbers')
    }
    result[index] = value
    norm += value * value
  }
  norm = Math.sqrt(norm)
  if (norm === 0) return result
  for (let index = 0; index < result.length; index += 1) {
    result[index] = (result[index] ?? 0) / norm
  }
  return result
}

function dot(left: Float32Array, right: Float32Array): number {
  let sum = 0
  for (let index = 0; index < left.length; index += 1) {
    sum += (left[index] ?? 0) * (right[index] ?? 0)
  }
  return sum
}

export interface MemoryVectorIndexOptions {
  /** Fixed when you want a mismatched vector to fail at insert time. */
  dimensions?: number
}

/**
 * Exact cosine search over a Map. For a per-user pool of a few thousand cards
 * this is fast, dependency-free and runs in the browser.
 */
export function memoryVectorIndex(options: MemoryVectorIndexOptions = {}): VectorIndex {
  let dimensions = options.dimensions
  const vectors = new Map<string, Float32Array>()

  return {
    get dimensions() {
      return dimensions
    },
    get size() {
      return vectors.size
    },
    async upsert(entries) {
      for (const entry of entries) {
        if (!entry.id) throw new TypeError('vector entries need an id')
        const vector = normalized(entry.vector, dimensions)
        dimensions ??= vector.length
        vectors.set(entry.id, vector)
      }
    },
    async remove(ids) {
      for (const id of ids) vectors.delete(id)
    },
    async search(vector, k) {
      if (k <= 0) return []
      if (dimensions === undefined) return []
      const query = normalized(vector, dimensions)
      const matches: VectorMatch[] = []
      for (const [id, stored] of vectors) {
        matches.push({ id, score: dot(query, stored) })
      }
      matches.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
      return matches.slice(0, k)
    },
    async clear() {
      vectors.clear()
    },
  }
}

export interface SqliteVecRow {
  id: string
  vector: number[]
}

export interface SqliteVecSearchRow {
  id: string
  /** Cosine distance in [0, 2]. */
  distance: number
}

/**
 * The small surface a `sqlite-vec` binding must provide. Keeping it injected
 * means this package has no native dependency and the same index works with
 * `better-sqlite3`, `node:sqlite` or a browser SQLite build.
 */
export interface SqliteVecDriver {
  ensureTable(options: { table: string; dimensions: number }): void | Promise<void>
  upsert(table: string, rows: readonly SqliteVecRow[]): void | Promise<void>
  remove(table: string, ids: readonly string[]): void | Promise<void>
  search(
    table: string,
    vector: readonly number[],
    k: number,
  ): Promise<readonly SqliteVecSearchRow[]>
}

export interface SqliteVecIndexOptions {
  driver: SqliteVecDriver
  table?: string
  dimensions: number
}

/**
 * Adapter over a SQLite vector extension. The driver owns persistence and the
 * extension; this class keeps ids for `size` and normalizes the distance into
 * the same score the in-memory index returns.
 */
export function sqliteVecIndex(options: SqliteVecIndexOptions): VectorIndex {
  const { driver, dimensions } = options
  const table = options.table ?? 'swipeline_vectors'
  const ids = new Set<string>()
  let ready: Promise<void> | undefined

  function ensure(): Promise<void> {
    ready ??= Promise.resolve(driver.ensureTable({ table, dimensions }))
    return ready
  }

  return {
    dimensions,
    get size() {
      return ids.size
    },
    async upsert(entries) {
      await ensure()
      const rows: SqliteVecRow[] = []
      for (const entry of entries) {
        const vector = normalized(entry.vector, dimensions)
        if (!entry.id) throw new TypeError('vector entries need an id')
        rows.push({ id: entry.id, vector: Array.from(vector) })
        ids.add(entry.id)
      }
      await driver.upsert(table, rows)
    },
    async remove(removeIds) {
      await ensure()
      await driver.remove(table, removeIds)
      for (const id of removeIds) ids.delete(id)
    },
    async search(vector, k) {
      await ensure()
      if (k <= 0) return []
      const query = normalized(vector, dimensions)
      const rows = await driver.search(table, Array.from(query), k)
      return rows
        .map((row) => ({ id: row.id, score: 1 - row.distance }))
        .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
        .slice(0, k)
    },
    async clear() {
      await ensure()
      const all = [...ids]
      if (all.length > 0) await driver.remove(table, all)
      ids.clear()
    },
  }
}

export { normalized as normalizeVector }
