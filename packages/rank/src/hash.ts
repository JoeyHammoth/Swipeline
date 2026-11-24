import type { Card } from '@swipeline/core'

export const DEFAULT_DIMENSIONS = 64

/** FNV-1a: stable across processes, which seeded benchmarks depend on. */
export function hashFeature(feature: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Signed hashing trick: one bucket per token, L2-normalized. */
export function hashedFeatures(
  tokens: readonly string[],
  dimensions: number = DEFAULT_DIMENSIONS,
): Float32Array {
  const vector = new Float32Array(dimensions)
  for (const token of tokens) {
    const normalized = token.trim().toLowerCase()
    if (!normalized) continue
    const hash = hashFeature(normalized)
    const bucket = hash % dimensions
    const sign = (hash & 0x80000000) === 0 ? 1 : -1
    vector[bucket] = (vector[bucket] ?? 0) + sign
  }
  let norm = 0
  for (const value of vector) norm += value * value
  norm = Math.sqrt(norm)
  if (norm === 0) return vector
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = (vector[index] ?? 0) / norm
  }
  return vector
}

export function cardTokens(card: Card): string[] {
  const words = `${card.title} ${card.subtitle ?? ''}`.toLowerCase().split(/\W+/)
  return [...(card.tags ?? []).map((tag) => tag.toLowerCase()), ...words.filter(Boolean)]
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] ?? 0
    const right = b[index] ?? 0
    dot += left * right
    normA += left * left
    normB += right * right
  }
  if (normA === 0 || normB === 0) return 0
  return dot / Math.sqrt(normA * normB)
}
