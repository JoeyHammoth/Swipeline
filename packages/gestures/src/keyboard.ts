import type { SwipeAction } from '@swipeline/core'
import { DEFAULT_DIRECTION_ACTIONS, type SwipeDirection } from './intent.js'

/** Arrow keys by default; every action also has a button in a binding. */
export const DEFAULT_KEYMAP: Readonly<Record<string, SwipeDirection>> = Object.freeze({
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
})

export type KeyIntent =
  | { kind: 'swipe'; action: SwipeAction; direction: SwipeDirection }
  | { kind: 'undo' }
  | null

export interface KeyIntentOptions {
  keymap?: Readonly<Record<string, SwipeDirection>>
  actions?: Partial<Record<SwipeDirection, SwipeAction>>
  /** Undo shortcut, `u` by default. Pass `false` to disable it. */
  undoKey?: string | false
}

/** Maps a `KeyboardEvent.key` to a deck command. Case-insensitive for letters. */
export function keyIntent(key: string, options: KeyIntentOptions = {}): KeyIntent {
  const undoKey = options.undoKey ?? 'u'
  if (undoKey !== false && key.toLowerCase() === undoKey.toLowerCase()) return { kind: 'undo' }

  const direction = (options.keymap ?? DEFAULT_KEYMAP)[key]
  if (direction === undefined) return null
  const action = options.actions?.[direction] ?? DEFAULT_DIRECTION_ACTIONS[direction]
  return { kind: 'swipe', action, direction }
}

export const ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  like: 'Like',
  dislike: 'Dislike',
  superlike: 'Superlike',
  later: 'Later',
  skip: 'Skip',
  undo: 'Undo',
})

export interface ActionButton {
  direction: SwipeDirection
  action: SwipeAction
  label: string
  /** Includes the shortcut so screen-reader users can learn it. */
  ariaLabel: string
  shortcut: string
}

/**
 * The button set a binding renders: one per direction, in a stable order, with
 * the label and shortcut that match `keyIntent`.
 */
export function actionButtons(
  options: {
    actions?: Partial<Record<SwipeDirection, SwipeAction>>
    keymap?: Readonly<Record<string, SwipeDirection>>
  } = {},
): ActionButton[] {
  const keymap = options.keymap ?? DEFAULT_KEYMAP
  const directions: SwipeDirection[] = ['left', 'right', 'up', 'down']
  return directions.map((direction) => {
    const action = options.actions?.[direction] ?? DEFAULT_DIRECTION_ACTIONS[direction]
    const shortcut =
      Object.keys(keymap).find((key) => keymap[key] === direction) ?? 'Arrow' + direction
    const label = ACTION_LABELS[action] ?? action
    return {
      direction,
      action,
      label,
      ariaLabel: `${label} (${shortcut.replace('Arrow', '')})`,
      shortcut,
    }
  })
}
