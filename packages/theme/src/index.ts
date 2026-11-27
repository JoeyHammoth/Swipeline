/**
 * The token vocabulary every binding shares. Values live here so a brand can
 * import the palette object instead of copying hex codes, and so the element can
 * write `var(--swl-color-bg, #ffffff)` fallbacks from the same source.
 *
 * The names match [the theming reference](https://swipeline.dev/reference/theming).
 */
export const TOKEN_NAMES = [
  'color-bg',
  'color-fg',
  'color-muted',
  'color-border',
  'color-accent',
  'radius-card',
  'radius-control',
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'motion-fast',
  'motion-slow',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
export type Theme = Readonly<Record<TokenName, string>>

export const lightTheme: Theme = Object.freeze({
  'color-bg': '#ffffff',
  'color-fg': '#111827',
  'color-muted': '#4b5563',
  // 3.24:1 against the background, so a control outline is visible (WCAG 1.4.11).
  'color-border': '#8a8f9b',
  // 8.72:1, clearing AAA for text as well as the 3:1 boundary minimum.
  'color-accent': '#1e40af',
  'radius-card': '16px',
  'radius-control': '999px',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'motion-fast': '120ms',
  'motion-slow': '220ms',
})

export const darkTheme: Theme = Object.freeze({
  'color-bg': '#141625',
  'color-fg': '#f8fafc',
  'color-muted': '#cbd5e1',
  'color-border': '#64748b',
  'color-accent': '#60a5fa',
  'radius-card': '16px',
  'radius-control': '999px',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'motion-fast': '120ms',
  'motion-slow': '220ms',
})

/** The custom property a token maps to, e.g. `--swl-color-bg`. */
export function cssVar(name: TokenName): string {
  return `--swl-${name}`
}

/**
 * A `var()` reference with the theme's value as the fallback, so a binding still
 * renders if the app never loads a stylesheet.
 */
export function tokenValue(name: TokenName, theme: Theme = lightTheme): string {
  return `var(${cssVar(name)}, ${theme[name]})`
}

// A value that could close the declaration or the block would let a theme inject
// arbitrary CSS, and themes are allowed to come from a user's stored settings.
const UNSAFE_VALUE = /[;{}<>]/

function assertValue(name: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Theme token "${name}" must be a non-empty string.`)
  }
  if (UNSAFE_VALUE.test(value)) {
    throw new TypeError(
      `Theme token "${name}" contains a character that is not allowed in a CSS value: ${JSON.stringify(value)}`,
    )
  }
}

/**
 * Applies overrides on top of a base theme. Unknown token names are an error
 * rather than a silently ignored key, because a typo in a brand palette is hard
 * to spot in the rendered result.
 */
export function mergeTheme(base: Theme, overrides: Partial<Record<TokenName, string>>): Theme {
  const next: Record<TokenName, string> = { ...base }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    if (!(name in base)) {
      throw new TypeError(`Unknown theme token "${name}". Known tokens: ${TOKEN_NAMES.join(', ')}.`)
    }
    assertValue(name, value)
    next[name as TokenName] = value
  }
  return Object.freeze(next)
}

/** The declarations of one theme, without a selector. */
export function declarations(theme: Theme): string {
  return TOKEN_NAMES.map((name) => `${cssVar(name)}: ${theme[name]};`).join('\n')
}

/** One theme as a rule, for a stylesheet or a shadow root. */
export function themeToCss(theme: Theme, selector = ':root'): string {
  return `${selector} {\n${declarations(theme)}\n}`
}

export interface ThemeCssOptions {
  /** Selector the tokens are set on. Defaults to `:root`. */
  selector?: string
  light?: Theme
  dark?: Theme
}

/**
 * A complete stylesheet: the light palette, the dark palette under
 * `prefers-color-scheme`, and explicit `data-theme` overrides that win over the
 * media query in both directions.
 */
export function themeCss(options: ThemeCssOptions = {}): string {
  const selector = options.selector ?? ':root'
  const light = options.light ?? lightTheme
  const dark = options.dark ?? darkTheme
  return [
    themeToCss(light, selector),
    `@media (prefers-color-scheme: dark) {\n${themeToCss(dark, selector)}\n}`,
    `[data-theme='dark'] {\n${declarations(dark)}\n}`,
    `[data-theme='light'] {\n${declarations(light)}\n}`,
  ].join('\n')
}
