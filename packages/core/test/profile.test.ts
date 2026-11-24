import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACTION_WEIGHTS,
  profileSchema,
  rebuildProfile,
  type SwipeAction,
  type SwipeEvent,
} from '../src/index.js'

const NOW = '2026-11-24T12:00:00.000Z'

function event(
  index: number,
  action: SwipeAction,
  cardId = `src:${index % 3}`,
  tags: string[] = ['space opera', 'fiction'],
): SwipeEvent {
  // ULID-shaped ids that sort by index, so tests can reason about order.
  const id = `01JC0B5V6Q9F3ZK2M4N7P8RST${String.fromCharCode(65 + index)}`
  return {
    schemaVersion: 1,
    id,
    deckId: 'books',
    cardId,
    actor: 'actor-1',
    action,
    position: index,
    ts: NOW,
    ...(tags.length > 0 ? { context: { tags } } : {}),
  }
}

const tagsFor = new Map([
  ['src:0', ['Space Opera', 'fiction']],
  ['src:1', ['fiction', 'cyberpunk']],
  ['src:2', ['hard sci-fi']],
])

describe('rebuildProfile', () => {
  it('produces a schema-valid profile', () => {
    const profile = rebuildProfile([event(0, 'like'), event(1, 'dislike')], {
      actor: 'actor-1',
      deckId: 'books',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    expect(profileSchema.parse(profile)).toEqual(profile)
    expect(profile.updatedAt).toBe(NOW)
  })

  it('counts distinct cards, not events', () => {
    const profile = rebuildProfile(
      [event(0, 'like', 'src:0'), event(1, 'later', 'src:0'), event(2, 'dislike', 'src:1')],
      { actor: 'a', deckId: 'd', now: NOW },
    )
    expect(profile.counts).toEqual({ seen: 2, liked: 1, disliked: 1 })
  })

  it('treats unknown actions as seen with zero weight', () => {
    const profile = rebuildProfile([event(0, 'buy')], {
      actor: 'a',
      deckId: 'd',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    expect(profile.counts).toEqual({ seen: 1, liked: 0, disliked: 0 })
    expect(profile.tagStats.fiction).toEqual({ a: 0, b: 0 })
  })

  it('accumulates Beta evidence per normalized tag', () => {
    const profile = rebuildProfile([event(0, 'superlike'), event(1, 'dislike')], {
      actor: 'a',
      deckId: 'd',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    // src:0 superlike → fiction a+=2, space opera a+=2
    // src:1 dislike → fiction b+=0.6, cyberpunk b+=0.6
    expect(profile.tagStats.fiction).toEqual({ a: 2, b: 0.6 })
    expect(profile.tagStats['space opera']).toEqual({ a: 2, b: 0 })
    expect(profile.tagStats.cyberpunk).toEqual({ a: 0, b: 0.6 })
    expect(profile.tagStats['hard sci-fi']).toBeUndefined()
  })

  it('applies custom weights', () => {
    const profile = rebuildProfile([event(0, 'like')], {
      actor: 'a',
      deckId: 'd',
      weights: { like: 5 },
      tagsByCardId: tagsFor,
      now: NOW,
    })
    expect(profile.tagStats.fiction?.a).toBe(5)
  })

  it('undoes the most recent applied event, reversing its evidence', () => {
    const like = event(0, 'like')
    const undo = event(1, 'undo')
    const withLike = rebuildProfile([like], {
      actor: 'a',
      deckId: 'd',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    const withUndo = rebuildProfile([like, undo], {
      actor: 'a',
      deckId: 'd',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    const baseline = rebuildProfile([], { actor: 'a', deckId: 'd', now: NOW })

    expect(withLike.counts).toEqual({ seen: 1, liked: 1, disliked: 0 })
    expect(withUndo.counts).toEqual(baseline.counts)
    expect(withUndo.tagStats).toEqual(baseline.tagStats)
  })

  it('ignores an undo with nothing to undo', () => {
    const profile = rebuildProfile([event(0, 'undo')], {
      actor: 'a',
      deckId: 'd',
      tagsByCardId: tagsFor,
      now: NOW,
    })
    expect(profile.counts).toEqual({ seen: 0, liked: 0, disliked: 0 })
    expect(profile.tagStats).toEqual({})
  })

  it('is order-independent for a sorted log', () => {
    const first = event(0, 'like')
    const second = event(1, 'dislike')
    const third = event(2, 'later')
    const options = { actor: 'a', deckId: 'd', tagsByCardId: tagsFor, now: NOW }
    const forward = rebuildProfile([first, second, third], options)
    const shuffled = rebuildProfile([third, first, second], options)
    expect(shuffled).toEqual(forward)
  })

  it('never mutates its input', () => {
    const events = [event(0, 'like'), event(1, 'undo')]
    const snapshot = JSON.stringify(events)
    rebuildProfile(events, { actor: 'a', deckId: 'd', tagsByCardId: tagsFor, now: NOW })
    expect(JSON.stringify(events)).toBe(snapshot)
  })

  it('exposes the documented default weights', () => {
    expect(DEFAULT_ACTION_WEIGHTS).toMatchObject({
      superlike: 2,
      like: 1,
      later: 0.5,
      skip: -0.1,
      dislike: -0.6,
    })
    expect(Object.isFrozen(DEFAULT_ACTION_WEIGHTS)).toBe(true)
  })
})

describe('profile invariants (property-based)', () => {
  it('undo of the last applied event returns to the profile before it', () => {
    const actions = fc.constantFrom<SwipeAction>('like', 'dislike', 'superlike', 'skip', 'later')
    const cards = fc.constantFrom('src:0', 'src:1', 'src:2')
    fc.assert(
      fc.property(fc.array(fc.tuple(actions, cards), { maxLength: 12 }), (pairs) => {
        const events = pairs.map(([action, card], index) => event(index, action, card))
        const before = rebuildProfile(events, {
          actor: 'a',
          deckId: 'd',
          tagsByCardId: tagsFor,
          now: NOW,
        })
        const undoEvent = event(events.length, 'undo')
        const after = rebuildProfile([...events, undoEvent], {
          actor: 'a',
          deckId: 'd',
          tagsByCardId: tagsFor,
          now: NOW,
        })

        if (events.length === 0) {
          expect(after.counts).toEqual(before.counts)
          return
        }
        // Undo removes the last event's card weight; recomputing without it must match.
        const expected = rebuildProfile(events.slice(0, -1), {
          actor: 'a',
          deckId: 'd',
          tagsByCardId: tagsFor,
          now: NOW,
        })
        expect(after.counts).toEqual(expected.counts)
        expect(after.tagStats).toEqual(expected.tagStats)
      }),
      { numRuns: 100 },
    )
  })

  it('seen never exceeds the number of distinct cards swiped', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('src:0', 'src:1', 'src:2'), { maxLength: 20 }),
        (cards) => {
          const events = cards.map((card, index) => event(index, 'like', card))
          const profile = rebuildProfile(events, { actor: 'a', deckId: 'd', now: NOW })
          expect(profile.counts.seen).toBeLessThanOrEqual(new Set(cards).size)
        },
      ),
      { numRuns: 100 },
    )
  })
})
