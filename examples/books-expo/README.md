# Books (Expo)

The native smoke app for `@swipeline/react-native`. It mounts a deck from a fixed
offline source, then runs a scripted swipe on launch: refill, like the first card,
advance, and confirm the like landed in the event log. The result is printed at
the top of the screen with a ✓ or ✗.

```bash
pnpm build                     # the binding ships compiled output
pnpm --filter swipeline-example-books-expo dev
```

`pnpm examples:build` bundles both platforms with `expo export`. Bundling proves
the app compiles for iOS and Android; it does **not** run it — a device or
simulator is still needed to see the deck, and that run is manual.

The deck is a local fixture rather than the shared `examples/shared/decks.ts`
factory, so a smoke result never depends on a remote API. The rest of the example
apps still share the one deck config.
