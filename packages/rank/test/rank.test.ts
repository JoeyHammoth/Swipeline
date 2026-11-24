import type { Card, Profile } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import {
  cardTokens,
  cosineSimilarity,
  defaultPipeline,
  epsilonRandom,
  explain,
  hardFilters,
  hashedFeatures,
  mmr,
  mulberry32,
  prefVector,
  type RankContext,
  seenFilter,
  tagAffinity,
  thompson,
} from '../src/index.js'

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()

function card(index: number, tags: string[], extra: Record<string, unknown> = {}): Card {
  return {
    schemaVersion: 1,
    id: `demo:${index}`,
    sourceId: 'demo',
    title: `Card ${index}`,
    tags,
    fetchedAt: ISO,
    extra,
  }
}

function profile(tagStats: Profile['tagStats'], prefVector?: number[]): Profile {
  const base: Profile = {
    actor: 'actor-1',
    deckId: 'books',
    tagStats,
    counts: { seen: 0, liked: 0, disliked: 0 },
    updatedAt: ISO,
  }
  if (prefVector) base.prefVector = prefVector
  return base
}

function setScores(ctx: RankContext, scores: readonly number[]): void {
  for (const [index, score] of scores.entries()) {
    const candidate = ctx.candidates[index]
    if (candidate) candidate.score = score
  }
}

function context(candidates: Card[], overrides: Partial<RankContext> = {}): RankContext {
  return {
    actor: 'actor-1',
    deckId: 'books',
    candidates: candidates.map((entry) => ({ card: entry, score: 0 })),
    profile: profile({}),
    limit: 10,
    rng: mulberry32(7),
    ...overrides,
  }
}

describe('basic stages', () => {
  it('drops seen cards', async () => {
    const result = await seenFilter().run(
      context([card(1, []), card(2, [])], { seen: new Set(['demo:1']) }),
    )
    expect(result.candidates.map((candidate) => candidate.card.id)).toEqual(['demo:2'])
  })

  it('applies hard filters from options or context', async () => {
    const candidates = [card(1, ['space']), card(2, ['crime']), card(3, ['space', 'crime'])]
    const byTags = await hardFilters({ tags: ['space'] }).run(context(candidates))
    expect(byTags.candidates.map((candidate) => candidate.card.id)).toEqual(['demo:1', 'demo:3'])
    const excluded = await hardFilters({ excludeTags: ['crime'] }).run(context(candidates))
    expect(excluded.candidates.map((candidate) => candidate.card.id)).toEqual(['demo:1'])
    const fromContext = await hardFilters().run(
      context(candidates, { filters: { sourceIds: ['other'] } }),
    )
    expect(fromContext.candidates).toEqual([])
  })

  it('scores positive tag posteriors higher', async () => {
    const ctx = context([card(1, ['space']), card(2, ['crime'])], {
      profile: profile({ space: { a: 4, b: 1 }, crime: { a: 0, b: 3 } }),
    })
    const result = await tagAffinity().run(ctx)
    const [first, second] = result.candidates
    expect(first?.score).toBeGreaterThan(second?.score ?? 0)
    expect(first?.reasons?.[0]).toContain('space')
  })

  it('uses a stored preference vector when it is present', async () => {
    const tokens = cardTokens(card(1, ['space']))
    const vector = [...hashedFeatures(tokens)]
    const ctx = context([card(1, ['space']), card(2, ['crime'])], {
      profile: profile({}, vector),
    })
    const result = await prefVector().run(ctx)
    expect(result.candidates[0]?.score).toBeGreaterThan(result.candidates[1]?.score ?? 0)
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1)
  })

  it('is deterministic for a seeded rng', async () => {
    const ctx = context([card(1, ['a']), card(2, ['b']), card(3, ['c'])])
    const first = await epsilonRandom(1, 1).run({ ...ctx, rng: mulberry32(3) })
    const second = await epsilonRandom(1, 1).run({ ...ctx, rng: mulberry32(3) })
    expect(first.candidates.map((c) => c.score)).toEqual(second.candidates.map((c) => c.score))
  })

  it('limits and explains the final list', async () => {
    const ctx = context([card(1, []), card(2, []), card(3, [])], { limit: 2 })
    setScores(ctx, [0.1, 0.9])
    const result = await explain().run(ctx)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]?.card.id).toBe('demo:2')
    expect(result.candidates[0]?.reasons).toContain('score 0.90')
  })

  it('mmr prefers a diverse second card over a near-duplicate', async () => {
    const ctx = context([card(1, ['space']), card(2, ['space']), card(3, ['crime'])], { limit: 2 })
    setScores(ctx, [1, 0.99, 0.9])
    const result = await mmr(0.5).run(ctx)
    expect(result.candidates.map((candidate) => candidate.card.id)).toEqual(['demo:1', 'demo:3'])
  })
})

describe('default pipeline', () => {
  it('produces a ranked, limited, explained deck without new cards', async () => {
    const ctx = context([card(1, ['space']), card(2, ['crime']), card(3, ['space'])], {
      profile: profile({ space: { a: 5, b: 0 }, crime: { a: 0, b: 5 } }),
      limit: 2,
    })
    const result = await defaultPipeline().run(ctx)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]?.card.id).toBe('demo:1')
    for (const candidate of result.candidates) {
      expect(candidate.reasons?.at(-1)).toMatch(/^score /)
    }
  })

  it('respects seen even when the seen card would score best', async () => {
    const ctx = context([card(1, ['space']), card(2, ['crime'])], {
      seen: new Set(['demo:1']),
      profile: profile({ space: { a: 9, b: 0 }, crime: { a: 0, b: 9 } }),
    })
    const result = await defaultPipeline().run(ctx)
    expect(result.candidates.map((candidate) => candidate.card.id)).toEqual(['demo:2'])
  })

  it('thompson is reproducible from the same seed', async () => {
    const ctx = context([card(1, ['space']), card(2, ['space'])], {
      profile: profile({ space: { a: 2, b: 1 } }),
    })
    const a = await thompson(1).run({ ...ctx, rng: mulberry32(11) })
    const b = await thompson(1).run({ ...ctx, rng: mulberry32(11) })
    expect(a.candidates.map((c) => c.score)).toEqual(b.candidates.map((c) => c.score))
  })
})
