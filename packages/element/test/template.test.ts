// @vitest-environment jsdom

import { type Card, createEngine, type DeckStore, type SourceAdapter } from '@swipeline/core'
import { afterEach, describe, expect, it } from 'vitest'
import { SwipeDeckElement } from '../src/index.js'

const product: Card = {
  schemaVersion: 1,
  id: 'products:phone',
  sourceId: 'products',
  title: 'Aurora 7',
  subtitle: 'Northwind',
  body: 'A phone.',
  facts: [
    { label: 'Rating', value: 4.6 },
    { label: 'Price', value: 499, unit: 'USD' },
  ],
  media: [{ kind: 'image', url: 'https://example/phone.jpg', alt: 'Aurora 7 front' }],
  tags: ['phone'],
  attribution: { text: 'Sample data' },
  fetchedAt: '2026-11-24T00:00:00.000Z',
}

const source: SourceAdapter<Card> = {
  id: 'products',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: [product] }
  },
  normalize(raw) {
    return raw
  },
}

const instances: SwipeDeckElement[] = []

afterEach(() => {
  for (const element of instances.splice(0)) element.remove()
})

async function mount(): Promise<{ element: SwipeDeckElement; engine: DeckStore }> {
  const engine = createEngine({ deckId: 'products', actor: 'reader', source })
  const element = new SwipeDeckElement()
  element.store = engine
  document.body.append(element)
  instances.push(element)
  engine.dispatch({ type: 'refill' })
  await engine.whenSettled()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { element, engine }
}

describe('swipe-deck templates and messages', () => {
  it('renders the facts strip when the template attribute is set', async () => {
    const { element } = await mount()
    element.setAttribute('template', 'facts')
    const facts = element.shadowRoot?.querySelector('.swl-facts')
    expect(facts?.tagName).toBe('DL')
    expect(facts?.textContent).toContain('Rating')
    expect(facts?.textContent).toContain('499 USD')
    expect(element.shadowRoot?.querySelector('.swl-body')).toBeNull()
  })

  it('keeps the media template as the default', async () => {
    const { element } = await mount()
    expect(element.template).toBe('media')
    expect(element.shadowRoot?.querySelector('img')?.alt).toBe('Aurora 7 front')
    expect(element.shadowRoot?.querySelector('.swl-facts')).toBeNull()
  })

  it('reflects the property back to the attribute', async () => {
    const { element } = await mount()
    element.template = 'text'
    expect(element.getAttribute('template')).toBe('text')
    expect(element.shadowRoot?.querySelector('img')).toBeNull()
    expect(element.shadowRoot?.querySelector('.swl-body')?.textContent).toBe('A phone.')
  })

  it('reports an unknown template instead of rendering a guess', async () => {
    const { element } = await mount()
    let detail: unknown
    element.addEventListener('error', (event) => {
      detail = (event as unknown as CustomEvent).detail
    })
    element.setAttribute('template', 'compare')
    expect(String(detail)).toMatch(/Unknown card template "compare"/)
    expect(element.template).toBe('media')
  })

  it('localises the controls and the live region', async () => {
    const { element } = await mount()
    element.messages = {
      'actions.like': 'Gefällt mir',
      'deck.undo': 'Rückgängig',
      'deck.announce': '{title}, Karte {position}',
    }
    const like = element.shadowRoot?.querySelector('[data-action="like"]')
    expect(like?.textContent).toBe('Gefällt mir')
    expect(like?.getAttribute('aria-label')).toBe('Gefällt mir (Right)')
    expect(element.shadowRoot?.querySelector('[data-action="undo"]')?.textContent).toBe(
      'Rückgängig',
    )
    expect(element.shadowRoot?.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Aurora 7, Karte 1',
    )
  })

  it('formats fact numbers in the translator locale', async () => {
    const { element } = await mount()
    element.messages = { 'deck.facts': 'Details' }
    element.setAttribute('template', 'facts')
    const values = [...(element.shadowRoot?.querySelectorAll('.swl-facts dd') ?? [])]
    expect(values.map((node) => node.textContent)).toEqual(['4.6', '499 USD'])
  })
})
