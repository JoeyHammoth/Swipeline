# @swipeline/svelte

The Svelte 5 binding: one component, the same behaviour and accessibility
contract as the React and Vue bindings, and the shared card templates and string
catalog.

```svelte
<script lang="ts">
  import { createEngine } from '@swipeline/core'
  import { SwipeDeck } from '@swipeline/svelte'
  import { deck } from './deck.config'

  const store = createEngine({ ...deck, events: eventsStore })
</script>

<SwipeDeck {store} template="facts" label="Books to read" />
```

- Props: `store` (`DeckStore`), `label`, `actions`, `template` (`text`, `media`,
  `facts`), `messages`, `locale`, `reducedMotion`.
- Snippets: `card` receives the card; `empty` replaces the exhausted message.
- Behaviour: pointer and arrow-key swipes, `u` to undo, a polite live region,
  focus returned to the deck after a swipe, and reduced motion respected.
- Text comes from `@swipeline/i18n`; a partial `messages` catalog falls back to
  English per key.
- Styling: style the root and `[data-action]` buttons yourself, or import the
  tokens from `@swipeline/theme`.

```svelte
<SwipeDeck {store}>
  {#snippet card(card)}
    <h2>{card.title}</h2>
    <p>{card.subtitle}</p>
  {/snippet}
</SwipeDeck>
```

`SwipeDeckProps` is exported for wrappers and tests.

## Packaging

This package publishes the component as `.svelte` source, which your bundler
compiles against the Svelte version in your app — the usual arrangement for
Svelte libraries, and the reason there is no prebuilt CJS entry. The script block
is TypeScript, which SvelteKit and `vite-plugin-svelte` preprocess by default; a
custom toolchain needs `vitePreprocess`.

`svelte` is a peer dependency of at least 5.0; this package ships no runtime of
its own.

Because of that, `pnpm attw` runs against this package with two rules ignored:
`cjs-resolves-to-esm` (there is no CommonJS entry by design) and
`internal-resolution-error` (the declarations re-export a `.svelte` file, which
only a Svelte-aware toolchain resolves — `svelte-check` and SvelteKit both do).
