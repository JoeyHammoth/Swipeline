import {
  type Card,
  type CardAttribution,
  cardId,
  type FetchContext,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'

export interface TheMealDbOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  baseUrl?: string
  /** TheMealDB's free test key is `1`; production keys are issued per project. */
  apiKey?: string
  retry?: { maxRetries?: number; sleep?: (ms: number) => Promise<void> }
}

export interface MealDbRow {
  idMeal?: string
  strMeal?: string
  strCategory?: string
  strArea?: string
  strInstructions?: string
  strMealThumb?: string
  strTags?: string
  strSource?: string
}

const ATTRIBUTION: CardAttribution = {
  text: 'Data from TheMealDB',
  url: 'https://www.themealdb.com',
  required: true,
}

const MAX_TAGS = 12
const MAX_BODY = 600

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return undefined
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * TheMealDB search endpoint as Cards. No pagination: a search returns the full
 * result set, so the adapter reports `none` and the engine marks the deck
 * exhausted after the first page.
 */
export function createTheMealDbAdapter(options: TheMealDbOptions = {}): SourceAdapter<MealDbRow> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? 'https://www.themealdb.com/api/json/v1'
  const apiKey = options.apiKey ?? '1'
  const now = options.now ?? Date.now
  const sleep = options.retry?.sleep ?? delay
  const maxRetries = options.retry?.maxRetries ?? 2

  async function request(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let attempt = 0
    for (;;) {
      if (signal?.aborted) throw new Error('TheMealDB request aborted')
      const init: RequestInit = { headers: { accept: 'application/json' } }
      if (signal) init.signal = signal
      const response = await fetchImpl(url, init)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          attempt += 1
          await sleep(300 * 2 ** (attempt - 1))
          continue
        }
      }
      if (!response.ok) throw new Error(`TheMealDB responded ${response.status}`)
      const json = (await response.json()) as unknown
      if (json === null || typeof json !== 'object') throw new Error('TheMealDB returned no object')
      return json as Record<string, unknown>
    }
  }

  return {
    id: 'themealdb',
    capabilities: { pagination: 'none', search: true },
    attribution: ATTRIBUTION,
    async fetch(ctx: FetchContext) {
      const url = new URL(`${baseUrl}/${apiKey}/search.php`)
      url.searchParams.set('s', ctx.query?.trim() || '')
      const json = await request(url.toString(), ctx.signal)
      const meals = Array.isArray(json.meals) ? (json.meals as MealDbRow[]) : []
      return { items: meals }
    },
    normalize(raw: MealDbRow): Card | null {
      const id = asString(raw.idMeal)
      const title = asString(raw.strMeal)
      if (!id || !title) return null
      const card: Card = {
        schemaVersion: 1,
        id: cardId('themealdb', id),
        sourceId: 'themealdb',
        title,
        fetchedAt: new Date(now()).toISOString(),
        attribution: ATTRIBUTION,
      }
      const category = asString(raw.strCategory)
      const area = asString(raw.strArea)
      if (category && area) card.subtitle = `${category} · ${area}`
      else if (category ?? area) card.subtitle = category ?? area

      const instructions = asString(raw.strInstructions)
      if (instructions) card.body = instructions.slice(0, MAX_BODY)

      const tags = [...(raw.strTags ?? '').split(','), category ?? '', area ?? '']
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
      const unique = [...new Set(tags)].slice(0, MAX_TAGS)
      if (unique.length > 0) card.tags = unique

      const thumb = asString(raw.strMealThumb)
      if (thumb && isHttpUrl(thumb)) {
        card.media = [{ kind: 'image', url: thumb, alt: `Photo of ${title}` }]
      }
      const source = asString(raw.strSource)
      if (source && isHttpUrl(source)) card.url = source

      const facts: NonNullable<Card['facts']> = []
      if (category) facts.push({ label: 'Category', value: category })
      if (area) facts.push({ label: 'Cuisine', value: area })
      if (facts.length > 0) card.facts = facts

      const parsed = safeParseCard(card)
      return parsed.success ? parsed.data : null
    },
  }
}
