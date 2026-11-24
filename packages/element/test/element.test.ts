// @vitest-environment jsdom

import { assertBindingConformance } from '@swipeline/binding-testkit'
import { type Card, createEngine, type SourceAdapter } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import { SwipeDeckElement } from '../src/index.js'

function card(id: string, title: string): Card {
  return {
    schemaVersion: 1,
    id: `test:${id}`,
    sourceId: 'test',
    title,
    fetchedAt: '2026-11-24T00:00:00.000Z',
  }
}

const source: SourceAdapter<Card> = {
  id: 'test',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: [card('1', 'First card'), card('2', 'Second card')] }
  },
  normalize(raw) {
    return raw
  },
}

function makeElement(reducedMotion = false): {
  element: SwipeDeckElement
  engine: ReturnType<typeof createEngine>
} {
  const engine = createEngine({ deckId: 'test', actor: 'reader', source })
  const element = new SwipeDeckElement()
  element.store = engine
  if (reducedMotion) element.setAttribute('reduced-motion', '')
  document.body.append(element)
  return { element, engine }
}

describe('swipe-deck element', () => {
  it('renders the card, a live region and one control per action', async () => {
    const { element, engine } = makeElement()
    engine.dispatch({ type: 'refill' })
    await engine.whenSettled()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(element.shadowRoot?.textContent).toContain('First card')
    expect(element.shadowRoot?.querySelector('[aria-live="polite"]')).toBeTruthy()
    const actions = [...(element.shadowRoot?.querySelectorAll('[data-action]') ?? [])]
    expect(actions.map((node) => (node as HTMLElement).dataset.action)).toEqual([
      'dislike',
      'like',
      'superlike',
      'later',
      'undo',
    ])
    element.remove()
  })

  it('commits from a button and emits a DOM event', async () => {
    const { element, engine } = makeElement()
    let detail: unknown
    element.addEventListener('swipe', (event) => {
      detail = (event as CustomEvent).detail
    })
    engine.dispatch({ type: 'refill' })
    await engine.whenSettled()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const like = element.shadowRoot?.querySelector('[data-action="like"]') as HTMLButtonElement
    like.click()
    await engine.whenSettled()
    expect(detail).toEqual({ action: 'like', cardId: 'test:1' })
    expect(engine.getSnapshot().position).toBe(1)
    element.remove()
  })

  it('supports the keyboard and undo paths', async () => {
    const { element, engine } = makeElement()
    engine.dispatch({ type: 'refill' })
    await engine.whenSettled()
    await new Promise((resolve) => setTimeout(resolve, 0))

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await engine.whenSettled()
    expect(engine.getSnapshot().position).toBe(1)
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }))
    await engine.whenSettled()
    expect(engine.getSnapshot().position).toBe(0)
    element.remove()
  })

  it('passes the binding conformance suite', async () => {
    const report = await assertBindingConformance(
      {
        name: 'element',
        async mount() {
          const { element, engine } = makeElement()
          engine.dispatch({ type: 'refill' })
          return {
            root: element,
            settle: () => engine.whenSettled(),
            destroy: () => element.remove(),
          }
        },
      },
      { firstTitle: 'First card', secondTitle: 'Second card' },
    )
    expect(report).toEqual({ binding: 'element', checks: 7 })
  })
})
