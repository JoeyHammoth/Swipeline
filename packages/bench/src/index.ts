import type { Card, Profile, TagPosterior } from '@swipeline/core'
import {
  defaultPipeline,
  hashFeature,
  mulberry32,
  type RankContext,
  type RankStage,
  tagAffinity,
} from '@swipeline/rank'

export type StrategyName = 'default' | 'random' | 'popularity' | 'tagOnly'

export interface BenchOptions {
  seed?: number
  /** Synthetic users. Defaults to 20. */
  users?: number
  /** Distinct cards in the pool. Defaults to 60. */
  cards?: number
  /** Swipes per user. Defaults to 10. */
  k?: number
}

export interface BenchMetrics {
  /** Likes in the first k swipes, divided by k. */
  precisionAtK: number
  /** Average swipe index of the first like, or `null` when there was none. */
  timeToFirstLike: number | null
  /** Expected likes lost against an oracle that always picks the best remaining card. */
  regret: number
  /** Distinct tags among picked cards, divided by picks. */
  diversity: number
  /** Distinct cards swiped, divided by the pool size. */
  coverage: number
  /** Share of picks below the pool's median popularity. */
  exploration: number
  picks: number
  likes: number
}

export interface BenchReport {
  seed: number
  users: number
  cards: number
  k: number
  strategies: Record<StrategyName, BenchMetrics>
}

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()
const TAGS = [
  'space',
  'fantasy',
  'history',
  'coffee',
  'ai',
  'design',
  'nature',
  'crime',
  'music',
  'food',
  'science',
]

function takeTwo(rng: () => number): string[] {
  const first = TAGS[Math.floor(rng() * TAGS.length)] ?? 'science'
  let second = TAGS[Math.floor(rng() * TAGS.length)] ?? 'space'
  if (second === first) second = TAGS[(TAGS.indexOf(first) + 1) % TAGS.length] ?? 'space'
  return [first, second]
}

function makeCards(count: number, rng: () => number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    schemaVersion: 1 as const,
    id: `bench:${index}`,
    sourceId: 'bench',
    title: `Synthetic card ${index}`,
    tags: takeTwo(rng),
    fetchedAt: new Date(Date.UTC(2026, 10, 24) - index * 86_400_000).toISOString(),
    extra: { popularity: Number(rng().toFixed(3)) },
  }))
}

function hiddenWeights(rng: () => number): Record<string, number> {
  const hidden: Record<string, number> = {}
  for (const tag of TAGS) hidden[tag] = Number((rng() * 2 - 0.8).toFixed(3))
  return hidden
}

function affinity(card: Card, hidden: Record<string, number>): number {
  const tags = card.tags ?? []
  if (tags.length === 0) return 0
  return tags.reduce((sum, tag) => sum + (hidden[tag] ?? 0), 0) / tags.length
}

function probabilityOfLike(card: Card, hidden: Record<string, number>, noise: number): number {
  const value = 2.4 * affinity(card, hidden) + (noise - 0.5) * 0.6
  return 1 / (1 + Math.exp(-value))
}

function decisionRng(seed: number, user: number, cardId: string): () => number {
  return mulberry32((seed ^ hashFeature(`${user}:${cardId}`)) >>> 0)
}

function popularity(card: Card): number {
  const value = card.extra?.popularity
  return typeof value === 'number' ? value : 0
}

function updateStats(stats: Record<string, TagPosterior>, card: Card, liked: boolean): void {
  const weight = liked ? 1 : 0.6
  for (const tag of card.tags ?? []) {
    const current = stats[tag] ?? { a: 0, b: 0 }
    stats[tag] = liked
      ? { a: current.a + weight, b: current.b }
      : { a: current.a, b: current.b + weight }
  }
}

function emptyProfile(user: number): Profile {
  return {
    actor: `bench-user-${user}`,
    deckId: 'bench',
    tagStats: {},
    counts: { seen: 0, liked: 0, disliked: 0 },
    updatedAt: ISO,
  }
}

function rankContext(pool: Card[], profile: Profile, rng: () => number): RankContext {
  return {
    actor: profile.actor,
    deckId: profile.deckId,
    candidates: pool.map((card) => ({ card, score: 0 })),
    profile,
    limit: pool.length,
    rng,
    now: Date.parse(ISO),
  }
}

interface Pick {
  card: Card
  liked: boolean
  probability: number
  bestProbability: number
}

async function choose(
  strategy: StrategyName,
  pool: Card[],
  profile: Profile,
  rng: () => number,
  stage?: RankStage,
): Promise<Card | undefined> {
  if (pool.length === 0) return undefined
  if (strategy === 'random') return pool[Math.floor(rng() * pool.length)]
  if (strategy === 'popularity') {
    return [...pool].sort((a, b) => popularity(b) - popularity(a))[0]
  }
  const ranker = stage ?? defaultPipeline()
  const ranked = await ranker.run(rankContext(pool, profile, rng))
  return ranked.candidates[0]?.card
}

function summarize(
  picks: readonly Pick[],
  poolSize: number,
  medianPopularity: number,
): BenchMetrics {
  const likes = picks.filter((pick) => pick.liked).length
  const firstLike = picks.findIndex((pick) => pick.liked)
  const uniqueCards = new Set(picks.map((pick) => pick.card.id)).size
  const uniqueTags = new Set(picks.flatMap((pick) => pick.card.tags ?? [])).size
  return {
    precisionAtK: picks.length === 0 ? 0 : likes / picks.length,
    timeToFirstLike: firstLike === -1 ? null : firstLike + 1,
    regret: picks.reduce((sum, pick) => sum + (pick.bestProbability - pick.probability), 0),
    diversity: picks.length === 0 ? 0 : uniqueTags / picks.length,
    coverage: poolSize === 0 ? 0 : uniqueCards / poolSize,
    exploration:
      picks.length === 0
        ? 0
        : picks.filter((pick) => popularity(pick.card) < medianPopularity).length / picks.length,
    picks: picks.length,
    likes,
  }
}

async function simulate(
  strategy: StrategyName,
  cards: readonly Card[],
  hidden: Record<string, number>,
  seed: number,
  user: number,
  k: number,
): Promise<Pick[]> {
  const pool = [...cards]
  const profile = emptyProfile(user)
  const rng = mulberry32((seed + user * 7919 + strategy.length * 104729) >>> 0)
  const stage = strategy === 'tagOnly' ? tagAffinity() : undefined
  const picks: Pick[] = []

  for (let step = 0; step < k && pool.length > 0; step += 1) {
    const card = await choose(strategy, pool, profile, rng, stage)
    if (!card) break
    const noise = decisionRng(seed, user, card.id)()
    const probability = probabilityOfLike(card, hidden, noise)
    const bestProbability = Math.max(
      ...pool.map((entry) => probabilityOfLike(entry, hidden, decisionRng(seed, user, entry.id)())),
    )
    const liked = decisionRng(seed, user, `decide:${card.id}`)() < probability
    picks.push({ card, liked, probability, bestProbability })
    updateStats(profile.tagStats, card, liked)
    profile.counts.seen += 1
    if (liked) profile.counts.liked += 1
    else profile.counts.disliked += 1
    const index = pool.findIndex((entry) => entry.id === card.id)
    if (index !== -1) pool.splice(index, 1)
  }
  return picks
}

/**
 * Replays synthetic users with hidden tag preferences and noisy decisions
 * against the default pipeline and three baselines. Deterministic for a given
 * seed, so a regression is a failing test rather than a feeling.
 */
export async function runBenchmark(options: BenchOptions = {}): Promise<BenchReport> {
  const seed = options.seed ?? 42
  const userCount = options.users ?? 20
  const cardCount = options.cards ?? 60
  const k = options.k ?? 10
  const cards = makeCards(cardCount, mulberry32(seed))
  const sortedPopularity = cards.map(popularity).sort((a, b) => a - b)
  const medianPopularity = sortedPopularity[Math.floor(sortedPopularity.length / 2)] ?? 0
  const strategies: StrategyName[] = ['default', 'random', 'popularity', 'tagOnly']
  const result = {} as Record<StrategyName, BenchMetrics>

  for (const strategy of strategies) {
    const picks: Pick[] = []
    for (let user = 0; user < userCount; user += 1) {
      const hidden = hiddenWeights(mulberry32((seed + user * 13) >>> 0))
      picks.push(...(await simulate(strategy, cards, hidden, seed, user, k)))
    }
    result[strategy] = summarize(picks, cards.length, medianPopularity)
  }

  return { seed, users: userCount, cards: cardCount, k, strategies: result }
}
