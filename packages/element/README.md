# @swipeline/element

The framework-free reference binding: one custom element, DOM events out, no
dependency on a UI framework.

```ts
import '@swipeline/element'
import { createEngine } from '@swipeline/core'

const deck = document.querySelector('swipe-deck')
deck.store = createEngine({ deckId: 'books', actor: 'reader', source })
deck.addEventListener('swipe', (event) => console.log(event.detail))
```

- Properties: `store` (`DeckStore`), `renderCard(card)`, `actions`.
- Attributes: `label`, `reduced-motion`.
- Events: `swipe` (`{ action, cardId }`) and `undo`, both bubbling and composed.
- Styling: CSS custom properties (`--swl-accent`, `--swl-radius`, `--swl-gap`,
  `--swl-duration`) and `::part(card|actions|button|live)`.
- Custom cards: either the `renderCard` property or a light-DOM child with
  `slot="card"`, which replaces the default template.
- Accessibility: `role="application"`, arrow keys, `u` to undo, a polite live
  region, visible focus and reduced-motion support.

The element renders into open shadow DOM, and registration is guarded so it can
be imported in SSR and tests without a DOM.
