import type { Card } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import { CARD_TEMPLATES, cardView, isCardTemplate } from '../src/index.js'

const attribution = { text: 'Data from Open Library', url: 'https://openlibrary.org' }

function book(overrides: Partial<Card> = {}): Card {
  return {
    schemaVersion: 1,
    id: 'books:dune',
    sourceId: 'books',
    title: 'Dune',
    subtitle: 'Frank Herbert',
    body: 'A desert planet, a spice and a dynasty.',
    tags: ['science fiction', 'classic'],
    media: [
      { kind: 'image', url: 'https://covers.example/dune.jpg', alt: 'Dune cover' },
      { kind: 'image', url: 'https://covers.example/dune-back.jpg' },
    ],
    facts: [
      { label: 'Pages', value: 496 },
      { label: 'Rating', value: 4.6 },
    ],
    attribution,
    fetchedAt: '2026-11-24T00:00:00.000Z',
    ...overrides,
  }
}

describe('card templates', () => {
  it('lists the templates every binding supports', () => {
    expect(CARD_TEMPLATES).toEqual(['text', 'media', 'facts'])
    expect(isCardTemplate('facts')).toBe(true)
    expect(isCardTemplate('compare')).toBe(false)
  })

  it('renders text cards without media or facts', () => {
    const view = cardView(book(), 'text')
    expect(view.title).toBe('Dune')
    expect(view.subtitle).toBe('Frank Herbert')
    expect(view.body).toBe('A desert planet, a spice and a dynasty.')
    expect(view.tags).toEqual(['science fiction', 'classic'])
    expect(view.media).toBeUndefined()
    expect(view.facts).toBeUndefined()
  })

  it('renders one hero image for media cards, not the body', () => {
    const view = cardView(book(), 'media')
    expect(view.media).toHaveLength(1)
    expect(view.media?.[0]?.alt).toBe('Dune cover')
    expect(view.body).toBeUndefined()
    expect(view.tags).toHaveLength(2)
  })

  it('renders the facts strip for product cards', () => {
    const view = cardView(book(), 'facts')
    expect(view.facts?.map((fact) => fact.label)).toEqual(['Pages', 'Rating'])
    expect(view.media).toHaveLength(1)
    expect(view.tags).toBeUndefined()
    expect(view.body).toBeUndefined()
  })

  it('keeps attribution in every template', () => {
    for (const template of CARD_TEMPLATES) {
      expect(cardView(book(), template).attribution).toEqual(attribution)
    }
  })

  it('omits an empty facts strip and empty tags instead of rendering them', () => {
    const view = cardView(book({ facts: [], tags: [] }), 'facts')
    expect(view.facts).toBeUndefined()
    expect(view.tags).toBeUndefined()
  })

  it('handles a card with no media, body or optional fields', () => {
    const bare: Card = {
      schemaVersion: 1,
      id: 'books:bare',
      sourceId: 'books',
      title: 'Bare',
      fetchedAt: '2026-11-24T00:00:00.000Z',
    }
    for (const template of CARD_TEMPLATES) {
      const view = cardView(bare, template)
      expect(view.title).toBe('Bare')
      expect(view.media).toBeUndefined()
      expect(view.subtitle).toBeUndefined()
    }
  })

  it('falls back to the first media when no image exists', () => {
    const view = cardView(
      book({ media: [{ kind: 'video', url: 'https://example/trailer.mp4' }] }),
      'media',
    )
    expect(view.media?.[0]?.kind).toBe('video')
  })

  it('copies arrays so a view cannot mutate the card', () => {
    const card = book()
    const view = cardView(card, 'media')
    expect(view.tags).not.toBe(card.tags)
    expect(view.media).not.toBe(card.media)
    ;(view.tags as string[]).push('mutated')
    ;(view.media as unknown[]).splice(0, 1)
    expect(card.tags).toHaveLength(2)
    expect(card.media).toHaveLength(2)
  })

  it('defaults to the media template and rejects an unknown one', () => {
    expect(cardView(book()).template).toBe('media')
    expect(() => cardView(book(), 'compare' as never)).toThrow(/Unknown card template/)
  })
})
