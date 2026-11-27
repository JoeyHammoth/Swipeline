# Write a UI binding

A binding renders a deck for one framework. It is deliberately thin: subscribe to
a [`DeckStore`](/architecture/contracts), render a snapshot, translate input into
`dispatch` calls. Everything else belongs in the engine or `@swipeline/gestures`.

## The minimum

```ts
import type { DeckStore } from '@swipeline/core'
import { createGestureController } from '@swipeline/gestures'

export function mountDeck(root: HTMLElement, store: DeckStore) {
  const controller = createGestureController({
    element: root,
    onIntent: (intent) => {
      const card = store.getSnapshot().cards[0]
      if (!card || intent.kind !== 'commit') return
      store.dispatch({ type: 'swipe', action: intent.action, cardId: card.id })
    },
  })

  const unsubscribe = store.subscribe(() => render(root, store.getSnapshot()))
  render(root, store.getSnapshot())

  return () => {
    unsubscribe()
    controller.destroy()
  }
}
```

## The eight behaviours a binding must have

| # | Behaviour | Notes |
|---|---|---|
| 1 | Renders the current card and next-card preview from the snapshot | No local copy of deck state |
| 2 | Pointer drag past threshold commits the mapped action; short drag cancels | Use `computeSwipeIntent` from `gestures` or the shared math |
| 3 | Every action reachable by button and keyboard | Arrow keys by default; document shortcuts |
| 4 | ARIA live announcement on card change, focus managed on advance | Do not steal focus into the card body |
| 5 | Loading, exhausted, error and offline states render and recover | Take them from `snapshot.state` |
| 6 | Custom card template in the framework's idiom | Slot, render prop, snippet, template |
| 7 | Unmount unsubscribes; remount restores state | No retained listeners, no leaked timers |
| 8 | Server render does not throw and hydration matches | `getServerSnapshot` is stable |

If a behaviour needs engine support that does not exist, propose it — do not
implement it in the binding. Two bindings needing the same logic is the signal
that it belongs in `core`.

## Conformance

`@swipeline/binding-testkit` exports one assertion function. A fixture mounts
your binding and returns its root plus `settle` and `destroy`:

```ts
import { assertBindingConformance } from '@swipeline/binding-testkit'

const report = await assertBindingConformance(
  {
    name: 'vue',
    async mount() {
      const root = mountMyDeck()
      return { root, settle: async () => {}, destroy: () => root.remove() }
    },
  },
  { firstTitle: 'First card', secondTitle: 'Second card' },
)
// report: { binding: 'vue', checks: 7 }
```

Covered: render from the snapshot, a control per action, pointer gestures on the
root, ArrowRight advancing, `u` undoing, a polite live region, and teardown that
detaches the root. Failures are collected into one `BindingConformanceError`.

The suite is DOM-based and runs twice: under jsdom in each binding's package
test (`packages/react/test/conformance.test.tsx`,
`packages/vue/test/conformance.test.ts`, `packages/svelte/test/conformance.test.ts`,
`packages/element/test/element.test.ts`), and in Chromium against the fixture
pages in `examples/conformance`, driven by `e2e/binding-conformance.spec.ts` in
`e2e.yml`. The [binding status matrix](/reference/binding-status) lists only
bindings with a passing run.

## Framework glue, concretely

| Framework | Subscription |
|---|---|
| React | `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)` |
| Vue | `shallowRef` updated in `subscribe`, dispose in `onScopeDispose` |
| Svelte | `toSvelteStore(store)` — call the subscriber immediately with the current value |
| Solid | `from(store)` or a signal fed by `subscribe` |
| Angular | a `signal` fed by `subscribe`, cleanup in `DestroyRef` |
| Web Component | re-render on `subscribe`; properties in, events out |

## Packaging rules

- The framework is a **peer dependency**, never a dependency.
- Default styles are plain CSS with tokens; no CSS-in-JS runtime, no Tailwind
  requirement.
- No behaviour that only one binding has.
- Ship a fixture page so conformance can run in CI.

## Checklist for the PR

- [ ] Conformance suite passes (attach the run)
- [ ] SSR smoke test for at least one meta-framework
- [ ] Keyboard and screen-reader path demonstrated in the description
- [ ] Reduced-motion path shown
- [ ] Custom card example in the docs
- [ ] Framework listed only in `peerDependencies`
- [ ] Changeset added
