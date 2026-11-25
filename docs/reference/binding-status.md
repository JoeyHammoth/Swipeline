# Binding status

Which UI bindings pass the shared conformance suite, and what "passing" covers.
The table records test results in this repository, not intentions.

| Binding | Package | Status | Conformance run |
|---|---|---|---|
| React | `@swipeline/react` | Official — passing | [`packages/react/test/conformance.test.tsx`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/react/test/conformance.test.tsx) |
| Web Component | `@swipeline/element` | Official — passing | [`packages/element/test/element.test.ts`](https://github.com/JoeyHammoth/Swipeline/blob/main/packages/element/test/element.test.ts) |
| Vue, Svelte, Solid, Angular | — | Planned (M4) | — |
| React Native / Expo | — | Planned (M4) | — |

Both suites assert the same seven behaviours through
`assertBindingConformance`: the first card renders from the snapshot, there is at
least one control per action, the root receives pointer gestures, ArrowRight
advances, `u` undoes, a polite live region exists, and `destroy` detaches the
root. A failing binding reports every failure in one `BindingConformanceError`
rather than stopping at the first.

## What the suite does not cover yet

The suite is DOM-based and runs under jsdom in the package test suites. The
browser-level Playwright wrapper from the [design plan](/swipeline-design-and-implementation-plan)
(`e2e.yml`, one fixture page per binding) is not wired yet, so gesture physics
and real-browser focus behaviour are not certified here. When it lands, this
table gains a browser column rather than changing its meaning.

## Adding a row

1. Implement the binding and a fixture that mounts it: `mount()` returns
   `{ root, settle, destroy }`.
2. Add a test that calls `assertBindingConformance` and asserts `checks: 7`.
3. Open the PR with the run attached. The table is updated from the passing run,
   not from the intent to add a binding.

See [Write a UI binding](/guides/write-a-binding) for the eight behaviours every
binding needs and the packaging rules.

<!-- gate smoke test: dependency review runs on pull requests again (issue #27) -->
