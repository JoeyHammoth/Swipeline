# Theming

Bindings share one token vocabulary. Override the tokens on the deck element or
on `:root`; React and the Web Component consume the same names.

## Tokens

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--swl-color-bg` | Card surface | `#ffffff` | `#141625` |
| `--swl-color-fg` | Primary text | `#111827` | `#f8fafc` |
| `--swl-color-muted` | Secondary text | `#4b5563` | `#cbd5e1` |
| `--swl-color-border` | Card and control borders | `#e5e7eb` | `#334155` |
| `--swl-color-accent` | Focus and the primary action | `#2563eb` | `#60a5fa` |
| `--swl-radius-card` | Card corners | `16px` | `16px` |
| `--swl-radius-control` | Buttons and pills | `999px` | `999px` |
| `--swl-space-1` | Tightest spacing | `4px` | `4px` |
| `--swl-space-2` | Tag padding | `8px` | `8px` |
| `--swl-space-3` | Control padding | `12px` | `12px` |
| `--swl-space-4` | Card padding | `16px` | `16px` |
| `--swl-space-5` | Section gap | `24px` | `24px` |
| `--swl-space-6` | Page sections | `32px` | `32px` |
| `--swl-motion-fast` | Press and hover | `120ms` | `120ms` |
| `--swl-motion-slow` | Card exit | `220ms` | `220ms` |

There is no separate dark palette: `prefers-color-scheme: dark` applies the dark
column, and `data-theme="light"` or `data-theme="dark"` on an ancestor forces one.

## Worked example

```css
.my-deck {
  --swl-color-accent: #db2777;
  --swl-radius-card: 4px;
  --swl-radius-control: 8px;
}

[data-theme='dark'] .my-deck {
  --swl-color-accent: #f472b6;
  --swl-color-bg: #0b1020;
  --swl-color-fg: #f1f5f9;
}
```

```html
<div data-theme="dark">
  <swipe-deck class="my-deck"></swipe-deck>
</div>
```

`::part(card)`, `::part(actions)` and `::part(button)` expose the element's
internals for layout changes that tokens cannot express. React accepts a
`className` on `SwipeDeck` for the same overrides.

## Motion

```css
@media (prefers-reduced-motion: reduce) {
  .my-deck {
    --swl-motion-fast: 0ms;
    --swl-motion-slow: 0ms;
  }
}
```

Bindings also stop writing transforms when `prefers-reduced-motion` matches, so
setting durations to zero is a fallback, not the only mechanism.

## RTL

Tokens are direction-neutral. Use logical properties (`margin-inline`,
`padding-inline`) in custom cards; the default templates already do. Test with
`dir="rtl"` on the deck's container.
