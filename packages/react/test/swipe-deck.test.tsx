// @vitest-environment jsdom
import type { Card, DeckStore, SourceAdapter } from '@swipeline/core'
import { createEngine } from '@swipeline/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SwipeDeck, useDeck } from '../src/index.js'

afterEach(cleanup)

function Status({ store }: { store: DeckStore }) {
  const snapshot = useDeck(store)
  return <span>{snapshot.state}</span>
}

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()

function makeSource(total = 3): SourceAdapter<{ id: string }> {
  return {
    id: 'test',
    capabilities: { pagination: 'none' },
    async fetch() {
      return { items: Array.from({ length: total }, (_, index) => ({ id: String(index) })) }
    },
    normalize(raw) {
      const card: Card = {
        schemaVersion: 1,
        id: `test:${raw.id}`,
        sourceId: 'test',
        title: `Card ${raw.id}`,
        tags: ['fiction'],
        fetchedAt: ISO,
      }
      return card
    },
  }
}

let counter = 0
function sequence(): () => string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  return () => {
    let value = counter++
    let suffix = ''
    for (let digit = 0; digit < 4; digit += 1) {
      suffix = alphabet.charAt(value % 32) + suffix
      value = Math.floor(value / 32)
    }
    return `01JC0B5V6Q9F3ZK2M4N7P8R${suffix}`
  }
}

async function setup() {
  const store = createEngine({
    deckId: 'test',
    actor: 'actor-1',
    source: makeSource(),
    clock: () => Date.UTC(2026, 10, 24),
    idFactory: sequence(),
  })
  store.dispatch({ type: 'refill' })
  await store.whenSettled()
  return { store, ...render(<SwipeDeck store={store} />) }
}

describe('SwipeDeck', () => {
  it('renders the current card and an aria-live announcement', async () => {
    await setup()
    expect(screen.getByRole('heading', { name: 'Card 0' })).toBeDefined()
    const live = document.querySelector('.swl-live')
    expect(live?.getAttribute('aria-live')).toBe('polite')
    expect(live?.textContent).toBe('Card 0, card 1')
  })

  it('announces the card once and only when the card changes', async () => {
    const { store } = await setup()
    const live = document.querySelector('.swl-live')
    expect(live?.textContent).toBe('Card 0, card 1')

    fireEvent.click(screen.getByRole('button', { name: /^Like/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 1' })).toBeDefined())
    expect(live?.textContent).toBe('Card 1, card 2')

    // A state change that leaves the current card alone must not re-announce it.
    act(() => store.dispatch({ type: 'setOffline', offline: true }))
    await waitFor(() => expect(store.getSnapshot().state).toBe('offline'))
    expect(live?.textContent).toBe('Card 1, card 2')
  })

  it('advances on the Like button and moves focus to the deck', async () => {
    const { store } = await setup()
    fireEvent.click(screen.getByRole('button', { name: /^Like/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 1' })).toBeDefined())
    expect(store.getSnapshot().position).toBe(1)
    expect(document.activeElement).toBe(screen.getByRole('application', { name: /Swipe deck/ }))
  })

  it('maps arrow keys and undo', async () => {
    const { store } = await setup()
    const deck = screen.getByRole('application', { name: /Swipe deck/ })
    fireEvent.keyDown(deck, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 1' })).toBeDefined())
    expect(store.getSnapshot().position).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 0' })).toBeDefined())
    expect(store.getSnapshot().position).toBe(0)
  })

  it('renders a custom template and an exhausted state', async () => {
    const store = createEngine({
      deckId: 'test',
      actor: 'actor-1',
      source: makeSource(1),
      clock: () => Date.UTC(2026, 10, 24),
      idFactory: sequence(),
    })
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    render(<SwipeDeck store={store} renderCard={(card) => <span>{`custom ${card.title}`}</span>} />)
    expect(screen.getByText('custom Card 0')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Like/ }))
    await waitFor(() => expect(screen.getByText('No more cards.')).toBeDefined())
  })

  it('subscribes with useDeck and unsubscribes on unmount', async () => {
    const store = createEngine({
      deckId: 'test',
      actor: 'actor-1',
      source: makeSource(1),
      clock: () => Date.UTC(2026, 10, 24),
      idFactory: sequence(),
    })
    const { unmount } = render(<Status store={store} />)
    expect(screen.getByText('idle')).toBeDefined()
    unmount()
    expect(() => store.getSnapshot()).not.toThrow()
  })
})
