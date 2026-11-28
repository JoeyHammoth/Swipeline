/**
 * React Native's own entry point is Flow source that Node cannot load, so this
 * suite renders against a minimal mock of the primitives the binding uses. That
 * covers render-from-snapshot, controls, undo, the exhausted state, the
 * announcement call and teardown — not native layout, gestures or a device run.
 */
import type { Card, Engine, SourceAdapter } from '@swipeline/core'
import { createEngine } from '@swipeline/core'
import type { ElementType } from 'react'
import { AccessibilityInfo } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SwipeDeck } from '../src/index.js'

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => style },
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  PanResponder: { create: () => ({ panHandlers: {} }) },
}))

declare global {
  // React only runs `act` when the test environment opts in.
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

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

type Renderer = TestRenderer.ReactTestRenderer

// The mock renders React Native's `Text` as a host element named "Text".
const TEXT = 'Text' as unknown as ElementType

function textsOf(node: TestRenderer.ReactTestInstance): string {
  return node
    .findAllByType(TEXT)
    .map((text) =>
      Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children ?? ''),
    )
    .join(' ')
}

/** The card currently on top, so the preview underneath does not match first. */
function currentText(renderer: Renderer): string {
  return textsOf(renderer.root.findByProps({ testID: 'swl-current-card' }))
}

/** A press commits through the engine, whose event append is asynchronous. */
async function press(renderer: Renderer, store: Engine, testID: string): Promise<void> {
  const node = renderer.root.findByProps({ testID })
  expect(node.props.accessibilityRole).toBe('button')
  await act(async () => {
    node.props.onPress()
    await store.whenSettled()
  })
}

async function mount() {
  const store = createEngine({ deckId: 'test', actor: 'reader', source })
  let renderer: Renderer | undefined
  await act(async () => {
    store.dispatch({ type: 'refill' })
    await store.whenSettled()
    renderer = TestRenderer.create(<SwipeDeck store={store} />)
  })
  if (!renderer) throw new Error('renderer was not created')
  return { store, renderer }
}

describe('React Native binding', () => {
  beforeEach(() => {
    vi.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
  })

  it('renders the first card and one control per action', async () => {
    const { renderer } = await mount()
    expect(currentText(renderer)).toContain('First card')
    for (const testID of [
      'swl-action-like',
      'swl-action-dislike',
      'swl-action-superlike',
      'swl-action-later',
      'swl-action-undo',
    ]) {
      expect(renderer.root.findByProps({ testID })).toBeDefined()
    }
  })

  it('dispatches a like and shows the next card', async () => {
    const { store, renderer } = await mount()
    await press(renderer, store, 'swl-action-like')
    expect(store.getSnapshot().position).toBe(1)
    expect(currentText(renderer)).toContain('Second card')
  })

  it('undoes the last swipe', async () => {
    const { store, renderer } = await mount()
    await press(renderer, store, 'swl-action-like')
    await press(renderer, store, 'swl-action-undo')
    expect(store.getSnapshot().position).toBe(0)
    expect(currentText(renderer)).toContain('First card')
  })

  it('announces the card through the platform API', async () => {
    await mount()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('First card, card 1')
  })

  it('announces once per card and does not repeat it on a re-render', async () => {
    const { store, renderer } = await mount()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)

    await press(renderer, store, 'swl-action-like')
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
      'Second card, card 2',
    )

    // A new catalog object rebuilds the translator and re-runs the effect; the
    // same card must not be spoken twice.
    await act(async () => {
      renderer.update(<SwipeDeck store={store} messages={{}} />)
    })
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2)
  })

  it('shows the exhausted message after the last card', async () => {
    const { store, renderer } = await mount()
    await press(renderer, store, 'swl-action-like')
    await press(renderer, store, 'swl-action-dislike')
    expect(textsOf(renderer.root)).toContain('No more cards.')
  })

  it('tears down without touching the store', async () => {
    const { store, renderer } = await mount()
    act(() => renderer.unmount())
    expect(store.getSnapshot().cards.length).toBeGreaterThan(0)
  })
})
