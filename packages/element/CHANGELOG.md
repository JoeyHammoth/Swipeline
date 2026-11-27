# @swipeline/element

## 0.3.0

### Minor Changes

- d3abaae: Add the M2 foundation: optional OpenAI-compatible and Transformers.js embedders, exact and SQLite-vec vector indexes, first-party Open Library / TheMealDB / arXiv / TMDB adapters with recorded fixtures, the `<swipe-deck>` Web Component, and a DOM-based binding conformance suite that React and the element both pass.
- Add the theming kit, the i18n catalog and the built-in card templates.
  
  - `@swipeline/theme`: one token vocabulary with `lightTheme`/`darkTheme`, `mergeTheme` (validated: unknown tokens and declaration-breaking values throw), `themeCss()` for media-query dark mode plus explicit `data-theme` overrides, and `tokenValue()` for `var(--swl-…, <fallback>)` references.
  - `@swipeline/i18n`: the English catalog every binding string comes from, `createTranslator` with English fallback, `missing` reporting, `{name}` interpolation that leaves unknown placeholders visible, and locale-aware `formatNumber`.
  - `@swipeline/cards`: `cardView(card, template)` for the `text`, `media` and `facts` templates; attribution is always carried, missing media and facts are normal, and an unknown template throws.
  - `@swipeline/element` and `@swipeline/react`: a `template` prop/attribute, a `messages` catalog, locale-aware fact numbers, and the facts strip. The element's styles now read the shared tokens with the light palette as fallbacks, so `--swl-accent` and friends keep working.

### Patch Changes

- 309801d: Include the Apache-2.0 `LICENSE` and the project `NOTICE` in every published package tarball, and fail CI when a package is missing either.
- Updated dependencies [0b76495]
- Updated dependencies [dfab5fa]
- Updated dependencies [d1bbc12]
- Updated dependencies [04c638f]
- Updated dependencies
- Updated dependencies [309801d]
  - @swipeline/core@0.3.0
  - @swipeline/gestures@0.3.0
  - @swipeline/theme@0.3.0
  - @swipeline/i18n@0.3.0
  - @swipeline/cards@0.3.0
