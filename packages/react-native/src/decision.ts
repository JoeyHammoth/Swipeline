import type { Card } from '@swipeline/core'
import { computeSwipeIntent, type SwipeIntent, type SwipeIntentOptions } from '@swipeline/gestures'
import type { Translator } from '@swipeline/i18n'

/**
 * One drag sample, in React Native's units: displacement in points and velocity
 * in points per millisecond. That is what `PanResponder` reports — its `vx` is
 * `dx / dt` with `dt` in milliseconds — so the sample can be passed straight
 * through. A Gesture Handler adapter reports points per second and divides by
 * 1000 before calling this.
 */
export interface GestureSample {
  translationX: number
  translationY: number
  velocityX?: number
  velocityY?: number
}

/**
 * Turns a native drag into a commit or a cancel with the same decision math the
 * web bindings use, so a swipe means the same thing on iOS, Android and the web.
 */
export function intentFromGesture(
  sample: GestureSample,
  options: SwipeIntentOptions = {},
): SwipeIntent {
  return computeSwipeIntent(
    {
      dx: sample.translationX,
      dy: sample.translationY,
      vx: sample.velocityX ?? 0,
      vy: sample.velocityY ?? 0,
    },
    options,
  )
}

/**
 * The text a screen reader hears after the deck moves. Empty when there is no
 * card left, so an exhausted deck does not announce a stale title.
 */
export function announcementFor(card: Card | undefined, position: number, t: Translator): string {
  if (!card) return ''
  return t.t('deck.announce', { title: card.title, position: position + 1 })
}
