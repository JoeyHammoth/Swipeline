import { describe, expect, it, vi } from 'vitest'
import {
  memoryVectorIndex,
  normalizeVector,
  type SqliteVecDriver,
  type SqliteVecRow,
  sqliteVecIndex,
  VectorDimensionError,
} from '../src/index.js'

describe('memoryVectorIndex', () => {
  it('orders by cosine similarity and ties by id', async () => {
    const index = memoryVectorIndex({ dimensions: 3 })
    await index.upsert([
      { id: 'b', vector: [1, 0, 0] },
      { id: 'a', vector: [1, 0, 0] },
      { id: 'c', vector: [0, 1, 0] },
    ])
    const matches = await index.search([1, 0, 0], 3)
    expect(matches.map((match) => match.id)).toEqual(['a', 'b', 'c'])
    expect(matches[0]?.score).toBeCloseTo(1)
    expect(matches[2]?.score).toBeCloseTo(0)
  })

  it('replaces an entry by id and removes it', async () => {
    const index = memoryVectorIndex()
    await index.upsert([{ id: 'a', vector: [1, 0] }])
    expect(index.dimensions).toBe(2)
    await index.upsert([{ id: 'a', vector: [0, 1] }])
    expect(index.size).toBe(1)
    expect((await index.search([0, 1], 1))[0]?.score).toBeCloseTo(1)
    await index.remove(['a'])
    expect(index.size).toBe(0)
    expect(await index.search([0, 1], 1)).toEqual([])
  })

  it('rejects dimension mismatches and non-finite values', async () => {
    const index = memoryVectorIndex({ dimensions: 2 })
    await expect(index.upsert([{ id: 'a', vector: [1, 2, 3] }])).rejects.toBeInstanceOf(
      VectorDimensionError,
    )
    await expect(index.upsert([{ id: 'b', vector: [1, Number.NaN] }])).rejects.toThrow(TypeError)
  })

  it('normalizes without mutating the input', () => {
    const input = [3, 4]
    const vector = normalizeVector(input)
    expect(Array.from(vector)).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)])
    expect(input).toEqual([3, 4])
  })
})

function fakeDriver(): SqliteVecDriver & { rows: Map<string, number[]> } {
  const rows = new Map<string, number[]>()
  return {
    rows,
    ensureTable: vi.fn(),
    upsert: vi.fn((_table: string, entries: readonly SqliteVecRow[]) => {
      for (const entry of entries) rows.set(entry.id, entry.vector)
    }),
    remove: vi.fn((_table: string, ids: readonly string[]) => {
      for (const id of ids) rows.delete(id)
    }),
    search: vi.fn(async (_table: string, vector: readonly number[], k: number) => {
      const query = Array.from(normalizeVector(vector))
      return [...rows.entries()]
        .map(([id, stored]) => ({
          id,
          distance: 1 - query.reduce((sum, value, index) => sum + value * (stored[index] ?? 0), 0),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, k)
    }),
  }
}

describe('sqliteVecIndex', () => {
  it('matches the memory index for the same vectors', async () => {
    const driver = fakeDriver()
    const index = sqliteVecIndex({ driver, dimensions: 2 })
    await index.upsert([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0.8, 0.2] },
      { id: 'c', vector: [0, 1] },
    ])
    const sqlite = await index.search([1, 0], 3)

    const memory = memoryVectorIndex({ dimensions: 2 })
    await memory.upsert([
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0.8, 0.2] },
      { id: 'c', vector: [0, 1] },
    ])
    const exact = await memory.search([1, 0], 3)

    expect(sqlite.map((match) => match.id)).toEqual(exact.map((match) => match.id))
    expect(sqlite.map((match) => match.score)).toEqual(
      exact.map((match) => expect.closeTo(match.score)),
    )
    expect(driver.ensureTable).toHaveBeenCalledOnce()
  })

  it('creates the table once and tracks size', async () => {
    const driver = fakeDriver()
    const index = sqliteVecIndex({ driver, dimensions: 2 })
    await index.upsert([{ id: 'a', vector: [1, 0] }])
    await index.search([1, 0], 1)
    expect(driver.ensureTable).toHaveBeenCalledOnce()
    expect(index.size).toBe(1)
    await index.clear()
    expect(driver.rows.size).toBe(0)
    expect(index.size).toBe(0)
  })
})
