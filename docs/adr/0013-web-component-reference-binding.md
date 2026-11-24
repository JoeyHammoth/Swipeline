# 0013: The Web Component is the reference binding, built in M2

**Status:** accepted

`@swipeline/element` (a `<swipe-deck>` custom element) is the binding every
other one is measured against, and it ships in M2 rather than at the end of the
roadmap. A React-first launch would make "framework-agnostic" a claim; a working
Web Component makes it a fact, gives every framework a day-one option, and proves
the `DeckStore` contract before four more bindings depend on it. The friction is
real and budgeted for: Shadow DOM styling goes through CSS custom properties and
`::part`, server rendering renders after hydration, and the conformance suite
covers custom-element ergonomics per framework version.
