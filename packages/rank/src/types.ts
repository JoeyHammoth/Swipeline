import type { Card, Profile } from '@swipeline/core'

export interface Candidate {
  card: Card
  score: number
  reasons?: string[]
}

export interface RankContext {
  actor: string
  deckId: string
  candidates: Candidate[]
  profile: Profile
  limit: number
  rng: () => number
  seen?: ReadonlySet<string>
  query?: string
  filters?: Record<string, unknown>
  now?: number
}

export interface RankStage {
  name: string
  run(ctx: RankContext): RankContext | Promise<RankContext>
}

/** Composes stages in order. A stage must return a new context. */
export function pipeline(...stages: readonly RankStage[]): RankStage {
  return {
    name: 'pipeline',
    async run(ctx) {
      let current = ctx
      for (const stage of stages) current = await stage.run(current)
      return current
    },
  }
}

export function mapCandidates(
  ctx: RankContext,
  update: (candidate: Candidate) => Candidate,
): RankContext {
  return { ...ctx, candidates: ctx.candidates.map(update) }
}

export function addReason(candidate: Candidate, reason: string): Candidate {
  return { ...candidate, reasons: [...(candidate.reasons ?? []), reason] }
}
