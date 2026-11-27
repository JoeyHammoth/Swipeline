import type { EventStore } from '@swipeline/core'
import type { SmokeDeck } from './deck'

export interface SmokeResult {
  readonly ok: boolean
  readonly detail: string
}

/**
 * Drives the deck without a finger: refill, like the first card, then check both
 * that the deck advanced and that the event log recorded the like. The app shows
 * the result on screen, so launching it on a device is enough to prove the
 * binding reaches the engine end to end.
 *
 * Kept free of React and React Native imports so it can be tested in Node.
 */
export async function runScriptedSwipe(deck: SmokeDeck): Promise<SmokeResult> {
  const before = deck.store.getSnapshot()
  deck.store.dispatch({ type: 'refill' })
  await deck.store.whenSettled()

  const card = deck.store.getSnapshot().cards[0]
  if (!card) {
    return { ok: false, detail: 'the deck loaded no cards' }
  }

  const previous = deck.store.getSnapshot().position
  deck.store.dispatch({ type: 'swipe', action: 'like', cardId: card.id })
  await deck.store.whenSettled()

  const after = deck.store.getSnapshot()
  if (after.position !== previous + 1) {
    return { ok: false, detail: `the deck stayed at position ${after.position}` }
  }

  const recorded = await recordedLike(deck.events, card.id)
  if (!recorded) {
    return { ok: false, detail: 'the like was not written to the event log' }
  }

  return {
    ok: true,
    detail: `liked "${card.title}" after loading ${before.cards.length || 'no'} cards`,
  }
}

async function recordedLike(events: EventStore, cardId: string): Promise<boolean> {
  const stored = await events.query({ cardId })
  return stored.some((event) => event.action === 'like')
}
