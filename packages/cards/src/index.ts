import type { Card } from '@swipeline/core'

/**
 * Built-in card templates. A template decides *which* fields a card shows, not
 * how they look: every binding renders the same selection with its own markup, so
 * a deck looks consistent in React, the Web Component and (later) React Native.
 *
 * `compare` is deliberately absent: it needs two cards, which is a different
 * snapshot shape, and it is scheduled after M4.
 */
export const CARD_TEMPLATES = ['text', 'media', 'facts'] as const

export type CardTemplate = (typeof CARD_TEMPLATES)[number]

export function isCardTemplate(value: string): value is CardTemplate {
  return (CARD_TEMPLATES as readonly string[]).includes(value)
}

type Media = NonNullable<Card['media']>[number]
type Fact = NonNullable<Card['facts']>[number]
type Attribution = NonNullable<Card['attribution']>

/** The subset of a card one template renders, ready for a view layer. */
export interface CardView {
  readonly template: CardTemplate
  readonly title: string
  readonly subtitle?: string
  readonly body?: string
  readonly media?: readonly Media[]
  readonly facts?: readonly Fact[]
  readonly tags?: readonly string[]
  readonly attribution?: Attribution
}

function heroMedia(card: Card): Media | undefined {
  return card.media?.find((media) => media.kind === 'image') ?? card.media?.[0]
}

/**
 * The fields a template shows, in render order. Attribution is always carried
 * through: some sources require credit, and a template must not drop it.
 *
 * | Template | Shows |
 * |---|---|
 * | `text` | title, subtitle, tags, body |
 * | `media` | hero image, title, subtitle, tags |
 * | `facts` | hero image, title, subtitle, facts strip |
 */
export function cardView(card: Card, template: CardTemplate = 'media'): CardView {
  if (!isCardTemplate(template)) {
    throw new TypeError(
      `Unknown card template "${String(template)}". Use one of: ${CARD_TEMPLATES.join(', ')}.`,
    )
  }

  const view: {
    -readonly [K in keyof CardView]: CardView[K]
  } = { template, title: card.title }
  if (card.subtitle !== undefined) view.subtitle = card.subtitle
  if (card.attribution !== undefined) view.attribution = card.attribution

  const hero = heroMedia(card)
  if (template !== 'text' && hero !== undefined) view.media = [hero]

  if (template === 'text') {
    if (card.body !== undefined) view.body = card.body
    if (card.tags && card.tags.length > 0) view.tags = [...card.tags]
  }

  if (template === 'media' && card.tags && card.tags.length > 0) {
    view.tags = [...card.tags]
  }

  // Products and rentals are defined by their spec strip; a card without facts
  // falls back to its subtitle rather than rendering an empty strip.
  if (template === 'facts' && card.facts && card.facts.length > 0) {
    view.facts = [...card.facts]
  }

  return view
}
