// @vitest-environment jsdom

import { assertBindingConformance } from '@swipeline/binding-testkit'
import { type Card, createEngine, type SourceAdapter } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { SwipeDeck } from '../src/index.js'

const ISO = '2026-11-24T00:00:00.000Z'

function card(id: string, title: string): Card {
  return {
    schemaVersion: 1,
    id: `conformance:${id}`,
    sourceId: 'conformance',
    title,
    fetchedAt: ISO,
  }
}

const source: SourceAdapter<Card> = {
  id: 'conformance',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: [card('1', 'First card'), card('2', 'Second card')] }
  },
  normalize(raw) {
    return raw
  },
}

const product: Card = {
  ...card('phone', 'Aurora 7'),
  subtitle: 'Northwind',
  body: 'A phone.',
  facts: [
    { label: 'Rating', value: 4.6 },
    { label: 'Price', value: 499, unit: 'USD' },
  ],
  media: [{ kind: 'image', url: 'https://example/phone.jpg', alt: 'Aurora 7 front' }],
  tags: ['phone'],
  attribution: { text: 'Sample data' },
}

const productSource: SourceAdapter<Card> = {
  id: 'products',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: [product] }
  },
  normalize(raw) {
    return raw
  },
}

const mounted: HTMLElement[] = []

async function mount(
  sourceAdapter: SourceAdapter<Card> = source,
  props: Record<string, unknown> = {},
  slot?: () => unknown,
): Promise<{
  container: HTMLElement
  store: ReturnType<typeof createEngine>
  app: ReturnType<typeof createApp>
}> {
  const store = createEngine({
    deckId: 'conformance',
    actor: 'reader',
    source: sourceAdapter,
    clock: () => Date.UTC(2026, 10, 24),
  })
  const container = document.createElement('div')
  document.body.append(container)
  mounted.push(container)
  const app = createApp({
    render: () => h(SwipeDeck, { store, ...props }, slot ? { card: slot } : {}),
  })
  app.mount(container)
  store.dispatch({ type: 'refill' })
  await store.whenSettled()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { container, store, app }
}

function deck(container: HTMLElement): HTMLElement {
  const element = container.firstElementChild
  if (!(element instanceof HTMLElement)) throw new Error('The deck did not render')
  return element
}

describe('SwipeDeck (Vue)', () => {
  it('passes the shared binding conformance suite', async () => {
    const report = await assertBindingConformance(
      {
        name: 'vue',
        async mount() {
          const { container, app, store } = await mount()
          return {
            root: deck(container),
            settle: async () => {
              await new Promise((resolve) => setTimeout(resolve, 0))
              await store.whenSettled()
              await new Promise((resolve) => setTimeout(resolve, 0))
            },
            destroy: () => {
              app.unmount()
              container.remove()
            },
          }
        },
      },
      { firstTitle: 'First card', secondTitle: 'Second card' },
    )
    expect(report).toEqual({ binding: 'vue', checks: 7 })
  })

  it('renders the facts strip with locale-formatted numbers', async () => {
    const { container } = await mount(productSource, { template: 'facts', locale: 'de-DE' })
    const facts = deck(container).querySelector('.swl-card__facts')
    expect(facts?.tagName).toBe('DL')
    expect(facts?.textContent).toContain('Rating')
    expect(facts?.textContent).toContain('4,6')
    expect(deck(container).querySelector('.swl-card__body')).toBeNull()
  })

  it('renders a custom card through the slot', async () => {
    const { container } = await mount(source, {}, () => h('span', { class: 'mine' }, 'custom'))
    expect(deck(container).querySelector('.mine')?.textContent).toBe('custom')
  })

  it('translates the controls and the live region', async () => {
    const { container } = await mount(source, {
      messages: { 'actions.like': 'Gefällt mir', 'deck.announce': '{title}, Karte {position}' },
    })
    const like = deck(container).querySelector('[data-action="like"]')
    expect(like?.textContent).toBe('Gefällt mir')
    expect(like?.getAttribute('aria-label')).toBe('Gefällt mir (Right)')
    expect(deck(container).querySelector('[aria-live="polite"]')?.textContent).toBe(
      'First card, Karte 1',
    )
  })

  it('advances on a button click and undoes with the keyboard', async () => {
    const { container, store } = await mount()
    const root = deck(container)
    const like = root.querySelector('[data-action="like"]') as HTMLButtonElement
    like.click()
    await store.whenSettled()
    expect(store.getSnapshot().position).toBe(1)

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }))
    await store.whenSettled()
    expect(store.getSnapshot().position).toBe(0)
  })
})
