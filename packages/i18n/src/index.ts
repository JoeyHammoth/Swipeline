/**
 * Every string a binding renders itself, in one catalog. Cards are user data and
 * never translated here; these are the controls, status messages and
 * announcements around them.
 *
 * A partial catalog is fine: anything it does not define falls back to English,
 * and the missing keys are reported so a translation can be completed.
 */
export type Messages = Readonly<Record<string, string>>

export const en: Messages = Object.freeze({
  'deck.label': 'Swipe deck',
  'deck.loading': 'Loading cards…',
  'deck.empty': 'No more cards.',
  'deck.offline': 'You are offline. Cards you already loaded are still available.',
  'deck.reconnect': 'Reconnect',
  'deck.retry': 'Retry',
  'deck.undo': 'Undo',
  'deck.undoAria': 'Undo last swipe (U)',
  'deck.tags': 'Tags',
  'deck.facts': 'Details',
  'deck.announce': '{title}, card {position}',
  'error.load': 'Could not load cards.',
  'actions.like': 'Like',
  'actions.dislike': 'Dislike',
  'actions.superlike': 'Superlike',
  'actions.later': 'Later',
  'actions.skip': 'Skip',
})

const PLACEHOLDER = /\{(\w+)\}/g

export type MessageParams = Readonly<Record<string, string | number>>

/**
 * Substitutes `{name}` placeholders. A placeholder with no matching parameter is
 * left as written, so a missing value is visible in review instead of becoming
 * "undefined" in the UI.
 */
export function formatMessage(template: string, params: MessageParams = {}): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export interface Translator {
  readonly locale: string
  /** The translated string, or English, or the key itself. */
  t(key: string, params?: MessageParams): string
  has(key: string): boolean
  /** Keys requested that neither the catalog nor English defines. */
  readonly missing: readonly string[]
}

export interface TranslatorOptions {
  /** BCP 47 tag, used for `formatNumber`. Defaults to `en`. */
  locale?: string
  /** Catalog consulted before English. Defaults to `en`. */
  fallback?: Messages
}

export function createTranslator(
  messages: Messages = {},
  options: TranslatorOptions = {},
): Translator {
  const fallback = options.fallback ?? en
  const missing: string[] = []

  const lookup = (key: string): string | undefined => messages[key] ?? fallback[key]

  return {
    locale: options.locale ?? 'en',
    has: (key) => lookup(key) !== undefined,
    get missing() {
      return missing
    },
    t(key, params) {
      const template = lookup(key)
      if (template === undefined) {
        if (!missing.includes(key)) missing.push(key)
        return key
      }
      return params === undefined ? template : formatMessage(template, params)
    },
  }
}

const formatters = new Map<string, Intl.NumberFormat>()

/**
 * Formats a number in the translator's locale. Kept here so a binding renders
 * `4.6` in English and `4,6` in German from the same card data.
 */
export function formatNumber(value: number, locale = 'en'): string {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale)
    formatters.set(locale, formatter)
  }
  return formatter.format(value)
}
