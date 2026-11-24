import { z } from 'zod'
import { ULID_PATTERN } from './schema.js'

/**
 * The semantic meaning of a gesture or button. Known actions have default
 * weights (see `DEFAULT_ACTION_WEIGHTS`); custom actions are allowed and start
 * at weight 0 until a project assigns one.
 */
export const KNOWN_ACTIONS = ['like', 'dislike', 'superlike', 'skip', 'later', 'undo'] as const

export const swipeActionSchema = z.union([
  z.enum(KNOWN_ACTIONS),
  z.string().min(1), // custom action names such as 'buy' or 'report'
])

export type SwipeAction = z.infer<typeof swipeActionSchema>

/**
 * One append-only record of a swipe. The event log is the source of truth, so
 * everything here must stay meaningful forever: ids are stable, timestamps are
 * ISO 8601 with an offset, and `context` is for reproducible ranking metadata
 * (query, filters, rankerVersion), not for arbitrary payloads.
 */
export const swipeEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(ULID_PATTERN, 'SwipeEvent.id must be a ULID'),
    deckId: z.string().min(1),
    cardId: z.string().min(1),
    actor: z.string().min(1),
    action: swipeActionSchema,
    position: z.number().int().nonnegative(),
    dwellMs: z.number().int().nonnegative().optional(),
    ts: z.iso.datetime(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export type SwipeEvent = z.infer<typeof swipeEventSchema>

/** Parses untrusted data into a SwipeEvent, throwing a ZodError on failure. */
export function parseSwipeEvent(input: unknown): SwipeEvent {
  return swipeEventSchema.parse(input)
}

/** Events are ordered by ULID, which is time-sortable. */
export function compareEvents(a: Pick<SwipeEvent, 'id'>, b: Pick<SwipeEvent, 'id'>): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
