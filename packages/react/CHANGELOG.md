# @swipeline/react

## 0.4.1

### Patch Changes

- 2101bb9: Mark the preview card `inert` as well as `aria-hidden`, so a custom card's links and buttons no longer stay in the tab order. Found by the example-app accessibility audit (`aria-hidden-focus`).
- 6e91914: Tag pills are drawn from the palette instead of a fixed light grey, which left
  the tag text inherited from a dark page on a near-white pill, and both packages'
  `var()` fallbacks carry the new palette values so a deck without a stylesheet
  matches the theme.
- @swipeline/cards@0.4.1
  - @swipeline/core@0.4.1
  - @swipeline/gestures@0.4.1
  - @swipeline/i18n@0.4.1

## 0.4.0

### Patch Changes

- @swipeline/cards@0.4.0
  - @swipeline/core@0.4.0
  - @swipeline/gestures@0.4.0
  - @swipeline/i18n@0.4.0

## 0.3.0

### Minor Changes

- Add the theming kit, the i18n catalog and the built-in card templates.
  
  - `@swipeline/theme`: one token vocabulary with `lightTheme`/`darkTheme`, `mergeTheme` (validated: unknown tokens and declaration-breaking values throw), `themeCss()` for media-query dark mode plus explicit `data-theme` overrides, and `tokenValue()` for `var(--swl-…, <fallback>)` references.
  - `@swipeline/i18n`: the English catalog every binding string comes from, `createTranslator` with English fallback, `missing` reporting, `{name}` interpolation that leaves unknown placeholders visible, and locale-aware `formatNumber`.
  - `@swipeline/cards`: `cardView(card, template)` for the `text`, `media` and `facts` templates; attribution is always carried, missing media and facts are normal, and an unknown template throws.
  - `@swipeline/element` and `@swipeline/react`: a `template` prop/attribute, a `messages` catalog, locale-aware fact numbers, and the facts strip. The element's styles now read the shared tokens with the light palette as fallbacks, so `--swl-accent` and friends keep working.
- dc79b7d: Add `@swipeline/react`: `SwipeDeck` and `useDeck`, with the default and custom card templates, buttons and keyboard for every action, undo, live announcements, focus management, loading/error/offline/exhausted states, SSR-safe subscription and gesture drags through `@swipeline/gestures`.

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
  - @swipeline/i18n@0.3.0
  - @swipeline/cards@0.3.0
