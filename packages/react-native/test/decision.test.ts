import type { Card } from '@swipeline/core'
import { DEFAULT_DISTANCE_THRESHOLD } from '@swipeline/gestures'
import { createTranslator } from '@swipeline/i18n'
import { describe, expect, it } from 'vitest'
import { announcementFor, intentFromGesture } from '../src/decision.js'

const card: Card = {
  schemaVersion: 1,
  id: 'test:1',
  sourceId: 'test',
  title: 'First card',
  fetchedAt: '2026-11-24T00:00:00.000Z',
}

describe('intentFromGesture', () => {
  it('commits a drag past the distance threshold', () => {
    const intent = intentFromGesture({
      translationX: DEFAULT_DISTANCE_THRESHOLD + 10,
      translationY: 4,
    })
    expect(intent).toMatchObject({ kind: 'commit', direction: 'right', action: 'like' })
  })

  it('cancels a short, slow drag', () => {
    const intent = intentFromGesture({ translationX: 20, translationY: 2, velocityX: 0.1 })
    expect(intent).toEqual({ kind: 'cancel', reason: 'below-threshold' })
  })

  it('commits a short flick when the velocity clears the threshold', () => {
    // PanResponder reports points per millisecond, so 0.9 is a fast flick.
    const intent = intentFromGesture({ translationX: 24, translationY: 0, velocityX: 0.9 })
    expect(intent).toMatchObject({ kind: 'commit', direction: 'right', action: 'like' })
  })

  it('maps the vertical directions to superlike and later', () => {
    expect(intentFromGesture({ translationX: 0, translationY: -140 })).toMatchObject({
      direction: 'up',
      action: 'superlike',
    })
    expect(intentFromGesture({ translationX: 0, translationY: 140 })).toMatchObject({
      direction: 'down',
      action: 'later',
    })
  })

  it('honours per-direction action overrides', () => {
    const intent = intentFromGesture(
      { translationX: 140, translationY: 0 },
      { actions: { right: 'skip' } },
    )
    expect(intent).toMatchObject({ kind: 'commit', action: 'skip' })
  })

  it('refuses to guess a slow diagonal drag', () => {
    const intent = intentFromGesture({ translationX: 120, translationY: 110, velocityX: 0.1 })
    expect(intent).toEqual({ kind: 'cancel', reason: 'ambiguous' })
  })
})

describe('announcementFor', () => {
  const t = createTranslator()

  it('includes the title and the one-based card position', () => {
    expect(announcementFor(card, 0, t)).toBe('First card, card 1')
    expect(announcementFor(card, 2, t)).toBe('First card, card 3')
  })

  it('says nothing when the deck is exhausted', () => {
    expect(announcementFor(undefined, 0, t)).toBe('')
  })
})
