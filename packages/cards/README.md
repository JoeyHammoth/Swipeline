# @swipeline/cards

Framework-free card templates. A template picks which fields of a
[`Card`](https://swipeline.dev/concepts/cards-and-adapters) render; the binding
decides the markup, so React, the Web Component and React Native stay in step.

```ts
import { cardView } from '@swipeline/cards'

const view = cardView(card, 'facts')
// { template: 'facts', title, subtitle, media: [hero], facts: [...], attribution }
```

| Template | Shows |
|---|---|
| `text` | title, subtitle, tags, body |
| `media` | hero image, title, subtitle, tags |
| `facts` | hero image, title, subtitle, facts strip |

```tsx
<SwipeDeck store={store} template="facts" />
```

- Attribution is always carried through, because some sources require credit.
- Missing media and missing facts are normal: cards are rendered, not rejected.
- An unknown template throws instead of rendering a guess.
- `CARD_TEMPLATES` and `isCardTemplate` validate values coming from a manifest.

`compare` is not here yet: it needs two cards at once, which is a different
snapshot shape.
