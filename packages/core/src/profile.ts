import { z } from 'zod'
import type { SwipeEvent } from './event.js'
import { compareEvents } from './event.js'

/** Beta posterior per tag: `a` counts positive evidence, `b` negative. */
export const tagPosteriorSchema = z
  .object({
    a: z.number().nonnegative(),
    b: z.number().nonnegative(),
  })
  .strict()

export const profileSchema = z
  .object({
    actor: z.string().min(1),
    deckId: z.string().min(1),
    /** Filled by the rank package when an Embedder or hashed features are used. */
    prefVector: z.array(z.number()).optional(),
    tagStats: z.record(z.string(), tagPosteriorSchema),
    counts: z
      .object({
        seen: z.number().int().nonnegative(),
        liked: z.number().int().nonnegative(),
        disliked: z.number().int().nonnegative(),
      })
      .strict(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export type Profile = z.infer<typeof profileSchema>
export type TagPosterior = z.infer<typeof tagPosteriorSchema>

/**
 * Starting weights from the design plan (§5.5). Tuned by the benchmark, not by
 * taste, and overridable per project.
 */
export const DEFAULT_ACTION_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  superlike: 2,
  like: 1,
  later: 0.5,
  skip: -0.1,
  dislike: -0.6,
})

export interface RebuildProfileOptions {
  actor: string
  deckId: string
  weights?: Readonly<Record<string, number>>
  /**
   * Tags per card id. Tag posteriors cannot be derived from events alone,
   * because events carry no card metadata; the engine supplies this from the
   * ItemStore (or from `context.tags` when a card may have been evicted).
   * Missing entries fall back to `event.context.tags` when present, and
   * contribute no tag evidence otherwise.
   */
  tagsByCardId?:
    | ReadonlyMap<string, readonly string[]>
    | Readonly<Record<string, readonly string[]>>
  /** ISO timestamp for `updatedAt`; injected so tests are deterministic. */
  now?: string
}

function mappedTagsFor(
  source: RebuildProfileOptions['tagsByCardId'],
  cardId: string,
): readonly string[] | undefined {
  if (!source) return undefined
  if (source instanceof Map) return source.get(cardId)
  const record = source as Readonly<Record<string, readonly string[]>>
  return Object.hasOwn(record, cardId) ? record[cardId] : undefined
}

function contextTagsFor(context: SwipeEvent['context']): readonly string[] {
  const raw = context?.tags
  if (!Array.isArray(raw)) return []
  return raw.filter((tag): tag is string => typeof tag === 'string')
}

function tagsFor(
  source: RebuildProfileOptions['tagsByCardId'],
  event: SwipeEvent,
): readonly string[] {
  return mappedTagsFor(source, event.cardId) ?? contextTagsFor(event.context)
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

/**
 * Derives a profile from an event log. Pure: same events, same output.
 *
 * Rules
 * - Events are applied in ULID order.
 * - `undo` removes the most recent applied event, so the log stays append-only
 *   and history remains auditable.
 * - A card counts as seen once, liked when its net weight is positive, disliked
 *   when negative. Custom actions default to weight 0 and count as seen only.
 * - Tag evidence uses the absolute weight: a superlike adds 2 to `a`, a dislike
 *   adds 0.6 to `b`.
 */
export function rebuildProfile(
  events: readonly SwipeEvent[],
  options: RebuildProfileOptions,
): Profile {
  const weights = options.weights ?? DEFAULT_ACTION_WEIGHTS
  const applied: SwipeEvent[] = []

  for (const event of [...events].sort(compareEvents)) {
    if (event.action === 'undo') {
      applied.pop()
      continue
    }
    applied.push(event)
  }

  const cardWeights = new Map<string, number>()
  const tagStats: Record<string, TagPosterior> = {}

  for (const event of applied) {
    const weight = weights[event.action] ?? 0
    cardWeights.set(event.cardId, (cardWeights.get(event.cardId) ?? 0) + weight)

    const stats = tagStats
    for (const tag of tagsFor(options.tagsByCardId, event)) {
      const key = normalizeTag(tag)
      if (!key || key === '__proto__') continue
      const current = (Object.hasOwn(stats, key) ? stats[key] : undefined) ?? { a: 0, b: 0 }
      stats[key] = {
        a: current.a + Math.max(weight, 0),
        b: current.b + Math.max(-weight, 0),
      }
    }
  }

  let liked = 0
  let disliked = 0
  for (const weight of cardWeights.values()) {
    if (weight > 0) liked += 1
    else if (weight < 0) disliked += 1
  }

  return {
    actor: options.actor,
    deckId: options.deckId,
    tagStats,
    counts: { seen: cardWeights.size, liked, disliked },
    updatedAt: options.now ?? new Date().toISOString(),
  }
}
