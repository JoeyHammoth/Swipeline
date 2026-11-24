# 0004: One observable `DeckStore` is the only binding contract

**Status:** accepted

The headless engine exposes `getSnapshot`, `getServerSnapshot`, `subscribe` and
`dispatch`, with immutable snapshots that are referentially stable when nothing
changed. Every framework binding is glue over that interface, which is why the
same `deck.config.ts` can drive React, a Web Component, Vue and Svelte, and why
the engine can be tested with no framework installed. The rejected alternative,
a React-first API with adapters for other frameworks, leaks React's rendering
model into the engine and makes SSR and non-DOM targets second-class. The
contract's invariants (no work at import time, stable server snapshot) are
enforced by the binding conformance suite, not by convention.
