# @swipeline/rank

Ranking stages for Swipeline decks: `seenFilter`, `hardFilters`,
`popularityRecency`, `tagAffinity`, hashed-feature `prefVector`,
`epsilonRandom`, `thompson`, `mmr` and `explain`, composed by `pipeline()`.

```ts
import { defaultPipeline, mulberry32 } from '@swipeline/rank'

const ranked = await defaultPipeline().run({
  actor: 'reader',
  deckId: 'books',
  candidates,
  profile,
  limit: 20,
  rng: mulberry32(42),
})
```

Every stage returns a new context; none performs I/O. `explain` leaves one
`score 0.42` reason per card and keeps the stage reasons that mattered. Seed
`rng` for reproducible ordering in tests and benchmarks. `thompson` samples Beta
posteriors from the profile, `prefVector` compares hashed card features against
`profile.prefVector`, and `mmr` trades relevance for tag diversity.

Apache-2.0.
