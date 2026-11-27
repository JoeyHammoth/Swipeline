# @swipeline/theme

The design-token vocabulary every binding shares: one palette object, one CSS
output, and the same names React Native will use.

```ts
import { lightTheme, mergeTheme, themeCss } from '@swipeline/theme'

const brand = mergeTheme(lightTheme, {
  'color-accent': '#db2777',
  'radius-card': '4px',
})

document.head.append(Object.assign(document.createElement('style'), { textContent: themeCss() }))
```

- `TOKEN_NAMES`, `lightTheme`, `darkTheme` — the vocabulary and both palettes.
- `mergeTheme(base, overrides)` — validated overrides; an unknown token or a value
  that could break out of a declaration throws instead of rendering wrong.
- `themeCss()` — light palette on `:root`, dark under `prefers-color-scheme`, and
  `[data-theme='dark']` / `[data-theme='light']` overrides that win either way.
- `themeToCss(theme, selector)`, `declarations(theme)` — one theme at a time.
- `cssVar(name)`, `tokenValue(name, theme)` — `--swl-color-bg` and
  `var(--swl-color-bg, #ffffff)`, which is how the element keeps working with no
  stylesheet loaded.

Tokens are inert: importing this package changes nothing and touches no DOM.

See [`docs/reference/theming.md`](https://swipeline.dev/reference/theming) for the
table, dark-mode values and worked overrides.
