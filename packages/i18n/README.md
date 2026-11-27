# @swipeline/i18n

The catalog of strings the bindings render themselves — buttons, status
messages, the live-region announcement — plus a translator that falls back to
English and reports what a translation is missing.

```ts
import { createTranslator } from '@swipeline/i18n'

const t = createTranslator(
  {
    'deck.empty': 'Keine Karten mehr.',
    'actions.like': 'Gefällt mir',
  },
  { locale: 'de' },
)

t('deck.empty') // "Keine Karten mehr."
t('deck.loading') // "Loading cards…" — English fallback
t.missing // ['deck.loading'] after that call
```

- `en` — every key the bindings use; copy it to start a translation.
- `createTranslator(messages, { locale, fallback })` — `t(key, params)`, `has(key)`,
  and `missing`, which lists keys neither catalog defines.
- `formatMessage(template, params)` — `{name}` substitution; an unknown
  placeholder is left intact rather than rendering `undefined`.
- `formatNumber(value, locale)` — cached `Intl.NumberFormat`, so a fact value
  shows `4.6` in English and `4,6` in German from the same card.

```tsx
<SwipeDeck store={store} messages={{ 'actions.like': 'Gefällt mir' }} locale="de" />
```

Card text is user data and is never translated here; only the chrome around it
is. See [`docs/reference/i18n.md`](https://swipeline.dev/reference/i18n).
