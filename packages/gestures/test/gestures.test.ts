import { describe, expect, it } from 'vitest'
import {
  ACTION_LABELS,
  actionButtons,
  computeSwipeIntent,
  createGestureController,
  DEFAULT_DIRECTION_ACTIONS,
  type GestureEvent,
  keyIntent,
  prefersReducedMotion,
  resolveDirection,
  swipeProgress,
} from '../src/index.js'

class FakeElement {
  readonly style = {
    values: new Map<string, string>(),
    setProperty(name: string, value: string) {
      this.values.set(name, value)
    },
    removeProperty(name: string) {
      this.values.delete(name)
    },
  }

  readonly captured: number[] = []
  private readonly handlers = new Map<string, Set<(event: unknown) => void>>()

  addEventListener(type: string, handler: (event: never) => void): void {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler as (event: unknown) => void)
    this.handlers.set(type, set)
  }

  removeEventListener(type: string, handler: (event: never) => void): void {
    this.handlers.get(type)?.delete(handler as (event: unknown) => void)
  }

  setPointerCapture(pointerId: number): void {
    this.captured.push(pointerId)
  }

  releasePointerCapture(): void {}

  emit(type: string, event: unknown): void {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler(event)
  }

  listenerCount(): number {
    let count = 0
    for (const set of this.handlers.values()) count += set.size
    return count
  }

  get styleValues(): Map<string, string> {
    return this.style.values
  }
}

function pointer(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    ...overrides,
  } as PointerEvent
}

function setup(options: { reducedMotion?: boolean; actions?: Record<string, string> } = {}) {
  const element = new FakeElement()
  const events: GestureEvent[] = []
  const controller = createGestureController({
    element: element as unknown as HTMLElement,
    reducedMotion: options.reducedMotion ?? false,
    onIntent: (event) => events.push(event),
    ...(options.actions ? { actions: options.actions as never } : {}),
  })
  return { element, events, controller }
}

describe('computeSwipeIntent', () => {
  it('commits a dominant-axis drag past the distance threshold', () => {
    expect(computeSwipeIntent({ dx: 120, dy: 4 })).toEqual({
      kind: 'commit',
      direction: 'right',
      action: 'like',
      distance: 120,
      velocity: 0,
    })
  })

  it('maps every default direction to its documented action', () => {
    expect(computeSwipeIntent({ dx: -120, dy: 0 })).toMatchObject({
      direction: 'left',
      action: 'dislike',
    })
    expect(computeSwipeIntent({ dx: 0, dy: -120 })).toMatchObject({
      direction: 'up',
      action: 'superlike',
    })
    expect(computeSwipeIntent({ dx: 0, dy: 120 })).toMatchObject({
      direction: 'down',
      action: 'later',
    })
  })

  it('cancels a short slow drag', () => {
    expect(computeSwipeIntent({ dx: 40, dy: 10 })).toEqual({
      kind: 'cancel',
      reason: 'below-threshold',
    })
  })

  it('commits a fast flick even below the distance threshold', () => {
    expect(computeSwipeIntent({ dx: 30, dy: 0, vx: 1.2 })).toMatchObject({
      kind: 'commit',
      direction: 'right',
    })
  })

  it('cancels a slow diagonal instead of guessing', () => {
    expect(computeSwipeIntent({ dx: 120, dy: 110 })).toEqual({
      kind: 'cancel',
      reason: 'ambiguous',
    })
  })

  it('lets a fast diagonal flick commit on its dominant axis', () => {
    expect(computeSwipeIntent({ dx: 120, dy: 110, vx: 2 })).toMatchObject({
      kind: 'commit',
      direction: 'right',
    })
  })

  it('honours custom action maps and thresholds', () => {
    expect(
      computeSwipeIntent({ dx: 50, dy: 0 }, { distanceThreshold: 40, actions: { right: 'save' } }),
    ).toMatchObject({ kind: 'commit', action: 'save' })
  })

  it('treats non-finite geometry as no movement', () => {
    expect(computeSwipeIntent({ dx: Number.NaN, dy: 0 })).toEqual({
      kind: 'cancel',
      reason: 'below-threshold',
    })
  })

  it('resolves the direction from the dominant axis', () => {
    expect(resolveDirection(0, 0)).toBeNull()
    expect(resolveDirection(10, -10)).toBe('right')
    expect(resolveDirection(-10, 20)).toBe('down')
    expect(resolveDirection(3, -20)).toBe('up')
  })

  it('reports bounded progress toward the threshold', () => {
    expect(swipeProgress(0, 0)).toBe(0)
    expect(swipeProgress(48, 0)).toBe(0.5)
    expect(swipeProgress(400, 0)).toBe(1)
    expect(swipeProgress(400, 0, 0)).toBe(1)
  })
})

describe('keyboard map', () => {
  it('maps arrows to their default actions', () => {
    expect(keyIntent('ArrowRight')).toEqual({ kind: 'swipe', direction: 'right', action: 'like' })
    expect(keyIntent('ArrowDown')).toEqual({ kind: 'swipe', direction: 'down', action: 'later' })
  })

  it('maps u to undo case-insensitively and can disable it', () => {
    expect(keyIntent('u')).toEqual({ kind: 'undo' })
    expect(keyIntent('U', { undoKey: false })).toBeNull()
  })

  it('ignores unrelated keys and respects custom mappings', () => {
    expect(keyIntent('Enter')).toBeNull()
    expect(keyIntent('d', { keymap: { d: 'right' }, actions: { right: 'save' } })).toEqual({
      kind: 'swipe',
      direction: 'right',
      action: 'save',
    })
  })

  it('renders one button per direction with matching labels', () => {
    const buttons = actionButtons()
    expect(buttons.map((button) => button.direction)).toEqual(['left', 'right', 'up', 'down'])
    expect(buttons.map((button) => button.action)).toEqual([
      'dislike',
      'like',
      'superlike',
      'later',
    ])
    expect(buttons[1]?.ariaLabel).toBe('Like (Right)')
    expect(ACTION_LABELS.like).toBe('Like')
    expect(DEFAULT_DIRECTION_ACTIONS.up).toBe('superlike')
  })
})

describe('gesture controller', () => {
  it('emits drag intents and writes transform variables during a drag', () => {
    const { element, events } = setup()
    element.emit('pointerdown', pointer({ clientX: 10, clientY: 10, timeStamp: 0 }))
    element.emit('pointermove', pointer({ clientX: 70, clientY: 10, timeStamp: 20 }))

    expect(events[0]).toMatchObject({
      kind: 'drag',
      dx: 60,
      dy: 0,
      direction: 'right',
      progress: 0.625,
    })
    expect(element.styleValues.get('--swl-drag-x')).toBe('60px')
    expect(element.styleValues.get('--swl-drag-progress')).toBe('0.625')
    expect(element.captured).toEqual([1])
  })

  it('commits on release and clears the variables', () => {
    const { element, events } = setup()
    element.emit('pointerdown', pointer({ clientX: 0, clientY: 0, timeStamp: 0 }))
    element.emit('pointermove', pointer({ clientX: 130, clientY: 0, timeStamp: 40 }))
    element.emit('pointerup', pointer({ clientX: 130, clientY: 0, timeStamp: 50 }))

    expect(events.at(-1)).toMatchObject({ kind: 'commit', direction: 'right', action: 'like' })
    expect(element.styleValues.size).toBe(0)
  })

  it('cancels a short drag on release', () => {
    const { element, events } = setup()
    element.emit('pointerdown', pointer({ clientX: 0, clientY: 0, timeStamp: 0 }))
    element.emit('pointerup', pointer({ clientX: 12, clientY: 4, timeStamp: 400 }))
    expect(events.at(-1)).toEqual({ kind: 'cancel', reason: 'below-threshold' })
  })

  it('emits pointer-cancel when the browser cancels the gesture', () => {
    const { element, events } = setup()
    element.emit('pointerdown', pointer())
    element.emit('pointercancel', pointer())
    expect(events.at(-1)).toEqual({ kind: 'cancel', reason: 'pointer-cancel' })
  })

  it('writes no transform variables when motion is reduced', () => {
    const { element, events } = setup({ reducedMotion: true })
    element.emit('pointerdown', pointer())
    element.emit('pointermove', pointer({ clientX: 80 }))
    element.emit('pointerup', pointer({ clientX: 80, timeStamp: 10 }))
    expect(element.styleValues.size).toBe(0)
    expect(events.at(-1)).toMatchObject({ kind: 'commit' })
  })

  it('ignores secondary mouse buttons and extra pointers', () => {
    const { element, events } = setup()
    element.emit('pointerdown', pointer({ pointerType: 'mouse', button: 2 }))
    element.emit('pointermove', pointer({ clientX: 200 }))
    expect(events).toHaveLength(0)
  })

  it('detaches every listener on destroy', () => {
    const { element, events, controller } = setup()
    expect(element.listenerCount()).toBe(4)
    controller.destroy()
    expect(element.listenerCount()).toBe(0)
    element.emit('pointerdown', pointer())
    expect(events).toHaveLength(0)
  })

  it('does not touch matchMedia when it is absent', () => {
    expect(typeof globalThis.matchMedia).toBe('undefined')
    expect(prefersReducedMotion()).toBe(false)
  })
})
