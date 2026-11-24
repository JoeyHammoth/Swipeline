# Ranking

Ranking is a pipeline of small typed stages. Each stage receives a
[`RankContext`](/architecture/contracts) and returns a new one.

```ts
interface RankStage {
  name: string
  run(ctx: RankContext): Promise<RankContext> | RankContext
}
```

Stages may filter, score, reorder or annotate. They never mutate the context and
never touch the network — except `external`, which is explicitly an integration
point.

## Default pipeline

```text
seenFilter → hardFilters → popularityRecency → tagAffinity
  → prefVector → thompson → epsilonRandom → mmr
```

| Stage | What it does | Why it is there |
|---|---|---|
| `seenFilter` | Removes cards the actor already swiped | A repeat is the most visible ranking bug |
| `hardFilters` | Applies user filters (price, excluded tags) | User intent beats any model |
| `popularityRecency` | Baseline score for cold start | Something reasonable before there is signal |
| `tagAffinity` | Scores by Beta posteriors per tag | Works from the first dozen swipes with no ML |
| `prefVector` | Cosine similarity to a Rocchio-style preference vector | Captures combinations tags cannot |
| `thompson` | Samples from posteriors, surfacing uncertain areas | Exploration, not just exploitation |
| `epsilonRandom` | A small fraction of random cards | Prevents filter bubbles and gives unbiased data |
| `mmr` | Maximal marginal relevance diversification | Stops ten near-identical cards in a row |
| `explain` | Attaches short reasons for UI and debugging | Makes ranking inspectable |
| `external` | Calls an external ranker (Gorse, HTTP) and merges | Integrate instead of replace |

## Cold start

A new actor has no preference vector. Three things happen, in order:

1. **Optional onboarding.** Pick tags, or pick three favourites from a seed deck.
   Those choices are written as synthetic events with `context.seed = true`.
2. **Popularity plus exploration.** `popularityRecency` ranks, and exploration is
   turned up so the profile learns quickly.
3. **Blend in personalization.** The weight of `prefVector` and `tagAffinity`
   grows with the number of events, so the deck gets personal without a cliff.

## Preference vector without embeddings

With no `Embedder`, `prefVector` is built from hashed tag and text features:
a Rocchio-style mean of liked feature vectors minus a discounted mean of
disliked ones, with time decay. Zero model downloads, zero credentials, and it
still personalizes from the first dozen swipes. Embeddings replace the feature
space, not the algorithm.

## Exploration is not noise

`thompson` samples from tag or cluster posteriors, so a tag with high uncertainty
sometimes wins. `epsilonRandom` reserves a small, configurable fraction for
uniformly random cards. Both are seedable, so a benchmark run is reproducible and
a flaky test is a bug.

## Diversity

`mmr` reorders with a relevance/diversity trade-off (`lambda`, default 0.75) and
must never emit duplicates or drop candidates. Consecutive near-duplicates are the
most common quality complaint in swipe decks, which is why diversification is in
the default pipeline rather than an option.

## Explainability

Every stage may attach `reasons` to a candidate. In development, the UI shows a
"why this card" chip; the CLI inspector prints the pipeline trace: per-stage
timing and candidate deltas. The playground shows the same information.

## Measuring it

[`@swipeline/bench`](/benchmarks) simulates users with hidden preferences and a
noisy decision rule, replays swipes against a seeded pipeline, and reports
precision@k, time-to-first-like, regret against an oracle, diversity, coverage and
exploration rate. Baselines are random, popularity and tag-only. CI fails a
change that regresses beyond the documented threshold.

The honest caveat: synthetic users validate mechanics and catch regressions. They
do not prove real-world satisfaction, and results are labelled accordingly.

## Replacing the ranking

```ts
import { defineDeck } from '@swipeline/core'
import { pipeline, mmr, prefVector, seenFilter, tagAffinity, thompson } from '@swipeline/rank'

export const deck = defineDeck({
  id: 'papers',
  source: papers,
  rank: pipeline(
    seenFilter(),
    tagAffinity({ weight: 0.4 }),
    prefVector({ weight: 0.6, dislikeDiscount: 0.5, halfLifeDays: 30 }),
    thompson({ strength: 0.15 }),
    mmr({ lambda: 0.75 }),
    { name: 'boost-new', run: (ctx) => boostRecent(ctx) },
  ),
})
```

See [Write a rank stage](/guides/write-a-rank-stage) for the stage contract and
the testing recipe.
