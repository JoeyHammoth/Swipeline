import {
  computeSwipeIntent,
  resolveDirection,
  type SwipeDirection,
  type SwipeIntent,
  type SwipeIntentOptions,
  swipeProgress,
} from './intent.js'

/** A live drag, emitted before any commit decision. */
export interface GestureDrag {
  kind: 'drag'
  dx: number
  dy: number
  /** 0–1 toward the distance threshold. */
  progress: number
  direction: SwipeDirection | null
}

export type GestureEvent = GestureDrag | SwipeIntent

export interface GestureControllerOptions extends SwipeIntentOptions {
  /** The element that receives pointer events and CSS custom properties. */
  element: HTMLElement
  onIntent: (event: GestureEvent) => void
  /**
   * Skip transform output. Defaults to `prefers-reduced-motion`; bindings may
   * also pass `true` from their own setting.
   */
  reducedMotion?: boolean
  /** Pointer history used for velocity, in milliseconds. Defaults to 100. */
  velocityWindowMs?: number
}

export interface GestureController {
  readonly dragging: boolean
  destroy(): void
}

interface Sample {
  x: number
  y: number
  t: number
}

const VELOCITY_WINDOW_MS = 100
const MAX_SAMPLES = 16

/** Guarded so importing this module on the server is safe. */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function setVar(element: HTMLElement, name: string, value: string): void {
  element.style?.setProperty?.(name, value)
}

function removeVar(element: HTMLElement, name: string): void {
  element.style?.removeProperty?.(name)
}

/**
 * Attaches pointer handling to one element and writes the transform variables a
 * theme can consume (`--swl-drag-x`, `--swl-drag-y`, `--swl-drag-rotate`,
 * `--swl-drag-progress`). It knows nothing about the engine: the caller turns a
 * commit into `dispatch({type:'swipe'})`.
 */
export function createGestureController(options: GestureControllerOptions): GestureController {
  const { element, onIntent } = options
  const motionAllowed = !(options.reducedMotion ?? prefersReducedMotion())
  const velocityWindow = options.velocityWindowMs ?? VELOCITY_WINDOW_MS
  const distanceThreshold = options.distanceThreshold

  let pointerId: number | undefined
  let samples: Sample[] = []

  function writeDrag(dx: number, dy: number): void {
    if (!motionAllowed) return
    setVar(element, '--swl-drag-x', `${dx}px`)
    setVar(element, '--swl-drag-y', `${dy}px`)
    setVar(element, '--swl-drag-rotate', `${dx * 0.02}deg`)
    setVar(element, '--swl-drag-progress', String(swipeProgress(dx, dy, distanceThreshold)))
  }

  function reset(): void {
    pointerId = undefined
    samples = []
    if (!motionAllowed) return
    removeVar(element, '--swl-drag-x')
    removeVar(element, '--swl-drag-y')
    removeVar(element, '--swl-drag-rotate')
    removeVar(element, '--swl-drag-progress')
  }

  function velocity(): { vx: number; vy: number } {
    const last = samples.at(-1)
    const first = samples[0]
    if (!last || !first || samples.length < 2) return { vx: 0, vy: 0 }
    const start = samples.find((sample) => last.t - sample.t <= velocityWindow) ?? first
    const dt = Math.max(1, last.t - start.t)
    return { vx: (last.x - start.x) / dt, vy: (last.y - start.y) / dt }
  }

  function onPointerDown(event: PointerEvent): void {
    if (pointerId !== undefined) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerId = event.pointerId
    samples = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }]
    try {
      element.setPointerCapture?.(event.pointerId)
    } catch {
      // Capture is best effort; pointermove on the element still works.
    }
    writeDrag(0, 0)
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    const first = samples[0]
    if (!first) return
    samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
    if (samples.length > MAX_SAMPLES) samples.shift()
    const dx = event.clientX - first.x
    const dy = event.clientY - first.y
    writeDrag(dx, dy)
    onIntent({
      kind: 'drag',
      dx,
      dy,
      progress: swipeProgress(dx, dy, distanceThreshold),
      direction: resolveDirection(dx, dy),
    })
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    const first = samples[0]
    const dx = first ? event.clientX - first.x : 0
    const dy = first ? event.clientY - first.y : 0
    const { vx, vy } = velocity()
    try {
      element.releasePointerCapture?.(event.pointerId)
    } catch {
      // Nothing to release.
    }
    reset()
    onIntent(computeSwipeIntent({ dx, dy, vx, vy }, options))
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    reset()
    onIntent({ kind: 'cancel', reason: 'pointer-cancel' })
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerCancel)

  return {
    get dragging(): boolean {
      return pointerId !== undefined
    },
    destroy(): void {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerCancel)
      reset()
    },
  }
}
