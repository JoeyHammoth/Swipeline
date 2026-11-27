import type { CardTemplate } from '@swipeline/cards'
import type { Card, DeckStore, SwipeAction } from '@swipeline/core'
import type { SwipeDirection } from '@swipeline/gestures'
import type { Messages } from '@swipeline/i18n'
import type { Snippet } from 'svelte'

/** Props accepted by the Svelte `<SwipeDeck>` component. */
export interface SwipeDeckProps {
  /** The headless deck store; the component never copies its state. */
  store: DeckStore
  /** Accessible name for the deck region; defaults to the translated one. */
  label?: string
  /** Override which action each direction commits. */
  actions?: Partial<Record<SwipeDirection, SwipeAction>>
  /** Built-in card template used when no `card` snippet is given. */
  template?: CardTemplate
  /** Partial message catalog; missing keys fall back to English. */
  messages?: Messages
  /** BCP 47 locale for number formatting and translation. */
  locale?: string
  /** Skip the swipe animation; defaults to `false`. */
  reducedMotion?: boolean
  /** Custom card rendering, as a Svelte 5 snippet that receives the card. */
  card?: Snippet<[Card]>
  /** Replaces the exhausted message. */
  empty?: Snippet
}
