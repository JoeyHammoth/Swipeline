# Add Swipeline to an existing app

Swipeline does not own your app shell, router, auth or design system. It owns the
deck: fetching, ranking, swipe semantics and history.

## 1. Install the pieces you need

| Piece | Package | Required |
|---|---|---|
| Engine and schemas | `@swipeline/core` | Yes |
| A UI binding | `@swipeline/react`, `@swipeline/element`, … | Yes, unless headless |
| Something to read from | `@swipeline/adapters` or your own adapter | Yes |
| Persistence | `@swipeline/store-indexeddb` (web) or a server store | No, memory works |

## 2. Define the deck

```ts
// deck.config.ts
import { defineDeck } from '@swipeline/core'
import { httpJson } from '@swipeline/adapters'
import { indexedDbStore } from '@swipeline/store-indexeddb'

export const deck = defineDeck({
  id: 'my-things',
  source: httpJson({
    id: 'my-api',
    url: 'https://api.example.com/things?page={page}',
    pagination: { type: 'page', param: 'page' },
    itemsPath: 'results',
    map: {
      id: 'slug',
      title: 'name',
      subtitle: 'brand',
      body: 'description',
      tags: 'categories',
      media: [{ kind: 'image', url: 'image.url', alt: 'image.alt' }],
      facts: [{ label: 'Price', value: 'price', unit: 'USD' }],
      url: 'permalink',
    },
  }),
  store: indexedDbStore({ name: 'my-app' }),
})
```

Everything in `map` is serializable, which means this deck can be exported as a
manifest and shared. Anything that needs code becomes a typed adapter or a rank
stage instead (see [Deck configuration](/reference/config)).

## 3. Choose the identity model

`actor` is a pseudonymous id, not a user record. In a browser app a per-profile
uuid stored locally is enough. If you have real accounts, hash or map them
server-side and pass the opaque id in — Swipeline never needs PII.

```ts
createEngine({ deckId: deck.id, actor: () => getOrCreateLocalActorId(), source: deck.source })
```

## 4. Gate what leaves the device

Tier 1 stores nothing off-device. If you add sinks or the server, pass a
`ConsentPolicy`:

```ts
createEngine({
  // ...
  consent: (event) => userPreferences.analyticsEnabled || event.action === 'undo',
})
```

Consent is evaluated per event, before logging or delivery. `undo` is always
recorded so the log stays coherent.

## 5. Mind these integration details

- **SSR:** render the deck only after hydration, or use `getServerSnapshot()`
  and pre-ranked cards. The engine does no work at import time.
- **Styles:** default styles are plain CSS with custom properties. Override
  tokens rather than fighting specificity.
- **Accessibility:** keep the built-in buttons visible or provide equivalents.
  A gesture-only deck fails the accessibility contract.
- **Error states:** render `error`, `offline` and `exhausted` explicitly; the
  snapshot tells you which one you are in.
