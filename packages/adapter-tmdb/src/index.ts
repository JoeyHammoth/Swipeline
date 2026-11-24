import {
  type Card,
  type CardAttribution,
  cardId,
  type FetchContext,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'

export interface TmdbOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  baseUrl?: string
  imageBaseUrl?: string
  /** TMDB v3 key. Never ship it in a browser bundle. */
  apiKey: string | (() => string)
  /** Optional id → name map for genres; TMDB's discover endpoint returns ids. */
  genres?: Readonly<Record<number, string>>
  retry?: { maxRetries?: number; sleep?: (ms: number) => Promise<void> }
}

export interface TmdbMovie {
  id?: number
  title?: string
  overview?: string
  release_date?: string
  poster_path?: string | null
  vote_average?: number
  vote_count?: number
  genre_ids?: number[]
  adult?: boolean
}

export interface TmdbPage {
  page?: number
  total_pages?: number
  results?: TmdbMovie[]
}

const ATTRIBUTION: CardAttribution = {
  text: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
  url: 'https://www.themoviedb.org',
  required: true,
}

const MAX_BODY = 500
const MAX_TAGS = 8

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return undefined
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * TMDB discover/search as movie Cards. Discover is used without a query, search
 * with one. TMDB requires attribution and a key; the key is read per request so
 * a rotation does not recreate the adapter.
 */
export function createTmdbAdapter(options: TmdbOptions): SourceAdapter<TmdbMovie> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? 'https://api.themoviedb.org/3'
  const imageBase = options.imageBaseUrl ?? 'https://image.tmdb.org/t/p/w500'
  const now = options.now ?? Date.now
  const sleep = options.retry?.sleep ?? delay
  const maxRetries = options.retry?.maxRetries ?? 2

  function key(): string {
    const value = typeof options.apiKey === 'function' ? options.apiKey() : options.apiKey
    if (!value) throw new Error('TMDB adapter needs an API key')
    return value
  }

  async function request(url: URL, signal?: AbortSignal): Promise<TmdbPage> {
    let attempt = 0
    for (;;) {
      if (signal?.aborted) throw new Error('TMDB request aborted')
      const init: RequestInit = { headers: { accept: 'application/json' } }
      if (signal) init.signal = signal
      const response = await fetchImpl(url.toString(), init)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          attempt += 1
          await sleep(300 * 2 ** (attempt - 1))
          continue
        }
      }
      if (!response.ok) throw new Error(`TMDB responded ${response.status}`)
      const json = (await response.json()) as unknown
      if (json === null || typeof json !== 'object') throw new Error('TMDB returned no object')
      return json as TmdbPage
    }
  }

  return {
    id: 'tmdb',
    capabilities: { pagination: 'offset', search: true, filters: ['genre'] },
    attribution: ATTRIBUTION,
    async fetch(ctx: FetchContext) {
      const page = ctx.cursor === undefined ? 1 : Number(ctx.cursor)
      const query = ctx.query?.trim()
      const url = new URL(query ? `${baseUrl}/search/movie` : `${baseUrl}/discover/movie`)
      url.searchParams.set('api_key', key())
      url.searchParams.set('page', String(page))
      url.searchParams.set('include_adult', 'false')
      if (query) url.searchParams.set('query', query)
      else url.searchParams.set('sort_by', 'popularity.desc')
      const genre = ctx.filters?.genre
      if (typeof genre === 'string' || typeof genre === 'number') {
        url.searchParams.set('with_genres', String(genre))
      }
      const json = await request(url, ctx.signal)
      const results = Array.isArray(json.results) ? json.results : []
      const totalPages = typeof json.total_pages === 'number' ? json.total_pages : page
      const nextCursor = results.length > 0 && page < totalPages ? String(page + 1) : undefined
      return nextCursor === undefined ? { items: results } : { items: results, nextCursor }
    },
    normalize(raw: TmdbMovie): Card | null {
      if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) return null
      const title = asString(raw.title)
      if (!title) return null
      const card: Card = {
        schemaVersion: 1,
        id: cardId('tmdb', String(raw.id)),
        sourceId: 'tmdb',
        title,
        fetchedAt: new Date(now()).toISOString(),
        url: `https://www.themoviedb.org/movie/${raw.id}`,
        attribution: ATTRIBUTION,
      }
      const year = raw.release_date?.slice(0, 4)
      if (year) card.subtitle = year
      const overview = asString(raw.overview)
      if (overview) card.body = overview.slice(0, MAX_BODY)

      const tags = [
        ...(raw.genre_ids ?? []).map((id) => options.genres?.[id] ?? `genre:${id}`),
        'movie',
      ]
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
      const unique = [...new Set(tags)].slice(0, MAX_TAGS)
      if (unique.length > 0) card.tags = unique

      if (raw.poster_path) {
        card.media = [
          {
            kind: 'image',
            url: `${imageBase}${raw.poster_path}`,
            alt: `Poster of ${title}`,
          },
        ]
      }
      const facts: NonNullable<Card['facts']> = []
      if (typeof raw.vote_average === 'number' && Number.isFinite(raw.vote_average)) {
        facts.push({ label: 'Rating', value: Number(raw.vote_average.toFixed(1)), unit: '/10' })
      }
      if (typeof raw.vote_count === 'number') {
        facts.push({ label: 'Votes', value: raw.vote_count })
      }
      if (raw.release_date) facts.push({ label: 'Released', value: raw.release_date })
      if (facts.length > 0) card.facts = facts

      const parsed = safeParseCard(card)
      return parsed.success ? parsed.data : null
    },
  }
}
