import { describe, expect, it } from 'vitest'
import { createTranslator, en, formatMessage, formatNumber } from '../src/index.js'

describe('i18n', () => {
  it('ships an English string for every binding string', () => {
    for (const key of Object.keys(en)) expect(en[key]).toBeTruthy()
    expect(Object.isFrozen(en)).toBe(true)
    expect(en['deck.announce']).toBe('{title}, card {position}')
  })

  it('translates, then falls back to English, then reports the key', () => {
    const t = createTranslator({ 'deck.empty': 'Keine Karten mehr.' })
    expect(t.t('deck.empty')).toBe('Keine Karten mehr.')
    expect(t.t('deck.loading')).toBe('Loading cards…')
    expect(t.t('nope.nothing')).toBe('nope.nothing')
    expect(t.has('deck.empty')).toBe(true)
    expect(t.has('nope.nothing')).toBe(false)
    expect(t.missing).toEqual(['nope.nothing'])
  })

  it('lists each missing key once', () => {
    const t = createTranslator()
    t.t('a.missing')
    t.t('a.missing')
    t.t('another.missing')
    expect(t.missing).toEqual(['a.missing', 'another.missing'])
  })

  it('interpolates placeholders and leaves unknown ones intact', () => {
    expect(formatMessage('{title}, card {position}', { title: 'Dune', position: 3 })).toBe(
      'Dune, card 3',
    )
    expect(formatMessage('{title} / {missing}', { title: 'Dune' })).toBe('Dune / {missing}')
    const t = createTranslator()
    expect(t.t('deck.announce', { title: 'Dune', position: 2 })).toBe('Dune, card 2')
  })

  it('does not substitute a placeholder spelled in the wrong case', () => {
    expect(formatMessage('{Title}', { title: 'Dune' })).toBe('{Title}')
  })

  it('accepts a custom fallback catalog', () => {
    const t = createTranslator({}, { fallback: { 'deck.empty': 'Finns inga kort.' } })
    expect(t.t('deck.empty')).toBe('Finns inga kort.')
    expect(t.t('deck.loading')).toBe('deck.loading')
  })

  it('keeps the locale and formats numbers in it', () => {
    expect(createTranslator({}, { locale: 'de-DE' }).locale).toBe('de-DE')
    expect(formatNumber(4.6, 'en')).toBe('4.6')
    expect(formatNumber(4.6, 'de-DE')).toBe('4,6')
    expect(formatNumber(1234567.5, 'de-DE')).toBe('1.234.567,5')
  })
})
