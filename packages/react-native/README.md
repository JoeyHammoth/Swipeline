# `@swipeline/react-native`

React Native and Expo binding for Swipeline decks: a `<SwipeDeck>` over the same
headless engine, card templates and string catalog as the web bindings.

```bash
npm install @swipeline/core @swipeline/react-native
```

`react` and `react-native` are peers. Nothing else is required: drags use
`PanResponder` and layout uses plain `View`/`Text`/`Pressable`, so there is no
Gesture Handler install, no Reanimated Babel plugin and no custom dev client —
it runs in Expo Go.

## Usage

```tsx
import { createEngine } from '@swipeline/core'
import { createMemoryStores } from '@swipeline/store-memory'
import { SwipeDeck } from '@swipeline/react-native'

const store = createEngine({ deckId: 'books', actor: 'me', source, stores })

export default function App() {
  return (
    <SwipeDeck
      store={store}
      template="media"
      actions={{ right: 'like', left: 'skip' }}
      renderCard={(card) => <Text>{card.title}</Text>}
    />
  )
}
```

| Prop | Purpose |
|---|---|
| `store` | The `DeckStore` from `createEngine`; the component never copies its state |
| `label` | Accessible name for the deck |
| `actions` | Per-direction action overrides, shared by buttons and drags |
| `template` | Built-in card template (`text`, `media`, `facts`) |
| `renderCard` | Replace the card body entirely |
| `renderEmpty` | Replace the exhausted message |
| `messages`, `locale` | Partial string catalog and BCP 47 locale |
| `reducedMotion` | Skip the drag transform |

`useDeck(store)` exposes the snapshot, and `intentFromGesture` /
`announcementFor` are exported so a custom shell can reuse the decision math and
the announcement text.

## What is shared and what is not

Shared with the web bindings: `DeckStore`, snapshots and commands, the ranking
pipeline, `computeSwipeIntent`, the card templates, the i18n catalog and the
`Card`/`SwipeEvent` schemas. Native-only: the gesture plumbing, layout and
styling, and `AccessibilityInfo` announcements instead of an `aria-live` region.

Storage is the consumer's choice; `store-indexeddb` does not exist in React
Native, so use `store-memory`, a SQLite store, or the server.

## Verification status

The binding typechecks against `react-native` 0.88 and is tested with
`react-test-renderer` against a mocked React Native surface: render from the
snapshot, one control per action, undo, the exhausted state, the announcement
call and teardown. The gesture decision math is covered separately by unit tests.

It has **not** been run on a device, simulator or emulator, and there is no Expo
example app yet, so the native half of the binding is unverified here. See
[Binding status](https://github.com/JoeyHammoth/Swipeline/blob/main/docs/reference/binding-status.md).
