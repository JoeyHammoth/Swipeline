import { createEngine } from '@swipeline/core'
import { createMemoryStores } from '@swipeline/store-memory'
import { describe, expect, it } from 'vitest'
import { createSmokeDeck } from '../src/deck.js'
import { runScriptedSwipe } from '../src/smoke.js'

describe('Expo smoke script', () => {
  it('likes the first card and reports it', async () => {
    const deck = createSmokeDeck()
    const result = await runScriptedSwipe(deck)
    expect(result.ok).toBe(true)
    expect(result.detail).toContain('Project Hail Mary')
    expect(deck.store.getSnapshot().position).toBe(1)
  })

  it('writes the like to the event log', async () => {
    const deck = createSmokeDeck()
    await runScriptedSwipe(deck)
    const stored = await deck.events.query({ deckId: 'books' })
    expect(stored.map((event) => event.action)).toEqual(['like'])
  })

  it('fails loudly when the source returns nothing', async () => {
    const stores = createMemoryStores()
    const store = createEngine({
      deckId: 'empty',
      actor: 'expo-smoke',
      events: stores.events,
      source: {
        id: 'empty',
        capabilities: { pagination: 'none' },
        async fetch() {
          return { items: [] }
        },
        normalize(raw) {
          return raw
        },
      },
    })
    const result = await runScriptedSwipe({ store, events: stores.events })
    expect(result).toEqual({ ok: false, detail: 'the deck loaded no cards' })
  })
})
