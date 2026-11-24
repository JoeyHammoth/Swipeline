# Benchmarks

Most swipe and recommendation demos never measure whether personalization works.
`@swipeline/bench` simulates users, replays swipes and reports numbers.

::: warning Milestone M2
The harness is not implemented yet. This page specifies the protocol so the
implementation and its CI gate can be reviewed against it.
:::

## Protocol

1. **Synthetic users.** Each user has a hidden preference (a vector or a set of
   favoured tags) and a noisy decision rule: probability of `like` rises with
   similarity, with configurable noise and mood drift over the run.
2. **Replay.** Run N swipes against a pipeline with a seeded RNG. Same seed, same
   deck, every time.
3. **Checkpoints.** At 10, 30 and 100 swipes, measure the quality of the next 20
   cards.
4. **Report.** Precision@k of likes, time-to-first-like, regret against an
   oracle, intra-list diversity, catalog coverage and exploration rate.
5. **Compare.** Baselines: random, popularity, tag-only.

## Metrics

| Metric | Definition | Better |
|---|---|---|
| Precision@20 | Fraction of the next 20 cards the user likes | Higher |
| Time-to-first-like | Swipes until the first like | Lower |
| Regret vs oracle | Difference from the best possible ordering | Lower |
| Intra-list diversity | Average pairwise distance in a window | Higher, up to a point |
| Catalog coverage | Distinct cards shown / catalog size | Higher |
| Exploration rate | Fraction of cards from outside the top decile | Configurable target |

## The CI gate

`bench.yml` runs on PRs touching `rank/` or `bench/`, and nightly. A pipeline must
beat random and popularity by the documented margin, and must not regress beyond
the threshold against the previous `main` result. Regressions post a PR comment
with the numbers.

The thresholds live in the repository, not in a person's head, so "it feels better"
is not the argument.

## What this proves and what it does not

**Proves:** the mechanics work, changes are measurable, regressions get caught,
exploration and diversity behave as configured.

**Does not prove:** real-world satisfaction. Synthetic users are a proxy. Real
evaluation requires opt-in feedback from actual users, which is a later, clearly
labelled study. Any published number says "synthetic" next to it.

## Running locally

```bash
pnpm swilinebench --help          # after M2
swipeline bench --deck ./deck.config.ts --users 200 --swipes 100 --seed 7
swipeline bench --pipeline ./my-pipeline.ts --baseline random,popularity
```

Results are JSON, so a PR can attach them and CI can diff them.

## Datasets

Small synthetic catalogs ship with the harness. Public samples are added only when
their license permits redistribution, and the license is recorded next to the data.
