---
'@swipeline/theme': patch
---

The default palettes now clear AAA text contrast and the 3:1 boundary minimum.
Light `color-accent` moves `#2563eb → #1e40af` (5.17:1 → 8.72:1 on white) and
`color-border` moves `#e5e7eb → #8a8f9b` (1.24:1 → 3.24:1); dark `color-border`
moves `#334155 → #64748b` (1.73:1 → 3.77:1). A border under 3:1 is not a boundary
a low-vision user can see, so this trades a pale hairline and a lighter link blue
for something visible. `packages/theme/test/contrast.test.ts` pins every ratio.
