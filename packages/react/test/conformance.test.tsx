// @vitest-environment jsdom

import { assertBindingConformance } from '@swipeline/binding-testkit'
import type { Card, SourceAdapter } from '@swipeline/core'
import { createEngine } from '@swipeline/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { SwipeDeck } from '../src/index.js'

const source: SourceAdapter<Card> = {
  id: 'test',
  capabilities: { pagination: 'none' },
  async fetch() {
    return {
      items: [
        {
          schemaVersion: 1 as const,
          id: 'test:1',
          sourceId: 'test',
          title: 'First card',
          fetchedAt: '2026-11-24T00:00:00.000Z',
        },
        {
          schemaVersion: 1 as const,
          id: 'test:2',
          sourceId: 'test',
          title: 'Second card',
          fetchedAt: '2026-11-24T00:00:00.000Z',
        },
      ],
    }
  },
  normalize(raw) {
    return raw
  },
}

describe('React binding conformance', () => {
  it('passes the shared suite', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const store = createEngine({ deckId: 'test', actor: 'reader', source })
    const root = createRoot(container)
    await act(async () => {
      root.render(<SwipeDeck store={store} />)
      store.dispatch({ type: 'refill' })
      await store.whenSettled()
    })
    const deck = container.firstElementChild as HTMLElement
    expect(deck).toBeDefined()

    const report = await assertBindingConformance(
      {
        name: 'react',
        async mount() {
          return {
            root: deck,
            settle: async () => {
              await act(async () => {
                await store.whenSettled()
              })
            },
            destroy: () => {
              act(() => root.unmount())
              container.remove()
            },
          }
        },
      },
      { firstTitle: 'First card', secondTitle: 'Second card' },
    )
    expect(report).toEqual({ binding: 'react', checks: 7 })
  })
})
