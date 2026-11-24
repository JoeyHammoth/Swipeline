# @swipeline/gestures

Framework-free pointer, keyboard and reduced-motion controller for Swipeline
decks. Shared by the web bindings; the decision math is also reused by the React
Native binding.

```ts
import { computeSwipeIntent, createGestureController } from '@swipeline/gestures'

const controller = createGestureController({
  element: cardEl,
  onIntent: (intent) => {
    if (intent.kind === 'commit') deck.dispatch({ type: 'swipe', action: intent.action, cardId })
  },
})
```

- `computeSwipeIntent({dx, dy, vx, vy})` is pure and DOM-free. A dominant-axis
  drag past 96px, or any flick past 0.6px/ms, commits; a slow diagonal is
  cancelled rather than guessed.
- `createGestureController` tracks one pointer, writes `--swl-drag-x`,
  `--swl-drag-y`, `--swl-drag-rotate` and `--swl-drag-progress`, and emits
  `drag`, `commit` and `cancel`.
- `keyIntent(key)` maps arrows to actions and `u` to undo; `actionButtons()`
  returns the matching button set (label, ARIA label, shortcut).
- Reduced motion is detected through `matchMedia` and never at import time.

Apache-2.0. See the repository [LICENSE](../../LICENSE).
