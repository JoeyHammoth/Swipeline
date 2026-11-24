import { describe, expect, it } from 'vitest'
import {
  compareEvents,
  isUlid,
  parseSwipeEvent,
  type SwipeEvent,
  swipeEventSchema,
} from '../src/index.js'

function makeEvent(overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: '01JC0B5V6Q9F3ZK2M4N7P8RSTV',
    deckId: 'books',
    cardId: 'openlibrary:OL123W',
    actor: 'actor-1',
    action: 'like',
    position: 0,
    ts: '2026-11-24T10:00:00.000Z',
    ...overrides,
  }
}

describe('ULID ids', () => {
  it('accepts Crockford base32 ids', () => {
    expect(isUlid('01JC0B5V6Q9F3ZK2M4N7P8RSTV')).toBe(true)
  })

  it('rejects ambiguous letters and wrong lengths', () => {
    expect(isUlid('01JC0B5V6Q9F3ZK2M4N7P8RSTI')).toBe(false) // I
    expect(isUlid('01JC0B5V6Q9F3ZK2M4N7P8RSTU')).toBe(false) // U
    expect(isUlid('too-short')).toBe(false)
  })

  it('is required on events', () => {
    expect(() => parseSwipeEvent(makeEvent({ id: 'not-a-ulid' }))).toThrow()
  })
})

describe('swipeEventSchema', () => {
  it('accepts known and custom actions', () => {
    for (const action of ['like', 'dislike', 'superlike', 'skip', 'later', 'undo', 'buy']) {
      expect(parseSwipeEvent(makeEvent({ action })).action).toBe(action)
    }
  })

  it('accepts optional dwell time and context', () => {
    const event = makeEvent({ dwellMs: 1200, context: { query: 'sci-fi', rankerVersion: '0.1.0' } })
    expect(swipeEventSchema.parse(event)).toEqual(event)
  })

  it('rejects negative position or dwell time', () => {
    expect(swipeEventSchema.safeParse(makeEvent({ position: -1 })).success).toBe(false)
    expect(swipeEventSchema.safeParse(makeEvent({ dwellMs: -5 })).success).toBe(false)
  })

  it('rejects non-integer position', () => {
    expect(swipeEventSchema.safeParse(makeEvent({ position: 1.5 })).success).toBe(false)
  })

  it('rejects unknown fields, keeping the wire format closed', () => {
    expect(swipeEventSchema.safeParse({ ...makeEvent(), swipeDirection: 'right' }).success).toBe(
      false,
    )
  })

  it('orders events by ULID so replay matches incremental application', () => {
    const a = makeEvent({ id: '01JC0B5V6Q9F3ZK2M4N7P8RSTV' })
    const b = makeEvent({ id: '01JC0B5V6Q9F3ZK2M4N7P8RSTW' })
    expect([b, a].sort(compareEvents).map((e) => e.id)).toEqual([a.id, b.id])
    expect(compareEvents(a, a)).toBe(0)
  })
})
