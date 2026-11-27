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

- Properties: `store` (`DeckStore`), `renderCard(card)`, `actions`, `template`,
  `messages`.
- Attributes: `label`, `template` (`text`, `media`, `facts`), `reduced-motion`.
- Events: `swipe` (`{ action, cardId }`), `undo` and `error` (an unknown
  `template`), all bubbling and composed.
- Styling: the `@swipeline/theme` tokens (`--swl-color-bg`, `--swl-space-…`) with
  the 0.1-era `--swl-accent`, `--swl-radius`, `--swl-gap` and `--swl-duration`
  still honoured, plus `::part(card|actions|button|live)`.
- Custom cards: `renderCard` for markup built from the card, or a light-DOM child
  with `slot="card"` for static markup.
- Text: `messages` takes a partial catalog from `@swipeline/i18n`; anything it
  omits falls back to English.
- Accessibility: `role="application"`, arrow keys, `u` to undo, a polite live
  region, visible focus and reduced-motion support.

The element renders into open shadow DOM, and registration is guarded so it can
be imported in SSR and tests without a DOM.
