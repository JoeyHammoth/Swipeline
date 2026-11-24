# Examples

Runnable demos that share one `deck.config.ts` across frameworks.

| Example | Framework | Milestone |
|---|---|---|
| `books-react` | React + IndexedDB | M1 |
| `recipes-react` | React + memory store | M1 |
| `papers-html` | `<swipe-deck>` Web Component | M2 |
| `books-vue` | Vue | M4 |
| `books-svelte` | Svelte | M4 |
| `books-expo` | React Native / Expo | M4 |

The rule that keeps the abstraction honest: **the deck config is shared, and a
config change needed by only one framework is a bug in the abstraction**, not a
feature of that framework. Examples import their config from a shared file and
differ only in rendering.

Examples are not published to npm and are covered by the `e2e` workflow
(Playwright for web, Expo smoke tests for mobile).
