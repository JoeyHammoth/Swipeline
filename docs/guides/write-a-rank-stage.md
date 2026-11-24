# Write a rank stage

A rank stage is a small function that filters, scores, reorders or annotates
candidates. This guide covers the contract, two worked examples and the tests a
review will ask for.

## The contract

```ts
import type { RankContext, RankStage } from '@swipeline/rank'

export const boostNew: RankStage = {
  name: 'boost-new',
  run(ctx) {
    const now = ctx.now ?? Date.now()
    const day = 24 * 60 * 60 * 1000

    const candidates = ctx.candidates.map((candidate) => {
      const age = now - Date.parse(candidate.card.fetchedAt)
      const freshness = Math.max(0, 1 - age / (30 * day))
      return {
        ...candidate,
        score: candidate.score + 0.2 * freshness,
        ...(freshness > 0.5 ? { reasons: [...(candidate.reasons ?? []), 'recently added'] } : {}),
      }
    })

    return { ...ctx, candidates }
  },
}
```

Rules:

- **Return a new context.** Mutating `ctx` or `candidate.card` is a bug.
- **Never fetch.** Stages are pure; `external` is the documented exception.
- **Use `ctx.rng`.** Randomness must be seedable so tests and benchmarks replay.
- **Respect `limit` as a cap.** The engine applies it, but filtering early saves
  work.
- **Attach `reasons` sparingly.** They surface in the UI and the trace; a reason
  on every card is noise.

## Example: a hard business rule

```ts
export const inStock: RankStage = {
  name: 'in-stock',
  run(ctx) {
    const candidates = ctx.candidates.filter(({ card }) => {
      const stock = card.extra?.stock
      return typeof stock !== 'number' || stock > 0
    })
    return { ...ctx, candidates }
  },
}
```

Filtering stages belong before scoring stages: fewer candidates means less work
for everything downstream.

## Example: exploration with a seeded sampler

```ts
import { sampleBeta } from '@swipeline/rank'

export const tagThompson: RankStage = {
  name: 'tag-thompson',
  run(ctx) {
    const candidates = ctx.candidates.map((candidate) => {
      const tags = candidate.card.tags ?? []
      const samples = tags.map((tag) => {
        const posterior = ctx.profile.tagStats[tag.toLowerCase()] ?? { a: 1, b: 1 }
        return sampleBeta(posterior.a, posterior.b, ctx.rng)
      })
      const exploration = samples.length > 0 ? Math.max(...samples) : 0.5
      return {
        ...candidate,
        score: candidate.score + 0.15 * exploration,
        reasons: [...(candidate.reasons ?? []), `exploration ${exploration.toFixed(2)}`],
      }
    })
    return { ...ctx, candidates }
  },
}
```

## Composing

```ts
import { pipeline } from '@swipeline/rank'

export const rank = pipeline(seenFilter(), hardFilters(), boostNew, tagThompson, mmr({ lambda: 0.8 }))
```

A pipeline is itself a `RankStage` named `pipeline`, so nesting is allowed and
traces stay readable.

## Tests to bring in a PR

```ts
import { describe, expect, it } from 'vitest'
import { makeRankContext } from '@swipeline/rank/testkit'

it('never emits duplicates', () => {
  const ctx = makeRankContext({ cards: [/* ... */] })
  const once = mmr({ lambda: 0.75 }).run(ctx)
  const ids = once.candidates.map((c) => c.card.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it('is deterministic for a seeded rng', () => {
  const a = tagThompson.run(makeRankContext({ seed: 42 }))
  const b = tagThompson.run(makeRankContext({ seed: 42 }))
  expect(a.candidates.map((c) => c.score)).toEqual(b.candidates.map((c) => c.score))
})
```

Property-based tests (fast-check) are preferred for invariants: no seen card
survives, MMR keeps the candidate set, scores are finite, ordering is total.

## Benchmark before claiming an improvement

```bash
pnpm swipeline bench --pipeline ./my-pipeline.ts --users 200 --swipes 100
```

A stage that "feels better" but loses to the previous pipeline on precision@20 and
regret is not an improvement. PRs that change ranking semantics need a benchmark
result in the description; CI also runs the harness for `rank/` changes.
