import type { SwipeAction } from '@swipeline/core'

/** The four gesture directions a deck maps to actions. */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

/** A pointer displacement and (optionally) its velocity in px/ms. */
export interface SwipeGeometry {
  dx: number
  dy: number
  vx?: number
  vy?: number
}

export interface SwipeIntentOptions {
  /** Dominant-axis distance that commits without a flick. Defaults to 96px. */
  distanceThreshold?: number
  /** Speed in px/ms that commits a short flick. Defaults to 0.6. */
  velocityThreshold?: number
  /** Per-direction overrides. Unmapped directions keep the defaults. */
  actions?: Partial<Record<SwipeDirection, SwipeAction>>
  /** Secondary/dominant ratio above which a slow diagonal is ambiguous. Defaults to 0.8. */
  axisRatio?: number
}

export interface SwipeCommit {
  kind: 'commit'
  direction: SwipeDirection
  action: SwipeAction
  /** Dominant-axis distance in px. */
  distance: number
  /** Speed in px/ms. */
  velocity: number
}

export type SwipeCancelReason = 'below-threshold' | 'ambiguous' | 'pointer-cancel'

export interface SwipeCancel {
  kind: 'cancel'
  reason: SwipeCancelReason
}

export type SwipeIntent = SwipeCommit | SwipeCancel

export const DEFAULT_DISTANCE_THRESHOLD = 96
export const DEFAULT_VELOCITY_THRESHOLD = 0.6
export const DEFAULT_AXIS_RATIO = 0.8

/** Plan §5.4: right like, left dislike, up superlike, down later. */
export const DEFAULT_DIRECTION_ACTIONS: Readonly<Record<SwipeDirection, SwipeAction>> =
  Object.freeze({
    right: 'like',
    left: 'dislike',
    up: 'superlike',
    down: 'later',
  })

/** The dominant axis, or `null` when the pointer has not moved. */
export function resolveDirection(dx: number, dy: number): SwipeDirection | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (dx === 0 && dy === 0) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

/** 0–1 progress toward the commit threshold, for transform and opacity CSS. */
export function swipeProgress(
  dx: number,
  dy: number,
  distanceThreshold: number = DEFAULT_DISTANCE_THRESHOLD,
): number {
  if (!Number.isFinite(distanceThreshold) || distanceThreshold <= 0) return 1
  return Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / distanceThreshold)
}

/**
 * Turns a drag into a commit or a cancel. Pure, DOM-free and shared with React
 * Native, so a swipe means the same thing on every platform.
 *
 * A slow diagonal whose axes are too close to call is cancelled rather than
 * guessed; a fast flick in any direction commits the dominant axis.
 */
export function computeSwipeIntent(
  geometry: SwipeGeometry,
  options: SwipeIntentOptions = {},
): SwipeIntent {
  const distanceThreshold = options.distanceThreshold ?? DEFAULT_DISTANCE_THRESHOLD
  const velocityThreshold = options.velocityThreshold ?? DEFAULT_VELOCITY_THRESHOLD
  const axisRatio = options.axisRatio ?? DEFAULT_AXIS_RATIO

  const dx = Number.isFinite(geometry.dx) ? geometry.dx : 0
  const dy = Number.isFinite(geometry.dy) ? geometry.dy : 0
  const vx = Number.isFinite(geometry.vx ?? 0) ? (geometry.vx ?? 0) : 0
  const vy = Number.isFinite(geometry.vy ?? 0) ? (geometry.vy ?? 0) : 0

  const direction = resolveDirection(dx, dy)
  const dominant = Math.max(Math.abs(dx), Math.abs(dy))
  const secondary = Math.min(Math.abs(dx), Math.abs(dy))
  const velocity = Math.hypot(vx, vy)

  if (direction === null) return { kind: 'cancel', reason: 'below-threshold' }

  const strong = dominant >= distanceThreshold || velocity >= velocityThreshold
  if (!strong) return { kind: 'cancel', reason: 'below-threshold' }

  if (dominant > 0 && secondary / dominant >= axisRatio && velocity < velocityThreshold) {
    return { kind: 'cancel', reason: 'ambiguous' }
  }

  const action = options.actions?.[direction] ?? DEFAULT_DIRECTION_ACTIONS[direction]
  return { kind: 'commit', direction, action, distance: dominant, velocity }
}
