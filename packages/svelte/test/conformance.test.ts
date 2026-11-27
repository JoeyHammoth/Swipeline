// @vitest-environment jsdom

import { assertBindingConformance } from '@swipeline/binding-testkit'
import { type Card, createEngine, type SourceAdapter } from '@swipeline/core'
import { mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { SwipeDeck } from '../src/index.js'
import type { SwipeDeckProps } from '../src/types.js'
import CustomCard from './fixtures/CustomCard.svelte'

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

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const containers: HTMLElement[] = []

function engine(sourceAdapter: SourceAdapter<Card>) {
  return createEngine({
    deckId: 'conformance',
    actor: 'reader',
    source: sourceAdapter,
    clock: () => Date.UTC(2026, 10, 24),
  })
}

async function mountDeck(
  component: typeof SwipeDeck | typeof CustomCard,
  sourceAdapter: SourceAdapter<Card> = source,
  props: Partial<SwipeDeckProps> = {},
): Promise<{
  container: HTMLElement
  store: ReturnType<typeof engine>
  element: HTMLElement
}> {
  const store = engine(sourceAdapter)
  const container = document.createElement('div')
  document.body.append(container)
  containers.push(container)
  mount(component, { target: container, props: { store, ...props } })
  store.dispatch({ type: 'refill' })
  await store.whenSettled()
  await tick()
  const element = container.firstElementChild
  if (!(element instanceof HTMLElement)) throw new Error('The deck did not render')
  return { container, store, element }
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
})

describe('SwipeDeck (Svelte)', () => {
  it('passes the shared binding conformance suite', async () => {
    const report = await assertBindingConformance(
      {
        name: 'svelte',
        async mount() {
          const store = engine(source)
          const container = document.createElement('div')
          document.body.append(container)
          const instance = mount(SwipeDeck, {
            target: container,
            props: { store, label: 'Conformance deck' },
          })
          store.dispatch({ type: 'refill' })
          const root = container.firstElementChild
          if (!(root instanceof HTMLElement)) throw new Error('Svelte fixture rendered no deck')

          return {
            root,
            settle: async () => {
              // Svelte flushes effects on a microtask; let it run before asking the
              // engine whether its own work settled.
              await tick()
              await store.whenSettled()
              await tick()
            },
            destroy: () => {
              unmount(instance)
              container.remove()
              store.close()
            },
          }
        },
      },
      { firstTitle: 'First card', secondTitle: 'Second card' },
    )
    expect(report).toEqual({ binding: 'svelte', checks: 7 })
  })

  it('renders the facts strip with locale-formatted numbers', async () => {
    const { element } = await mountDeck(SwipeDeck, productSource, {
      template: 'facts',
      locale: 'de-DE',
    })
    const facts = element.querySelector('.swl-card__facts')
    expect(facts?.tagName).toBe('DL')
    expect(facts?.textContent).toContain('Rating')
    expect(facts?.textContent).toContain('4,6')
    expect(element.querySelector('.swl-card__body')).toBeNull()
  })

  it('renders a custom card through the card snippet', async () => {
    const { element } = await mountDeck(CustomCard)
    expect(element.querySelector('.mine')?.textContent).toBe('First card')
  })

  it('translates the controls and the live region', async () => {
    const { element } = await mountDeck(SwipeDeck, source, {
      messages: { 'actions.like': 'Gefällt mir', 'deck.announce': '{title}, Karte {position}' },
    })
    const like = element.querySelector('[data-action="like"]')
    expect(like?.textContent?.trim()).toBe('Gefällt mir')
    expect(like?.getAttribute('aria-label')).toBe('Gefällt mir (Right)')
    expect(element.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe(
      'First card, Karte 1',
    )
  })

  it('advances on a button click and undoes with the keyboard', async () => {
    const { element, store } = await mountDeck(SwipeDeck)
    const like = element.querySelector('[data-action="like"]') as HTMLButtonElement
    like.click()
    await store.whenSettled()
    await tick()
    expect(store.getSnapshot().position).toBe(1)

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }))
    await store.whenSettled()
    await tick()
    expect(store.getSnapshot().position).toBe(0)
  })
})
