# @swipeline/theme

## 0.4.1

### Patch Changes

- 6e91914: The default palettes now clear AAA text contrast and the 3:1 boundary minimum.
  Light `color-accent` moves `#2563eb → #1e40af` (5.17:1 → 8.72:1 on white) and
  `color-border` moves `#e5e7eb → #8a8f9b` (1.24:1 → 3.24:1); dark `color-border`
  moves `#334155 → #64748b` (1.73:1 → 3.77:1). A border under 3:1 is not a boundary
  a low-vision user can see, so this trades a pale hairline and a lighter link blue
  for something visible. `packages/theme/test/contrast.test.ts` pins every ratio.

## 0.4.0

No changes in this release.

## 0.3.0

### Minor Changes

- Add the theming kit, the i18n catalog and the built-in card templates.
  
  - `@swipeline/theme`: one token vocabulary with `lightTheme`/`darkTheme`, `mergeTheme` (validated: unknown tokens and declaration-breaking values throw), `themeCss()` for media-query dark mode plus explicit `data-theme` overrides, and `tokenValue()` for `var(--swl-…, <fallback>)` references.
  - `@swipeline/i18n`: the English catalog every binding string comes from, `createTranslator` with English fallback, `missing` reporting, `{name}` interpolation that leaves unknown placeholders visible, and locale-aware `formatNumber`.
  - `@swipeline/cards`: `cardView(card, template)` for the `text`, `media` and `facts` templates; attribution is always carried, missing media and facts are normal, and an unknown template throws.
  - `@swipeline/element` and `@swipeline/react`: a `template` prop/attribute, a `messages` catalog, locale-aware fact numbers, and the facts strip. The element's styles now read the shared tokens with the light palette as fallbacks, so `--swl-accent` and friends keep working.
