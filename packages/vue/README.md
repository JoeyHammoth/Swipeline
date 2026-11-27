# @swipeline/vue

The Vue 3 binding: one component, the same behaviour and accessibility contract
as the React binding, and the shared card templates and string catalog.

```vue
<script setup lang="ts">
import { createEngine } from '@swipeline/core'
import { SwipeDeck } from '@swipeline/vue'
import { deck } from './deck.config'

const store = createEngine({ ...deck, events: stores.events })
</script>

<template>
  <SwipeDeck :store="store" template="facts" label="Books to read" />
</template>
```

- Props: `store` (`DeckStore`), `label`, `actions`, `template` (`text`, `media`,
  `facts`), `messages`, `locale`, `reducedMotion`.
- Slots: `card` receives `{ card }`; `empty` replaces the exhausted message.
- Behaviour: pointer and arrow-key swipes, `u` to undo, a polite live region,
  focus returned to the deck after a swipe, and reduced motion respected.
- Text comes from `@swipeline/i18n`; a partial `messages` catalog falls back to
  English per key.
- Styling: style the root and `[data-action]` buttons yourself, or import the
  tokens from `@swipeline/theme`. The React stylesheet is not shared, because
  class names here are the same but the markup is not.

```vue
<SwipeDeck :store="store">
  <template #card="{ card }">
    <h2>{{ card.title }}</h2>
    <p>{{ card.subtitle }}</p>
  </template>
</SwipeDeck>
```

`vue` is a peer dependency; this package ships no Vue runtime of its own.
