# @swipeline/i18n

## 0.4.1

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

### Minor Changes

- Add the theming kit, the i18n catalog and the built-in card templates.
  
  - `@swipeline/theme`: one token vocabulary with `lightTheme`/`darkTheme`, `mergeTheme` (validated: unknown tokens and declaration-breaking values throw), `themeCss()` for media-query dark mode plus explicit `data-theme` overrides, and `tokenValue()` for `var(--swl-…, <fallback>)` references.
  - `@swipeline/i18n`: the English catalog every binding string comes from, `createTranslator` with English fallback, `missing` reporting, `{name}` interpolation that leaves unknown placeholders visible, and locale-aware `formatNumber`.
  - `@swipeline/cards`: `cardView(card, template)` for the `text`, `media` and `facts` templates; attribution is always carried, missing media and facts are normal, and an unknown template throws.
  - `@swipeline/element` and `@swipeline/react`: a `template` prop/attribute, a `messages` catalog, locale-aware fact numbers, and the facts strip. The element's styles now read the shared tokens with the light palette as fallbacks, so `--swl-accent` and friends keep working.
