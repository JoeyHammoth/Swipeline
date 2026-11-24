# @swipeline/react

The first Swipeline binding: render a `DeckStore` as an accessible deck.

```tsx
import { SwipeDeck } from '@swipeline/react'

<SwipeDeck store={deck} renderCard={(card) => <h2>{card.title}</h2>} />
```

- `useDeck(store)` wraps `useSyncExternalStore` with the stable server snapshot,
  so SSR hydrates without a mismatch.
- Every direction has a button and an arrow-key shortcut; `U` undoes. The same
  `@swipeline/gestures` map drives pointer drags.
- Card changes are announced in a polite live region and focus returns to the
  deck container after a swipe, never into the card body.
- Loading, exhausted, error and offline states render and recover.
- React is a peer dependency only; no CSS-in-JS runtime, no default styles.

Apache-2.0.
