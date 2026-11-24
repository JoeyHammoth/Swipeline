import type { DeckSnapshot, DeckStore } from '@swipeline/core'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SwipeDeck } from '../src/index.js'

const snapshot: DeckSnapshot = Object.freeze({
  state: 'loading',
  deckId: 'ssr',
  actor: 'server',
  cards: [],
  position: 0,
  canUndo: false,
  loadingMore: false,
  version: 0,
})

const store: DeckStore = {
  getSnapshot: () => snapshot,
  getServerSnapshot: () => snapshot,
  subscribe: () => () => {},
  dispatch: () => {},
}

describe('SwipeDeck server rendering', () => {
  it('renders without window and uses the server snapshot', () => {
    const html = renderToString(<SwipeDeck store={store} />)
    expect(html).toContain('Loading cards')
    expect(html).toContain('aria-live="polite"')
  })
})
