# Books (Expo)

The native smoke app for `@swipeline/react-native`. It mounts a deck from a fixed
offline source, then runs a scripted swipe on launch: refill, like the first card,
advance, and confirm the like landed in the event log. The result is printed at
the top of the screen with a ✓ or ✗.

```bash
pnpm build                     # the binding ships compiled output
pnpm --filter swipeline-example-books-expo dev
```

`pnpm examples:build` bundles both platforms with `expo export`. Two workflows go
further, weekly and on demand because each needs a native build and a device
runtime:

- `.github/workflows/android.yml` prebuilds, assembles the release APK, installs
  it on an emulator and fails unless `uiautomator` sees the like on screen
  (`scripts/android-smoke.sh`). It then reads the accessibility tree and fails
  unless the deck root and at least three controls expose labels — what TalkBack
  would be offered, though TalkBack itself is not driven.
- `.github/workflows/ios.yml` prebuilds, builds a Release app with `xcodebuild`,
  installs it on an iPhone simulator and reads `Documents/smoke.txt` from the app
  container (`scripts/ios-smoke.sh`) — a release build's `console.log` never
  reaches the simulator log, so the app writes its result to that file as well as
  to the screen. It then adds a UI test target to the generated project and reads
  the iOS accessibility tree, failing unless at least three controls carry labels
  and no control is unlabelled.

The deck is a local fixture rather than the shared `examples/shared/decks.ts`
factory, so a smoke result never depends on a remote API. The rest of the example
apps still share the one deck config.
