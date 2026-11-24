# @swipeline/binding-testkit

The conformance suite every binding runs. A fixture mounts the binding and
returns its root plus `settle` and `destroy`; the suite asserts the behaviours
users depend on.

```ts
import { assertBindingConformance } from '@swipeline/binding-testkit'

const report = await assertBindingConformance(
  { name: 'vue', mount: () => mountMyDeck() },
  { firstTitle: 'First card', secondTitle: 'Second card' },
)
```

Checks: first card renders, at least one control per action, a polite live
region exists, ArrowRight advances, `u` undoes, the root receives pointer
gestures, and destroy detaches the root.

The suite is DOM-based, so it runs in jsdom today and can be wrapped by a
Playwright fixture without changing the assertions. Failures are collected into
one `BindingConformanceError` rather than stopping at the first, which keeps a
binding PR reviewable.
