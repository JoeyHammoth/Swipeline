import { describe, expect, it } from 'vitest'
import {
  cssVar,
  darkTheme,
  declarations,
  lightTheme,
  mergeTheme,
  TOKEN_NAMES,
  themeCss,
  themeToCss,
  tokenValue,
} from '../src/index.js'

describe('theme', () => {
  it('defines every token in both palettes', () => {
    for (const theme of [lightTheme, darkTheme]) {
      for (const name of TOKEN_NAMES) expect(theme[name]).toBeTruthy()
      expect(Object.keys(theme).sort()).toEqual([...TOKEN_NAMES].sort())
    }
    expect(lightTheme['color-bg']).not.toBe(darkTheme['color-bg'])
  })

  it('is frozen, so a shared palette cannot be mutated in place', () => {
    expect(Object.isFrozen(lightTheme)).toBe(true)
    expect(Object.isFrozen(darkTheme)).toBe(true)
  })

  it('maps a token to its custom property and a safe var() fallback', () => {
    expect(cssVar('color-accent')).toBe('--swl-color-accent')
    expect(tokenValue('color-accent')).toBe('var(--swl-color-accent, #1e40af)')
    expect(tokenValue('color-accent', darkTheme)).toBe('var(--swl-color-accent, #60a5fa)')
  })

  it('applies overrides without touching the base theme', () => {
    const brand = mergeTheme(lightTheme, { 'color-accent': '#db2777' })
    expect(brand['color-accent']).toBe('#db2777')
    expect(brand['color-bg']).toBe(lightTheme['color-bg'])
    expect(lightTheme['color-accent']).toBe('#1e40af')
    expect(Object.isFrozen(brand)).toBe(true)
  })

  it('rejects an unknown token name', () => {
    expect(() => mergeTheme(lightTheme, { 'color-acents': '#db2777' } as never)).toThrow(
      /Unknown theme token "color-acents"/,
    )
  })

  it('rejects values that could break out of a declaration', () => {
    expect(() => mergeTheme(lightTheme, { 'color-bg': '' })).toThrow(/non-empty/)
    expect(() => mergeTheme(lightTheme, { 'color-bg': 'red; } body { display: none' })).toThrow(
      /not allowed in a CSS value/,
    )
    expect(() => mergeTheme(lightTheme, { 'color-bg': '<script>' })).toThrow(
      /not allowed in a CSS value/,
    )
  })

  it('writes one rule per theme', () => {
    expect(themeToCss(lightTheme, '.deck')).toBe(`.deck {\n${declarations(lightTheme)}\n}`)
    expect(declarations(lightTheme).split('\n')).toHaveLength(TOKEN_NAMES.length)
    expect(declarations(lightTheme)).toContain('--swl-motion-slow: 220ms;')
  })

  it('writes a stylesheet with dark under the media query and data-theme wins', () => {
    const css = themeCss()
    expect(css).toContain(':root {')
    expect(css).toContain('@media (prefers-color-scheme: dark) {')
    expect(css).toContain("[data-theme='dark'] {")
    expect(css).toContain("[data-theme='light'] {")
    // The explicit overrides come last so they beat the media query.
    expect(css.indexOf("[data-theme='dark']")).toBeGreaterThan(css.indexOf('@media'))
  })

  it('honours a custom selector', () => {
    expect(themeCss({ selector: '.deck' }).startsWith('.deck {')).toBe(true)
  })
})
