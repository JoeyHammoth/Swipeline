# React Native

`@swipeline/react-native` renders a deck with the same engine, card templates and
string catalog as the web bindings. It does not share the DOM gesture module —
React Native has no DOM — so drags are handled natively, while the *decision*
(`distance + velocity → action`) stays the shared `computeSwipeIntent` function.

## Install

```bash
npm install @swipeline/core @swipeline/react-native @swipeline/store-memory
```

`react` and `react-native` are peers, so your app owns their versions. There is
nothing else to install: the binding uses `PanResponder` and the core `View` /
`Text` / `Pressable` components, which means no Gesture Handler setup, no
Reanimated Babel plugin and no custom dev client. It runs in Expo Go.

## Usage

```tsx
import { createEngine } from '@swipeline/core'
import { createMemoryStores } from '@swipeline/store-memory'
import { SwipeDeck } from '@swipeline/react-native'
import { books } from './deck.config'

const store = createEngine({
  deckId: 'books',
  actor: 'me',
  source: books,
  stores: createMemoryStores(),
})

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

The component takes the `DeckStore` rather than a deck definition, so the same
store can feed another surface (a web view, a details screen) without copying
state.

| Prop | Purpose |
|---|---|
| `store` | The `DeckStore` from `createEngine` |
| `label` | Accessible name for the deck; defaults to the translated one |
| `actions` | Per-direction action overrides, shared by buttons and drags |
| `template` | Built-in card template (`text`, `media`, `facts`) |
| `renderCard` | Replace the card body entirely |
| `renderEmpty` | Replace the exhausted message |
| `messages`, `locale` | Partial string catalog and BCP 47 locale |
| `reducedMotion` | Skip the drag transform |

Three helpers are exported for a custom shell: `useDeck(store)` for the
snapshot, `intentFromGesture(sample)` for the decision math (points and points
per millisecond, which is what `PanResponder` reports), and
`announcementFor(card, position, t)` for the spoken text.

## What is shared and what is not

| Shared | Native-specific |
|---|---|
| `DeckStore`, snapshots, commands | Gesture plumbing (`PanResponder`) |
| Ranking pipeline and profiles | Layout, styling, image component |
| `computeSwipeIntent` decision math | `AccessibilityInfo` announcements |
| Card templates and string catalog | Deep links, app lifecycle |
| Card and event schemas | Storage (see below) |

## Storage on device

| Store | Notes |
|---|---|
| `store-memory` | Fine for prototypes; history is lost on restart |
| SQLite | Planned; the same `EventStore` interface |
| Server (Tier 2) | Needed for multi-device sync |

IndexedDB does not exist in React Native. Do not import `store-indexeddb` there.

## Accessibility on mobile

- Keep the action buttons: TalkBack and VoiceOver users cannot perform a drag
  reliably. The binding renders one `Pressable` per action plus undo, with
  `accessibilityRole="button"` and a disabled state.
- Card changes are announced with `AccessibilityInfo.announceForAccessibility`,
  because a changed `Text` is not read on its own.
- The drag transform is skipped when `reducedMotion` is set; read the OS setting
  and pass it in.

## Verification status

The binding typechecks against React Native 0.88 and its render tests run with
`react-test-renderer` against a mocked React Native surface: render from the
snapshot, one control per action, undo, the exhausted state, the announcement
call and teardown. The decision math has its own unit tests.

`examples/books-expo` is the smoke app: it mounts the deck from a fixed offline
source, runs a scripted swipe on launch (refill, like the first card, advance,
confirm the like reached the event log) and prints the result on screen. That
script is unit-tested in Node, and `pnpm examples:build` bundles the app for iOS
and Android with `expo export`, so the app is known to compile for both platforms.

Two workflows run it for real, weekly and on demand:

- `android.yml` prebuilds, assembles the release APK (debug signing), installs it
  on an API 34 x86_64 emulator, launches the activity, and fails unless
  `uiautomator` sees the like on screen.
- `ios.yml` prebuilds, builds a Release app with `xcodebuild` on macOS 26 (the
  Swift 6.2 that `ExpoModulesJSI` needs), boots an iPhone simulator, installs and
  launches. A release build's `console.log` never reaches the simulator log, so
  the app writes its result into its own Documents directory and the job reads it
  with `simctl get_app_container`. It then adds a UI test target to the generated
  project and reads the accessibility tree, failing if fewer than three labelled
  controls appear or any control is unlabelled.

Both green — Android on 2026-11-27 and iOS on 2026-11-28, where the run reported
`pass: liked "Project Hail Mary"` and the same five labelled controls the Android
tree shows. A screen reader has still not been attached on either platform, so
what it says and how the layout reads to a person are unverified; the
[screen-reader script](/reference/a11y-manual-script) is the pass that closes
that. See
[Binding status](/reference/binding-status) and the
[accessibility audit](/reference/a11y-audit).
