// @vitest-environment jsdom
import { type Card, createEngine, type SourceAdapter } from '@swipeline/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SwipeDeck } from '../src/index.js'

afterEach(cleanup)

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

async function setup(props: Partial<Parameters<typeof SwipeDeck>[0]> = {}) {
  const store = createEngine({
    deckId: 'products',
    actor: 'reader',
    source,
    clock: () => Date.UTC(2026, 10, 24),
  })
  store.dispatch({ type: 'refill' })
  await store.whenSettled()
  return { store, ...render(<SwipeDeck store={store} {...props} />) }
}

describe('SwipeDeck templates and messages', () => {
  it('renders the facts strip for the facts template', async () => {
    await setup({ template: 'facts' })
    const list = screen.getByLabelText('Details')
    expect(list.tagName).toBe('DL')
    expect(screen.getByText('Rating')).toBeDefined()
    expect(screen.getByText('499 USD')).toBeDefined()
    expect(screen.queryByText('A phone.')).toBeNull()
  })

  it('formats fact numbers in the requested locale', async () => {
    await setup({ template: 'facts', locale: 'de-DE', messages: { 'deck.facts': 'Details' } })
    expect(screen.getByText('4,6')).toBeDefined()
  })

  it('renders text cards without the image', async () => {
    await setup({ template: 'text' })
    expect(screen.getByText('A phone.')).toBeDefined()
    expect(screen.queryByAltText('Aurora 7 front')).toBeNull()
  })

  it('translates controls and status text', async () => {
    await setup({ messages: { 'actions.like': 'Gefällt mir', 'deck.empty': 'Keine Karten mehr.' } })
    expect(screen.getByRole('button', { name: /^Gefällt mir/ })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Gefällt mir/ }))
    await waitFor(() => expect(screen.getByText('Keine Karten mehr.')).toBeDefined())
  })

  it('uses the translated deck label', async () => {
    await setup({ messages: { 'deck.label': 'Bücherstapel' } })
    expect(screen.getByRole('application', { name: 'Bücherstapel' })).toBeDefined()
  })
})
