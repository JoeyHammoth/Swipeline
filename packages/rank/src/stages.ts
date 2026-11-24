import type { Card, TagPosterior } from '@swipeline/core'
import { cardTokens, cosineSimilarity, hashedFeatures } from './hash.js'
import { sampleBeta } from './rng.js'
import { addReason, type Candidate, mapCandidates, pipeline, type RankStage } from './types.js'

function tagMean(stats: TagPosterior | undefined): number {
  if (!stats) return 0
  const total = stats.a + stats.b
  return total === 0 ? 0 : (stats.a - stats.b) / total
}

/** Removes cards already in the actor's history. */
export function seenFilter(): RankStage {
  return {
    name: 'seenFilter',
    run(ctx) {
      const seen = ctx.seen
      if (!seen || seen.size === 0) return ctx
      return {
        ...ctx,
        candidates: ctx.candidates.filter((candidate) => !seen.has(candidate.card.id)),
      }
    },
  }
}

export interface HardFilterOptions {
  /** Keep cards carrying at least one of these tags. */
  tags?: readonly string[]
  sourceIds?: readonly string[]
  excludeTags?: readonly string[]
}

/** Non-negotiable filters. They run before any scoring so scores never resurrect a card. */
export function hardFilters(options: HardFilterOptions = {}): RankStage {
  return {
    name: 'hardFilters',
    run(ctx) {
      const filters = ctx.filters ?? {}
      const tags = (options.tags ?? filters.tags ?? []) as readonly string[]
      const sourceIds = (options.sourceIds ?? filters.sourceIds ?? []) as readonly string[]
      const excludeTags = (options.excludeTags ?? filters.excludeTags ?? []) as readonly string[]
      return {
        ...ctx,
        candidates: ctx.candidates.filter(({ card }) => {
          const cardTags = card.tags ?? []
          if (sourceIds.length > 0 && !sourceIds.includes(card.sourceId)) return false
          if (tags.length > 0 && !tags.some((tag) => cardTags.includes(tag))) return false
          if (excludeTags.length > 0 && excludeTags.some((tag) => cardTags.includes(tag)))
            return false
          return true
        }),
      }
    },
  }
}

export interface PopularityOptions {
  /** Weight of the popularity term. Defaults to 0.3. */
  weight?: number
  /** Days after which recency contributes half. Defaults to 30. */
  halfLifeDays?: number
}

function popularityOf(card: Card): number {
  const value = card.extra?.popularity
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/** Popularity plus an exponential recency decay on `fetchedAt`. */
export function popularityRecency(options: PopularityOptions = {}): RankStage {
  const weight = options.weight ?? 0.3
  const halfLife = (options.halfLifeDays ?? 30) * 24 * 60 * 60 * 1000
  return {
    name: 'popularityRecency',
    run(ctx) {
      const now = ctx.now ?? Date.now()
      return mapCandidates(ctx, (candidate) => {
        const fetched = Date.parse(candidate.card.fetchedAt)
        const age = Number.isFinite(fetched) ? Math.max(0, now - fetched) : 0
        const recency = age === 0 ? 1 : 0.5 ** (age / halfLife)
        return {
          ...candidate,
          score: candidate.score + weight * (0.7 * popularityOf(candidate.card) + 0.3 * recency),
        }
      })
    },
  }
}

/** Beta-posterior mean per tag, the same statistics `rebuildProfile` derives. */
export function tagAffinity(weight = 1): RankStage {
  return {
    name: 'tagAffinity',
    run(ctx) {
      return mapCandidates(ctx, (candidate) => {
        const tags = candidate.card.tags ?? []
        if (tags.length === 0) return candidate
        let affinity = 0
        const reasons: string[] = []
        for (const tag of tags) {
          const mean = tagMean(ctx.profile.tagStats[tag.toLowerCase()])
          affinity += mean
          if (Math.abs(mean) >= 0.2) reasons.push(`${tag} ${mean > 0 ? '+' : ''}${mean.toFixed(2)}`)
        }
        const next: Candidate = {
          ...candidate,
          score: candidate.score + weight * (affinity / tags.length),
        }
        if (reasons.length > 0) next.reasons = [...(candidate.reasons ?? []), ...reasons]
        return next
      })
    },
  }
}

/** Cosine similarity against `profile.prefVector` over hashed card features. */
export function prefVector(weight = 1, dimensions?: number): RankStage {
  return {
    name: 'prefVector',
    run(ctx) {
      const stored = ctx.profile.prefVector
      if (!stored || stored.length === 0) return ctx
      const expected = dimensions ?? stored.length
      if (stored.length !== expected) return ctx
      return mapCandidates(ctx, (candidate) => {
        const similarity = cosineSimilarity(
          hashedFeatures(cardTokens(candidate.card), expected),
          stored,
        )
        return {
          ...candidate,
          score: candidate.score + weight * similarity,
          reasons: [...(candidate.reasons ?? []), `profile match ${similarity.toFixed(2)}`],
        }
      })
    },
  }
}

/** Exploration: a small random jitter so the top of the deck is not frozen. */
export function epsilonRandom(epsilon = 0.05, scale = 0.5): RankStage {
  return {
    name: 'epsilonRandom',
    run(ctx) {
      return mapCandidates(ctx, (candidate) =>
        ctx.rng() < epsilon
          ? {
              ...candidate,
              score: candidate.score + ctx.rng() * scale,
              reasons: [...(candidate.reasons ?? []), 'exploration'],
            }
          : candidate,
      )
    },
  }
}

function jaccard(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  const a = new Set(left)
  const b = new Set(right)
  let intersection = 0
  for (const value of a) if (b.has(value)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

/** Maximal marginal relevance: relevance vs. similarity to what is already picked. */
export function mmr(lambda = 0.8): RankStage {
  return {
    name: 'mmr',
    run(ctx) {
      const remaining = [...ctx.candidates].sort((a, b) => b.score - a.score)
      const picked: Candidate[] = []
      while (remaining.length > 0 && picked.length < ctx.limit) {
        let bestIndex = 0
        let bestValue = Number.NEGATIVE_INFINITY
        for (const [index, candidate] of remaining.entries()) {
          let similarity = 0
          for (const chosen of picked) {
            similarity = Math.max(
              similarity,
              jaccard(candidate.card.tags ?? [], chosen.card.tags ?? []),
            )
          }
          const value = lambda * candidate.score - (1 - lambda) * similarity
          if (value > bestValue) {
            bestValue = value
            bestIndex = index
          }
        }
        const [next] = remaining.splice(bestIndex, 1)
        if (next) picked.push(next)
      }
      return { ...ctx, candidates: picked }
    },
  }
}

/** Thompson sampling over the tag posteriors; deterministic when `ctx.rng` is seeded. */
export function thompson(weight = 0.5): RankStage {
  return {
    name: 'thompson',
    run(ctx) {
      return mapCandidates(ctx, (candidate) => {
        const tags = candidate.card.tags ?? []
        if (tags.length === 0) return candidate
        let sampled = 0
        for (const tag of tags) {
          const stats = ctx.profile.tagStats[tag.toLowerCase()] ?? { a: 0, b: 0 }
          sampled += sampleBeta(stats.a + 1, stats.b + 1, ctx.rng)
        }
        return {
          ...candidate,
          score: candidate.score + weight * (sampled / tags.length),
          reasons: [...(candidate.reasons ?? []), 'sampled'],
        }
      })
    },
  }
}

/** Sorts, truncates to `limit` and attaches a score reason to every card. */
export function explain(): RankStage {
  return {
    name: 'explain',
    run(ctx) {
      const sorted = [...ctx.candidates]
        .sort((a, b) => b.score - a.score || (a.card.id < b.card.id ? -1 : 1))
        .slice(0, ctx.limit)
        .map((candidate) => addReason(candidate, `score ${candidate.score.toFixed(2)}`))
      return { ...ctx, candidates: sorted }
    },
  }
}

/** The documented baseline pipeline, in the order the design plan gives. */
export function defaultPipeline(): RankStage {
  return pipeline(
    seenFilter(),
    hardFilters(),
    popularityRecency(),
    tagAffinity(),
    prefVector(),
    epsilonRandom(),
    thompson(),
    mmr(),
    explain(),
  )
}
