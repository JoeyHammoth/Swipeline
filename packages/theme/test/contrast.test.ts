import { describe, expect, it } from 'vitest'
import { darkTheme, lightTheme, type Theme } from '../src/index.js'

/** WCAG 2.x relative luminance for a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/../g)
    ?.map((pair) => Number.parseInt(pair, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Not a #rrggbb colour: ${hex}`)
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_TEXT = 4.5
const AAA_TEXT = 7
/** WCAG 1.4.11, for boundaries that have to be seen rather than read. */
const NON_TEXT = 3

const PALETTES: ReadonlyArray<{ name: string; theme: Theme }> = [
  { name: 'light', theme: lightTheme },
  { name: 'dark', theme: darkTheme },
]

const TEXT_PAIRS = [
  ['color-fg', 'body text'],
  ['color-muted', 'secondary text'],
  ['color-accent', 'accent text and links'],
] as const

function textRatios() {
  return PALETTES.flatMap(({ name, theme }) =>
    TEXT_PAIRS.map(([token, label]) => ({
      name: `${name} ${token}`,
      label,
      ratio: contrast(theme[token], theme['color-bg']),
    })),
  )
}

function boundaryRatios() {
  return PALETTES.flatMap(({ name, theme }) => [
    { name: `${name} color-border`, ratio: contrast(theme['color-border'], theme['color-bg']) },
    { name: `${name} color-accent`, ratio: contrast(theme['color-accent'], theme['color-bg']) },
  ])
}

describe('default theme contrast', () => {
  it('passes AA for every text pair in both palettes', () => {
    const failures = textRatios()
      .filter((pair) => pair.ratio < AA_TEXT)
      .map((pair) => `${pair.name} (${pair.label}) is ${pair.ratio.toFixed(2)}:1`)
    expect(failures).toEqual([])
  })

  it('passes 3:1 for the accent boundary in both palettes', () => {
    const accent = boundaryRatios().filter((pair) => pair.name.endsWith('color-accent'))
    for (const pair of accent) expect(pair.ratio).toBeGreaterThanOrEqual(NON_TEXT)
  })

  // The two tests below pin the audit record in docs/reference/a11y-audit.md: if a
  // palette changes, they fail and the record has to be updated with it.
  it('records which text pairs miss AAA', () => {
    expect(
      textRatios()
        .filter((pair) => pair.ratio < AAA_TEXT)
        .map((pair) => `${pair.name} ${pair.ratio.toFixed(2)}`),
    ).toEqual(['light color-accent 5.17'])
  })

  it('records which boundaries miss 3:1', () => {
    expect(
      boundaryRatios()
        .filter((pair) => pair.name.endsWith('color-border'))
        .filter((pair) => pair.ratio < NON_TEXT)
        .map((pair) => `${pair.name} ${pair.ratio.toFixed(2)}`),
    ).toEqual(['light color-border 1.24', 'dark color-border 1.73'])
  })
})
