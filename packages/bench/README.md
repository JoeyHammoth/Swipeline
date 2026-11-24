# @swipeline/bench

Synthetic-user benchmark for ranking pipelines. Each user has hidden tag
preferences and makes noisy like/dislike decisions; the harness replays k swipes
against the default pipeline and three baselines (random, popularity, tag-only)
and reports precision@k, time-to-first-like, regret, diversity, coverage and
exploration.

```ts
import { runBenchmark } from '@swipeline/bench'

const report = await runBenchmark({ seed: 42, users: 20, cards: 60, k: 10 })
console.log(report.strategies.default.precisionAtK)
```

Deterministic for a seed, so CI can fail on a regression instead of relying on
"it feels better". Synthetic users validate mechanics and catch regressions;
they do not prove real-world satisfaction.

Apache-2.0.
