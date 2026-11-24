# React Native

The React Native binding shares the engine, the event log and the swipe decision
math with the web. It does not share the DOM gesture module — React Native has no
DOM, so gestures use Gesture Handler and animation uses Reanimated, both as peer
dependencies.

## Install (M4 target)

```bash
npx expo install react-native-reanimated react-native-gesture-handler
npm install @swipeline/core @swipeline/react-native @swipeline/store-indexeddb
```

Reanimated and Gesture Handler are peers so your app owns their versions; a
duplicate copy of either is a common source of broken gestures.

## Usage

```tsx
import { SwipeDeck } from '@swipeline/react-native'
import { books } from './deck.config'

export default function App() {
  return (
    <SwipeDeck
      deck={books}
      query="science fiction"
      theme={{ accent: '#25c2a0', radiusCard: 18 }}
      renderCard={(card) => (
        <View>
          <Text>{card.title}</Text>
          <Text>{card.subtitle}</Text>
        </View>
      )}
    />
  )
}
```

## What is shared and what is not

| Shared | Native-specific |
|---|---|
| `DeckStore`, snapshots, commands | Gesture composition (Gesture Handler) |
| Ranking pipeline and profiles | Animation driver (Reanimated) |
| `computeSwipeIntent` decision math | Layout, shadows, image components |
| Card and event schemas | Storage (see below) |
| Consent, export, erase | Deep links, app lifecycle |

The gesture *decision* (`distance + velocity → action`) is a pure function in
`@swipeline/gestures`, so a swipe feels the same on iOS, Android and web even
though the input plumbing differs.

## Storage on device

| Store | Notes |
|---|---|
| `store-memory` | Fine for prototypes; history is lost on restart |
| SQLite (via a Nitro/SQLite binding) | Planned; the same `EventStore` interface |
| Server (Tier 2) | Needed for multi-device sync |

IndexedDB does not exist in React Native. Do not import `store-indexeddb` there.

## Accessibility on mobile

- Provide visible action buttons; TalkBack and VoiceOver users cannot perform a
  drag reliably.
- Announce card changes with `AccessibilityInfo.announceForAccessibility`.
- Respect the OS reduce-motion setting for the card stack animation.

## Testing

The Expo smoke app in `examples/books-expo` runs in CI: it mounts a deck with a
memory store, performs a scripted like, and asserts the event was recorded. Native
conformance is a subset of the web suite: render, button actions, undo, states and
lifecycle, but not keyboard focus or SSR.
