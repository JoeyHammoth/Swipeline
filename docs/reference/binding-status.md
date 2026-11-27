# Binding status

Which UI bindings pass the shared conformance suite, and where. The table records
test results in this repository, not intentions.

| Binding | Package | Status | jsdom suite | Browser suite |
|---|---|---|---|---|
| React | `@swipeline/react` | Official — passing | [`packages/react/test/conformance.test.tsx`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/react/test/conformance.test.tsx) | Chromium |
| Web Component | `@swipeline/element` | Official — passing | [`packages/element/test/element.test.ts`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/element/test/element.test.ts) | Chromium |
| Vue 3 | `@swipeline/vue` | Official — passing | [`packages/vue/test/conformance.test.ts`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/vue/test/conformance.test.ts) | Chromium |
| Svelte 5 | `@swipeline/svelte` | Official — passing | [`packages/svelte/test/conformance.test.ts`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/svelte/test/conformance.test.ts) | Chromium |
| React Native / Expo | `@swipeline/react-native` | Official — Android emulator; iOS unrun | [`packages/react-native/test/swipe-deck.test.tsx`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/react-native/test/swipe-deck.test.tsx) (mocked React Native surface) | Android emulator, weekly |
| Solid, Angular | — | Planned | — | — |

Every binding passes the same seven behaviours through `assertBindingConformance`:
the first card renders from the snapshot, there is at least one control per
action, the root receives pointer gestures, ArrowRight advances, `u` undoes, a
polite live region exists, and `destroy` detaches the root. A failing binding
reports every failure in one `BindingConformanceError`.

## How the browser run works

`e2e.yml` starts the fixture app in `examples/conformance`, which has one page per
binding (`/react.html`, `/element.html`, `/vue.html`, `/svelte.html`). Each page mounts its
binding and exposes
`window.__swipelineConformance`, and `e2e/binding-conformance.spec.ts` calls it in
Chromium, asserting `{ binding, checks: 7 }` and that the page threw nothing.

It runs on pull requests that touch the bindings, the testkit, the fixtures or the
lockfile, plus nightly and on demand. The jsdom suites run in `ci.yml` on every PR.

## What is still not covered

- **Full WCAG coverage.** axe runs with the `wcag2a` and `wcag2aa` tags on every
  fixture page, and the four example decks are scanned nightly. AAA rules and
  real assistive-technology passes are not covered.
- **Hydration equality.** `packages/react/test/ssr.test.tsx` proves the React
  binding renders on the server without a DOM; it does not compare a hydrated tree
  against the server markup.
- **Touch devices.** Browser conformance runs Chromium with mouse pointer events.
  Real touch and assistive-technology testing is manual.
- **React Native.** The binding has no jsdom or browser suite: React Native is
  Flow source that Node cannot load, so its render tests run against a mocked
  `react-native` module, and the drag itself is covered only through
  `intentFromGesture` unit tests. `examples/books-expo` is exercised on an Android
  emulator by `android.yml` (weekly and on demand): the release APK installs,
  launches and reports the scripted swipe's like on screen, checked by
  `examples/books-expo/scripts/android-smoke.sh`. Green on 2026-11-27. **iOS has
  never been run**, no screen reader has been attached, and a layout seen by a
  person is still missing.

## Adding a row

1. Implement the binding and a fixture that mounts it: `mount()` returns
   `{ root, settle, destroy }`.
2. Add the jsdom test and a page in `examples/conformance` that runs the same
   suite, then reference both in `e2e/binding-conformance.spec.ts`.
3. Open the PR with the runs attached. The table is updated from passing runs, not
   from the intent to add a binding.

See [Write a UI binding](/guides/write-a-binding) for the eight behaviours every
binding needs and the packaging rules.
