import {
  type Card,
  type CardAttribution,
  cardId,
  type FetchContext,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'

export interface OpenLibraryOptions {
  /** Injected in tests; defaults to global fetch. */
  fetch?: typeof globalThis.fetch
  /** Injected clock for deterministic `fetchedAt`. */
  now?: () => number
  baseUrl?: string
  /** Rows per page. Open Library documents a maximum of 100. */
  limit?: number
  retry?: { maxRetries?: number; sleep?: (ms: number) => Promise<void> }
}

export interface OpenLibraryDoc {
  key?: string
  title?: string
  author_name?: string[]
  subject?: string[]
  first_sentence?: string[]
  cover_i?: number
  first_publish_year?: number
}

const ATTRIBUTION: CardAttribution = {
  text: 'Data from Open Library',
  url: 'https://openlibrary.org',
  required: true,
}

const MAX_TAGS = 12

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Open Library search results as Cards. The search endpoint is paginated by
 * page number, exposes `numFound` for the last page and needs no key.
 */
export function createOpenLibraryAdapter(
  options: OpenLibraryOptions = {},
): SourceAdapter<OpenLibraryDoc> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? 'https://openlibrary.org'
  const limit = options.limit ?? 50
  const now = options.now ?? Date.now
  const sleep = options.retry?.sleep ?? delay
  const maxRetries = options.retry?.maxRetries ?? 2

  async function request(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let attempt = 0
    for (;;) {
      if (signal?.aborted) throw new Error('Open Library request aborted')
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
      if (!response.ok) throw new Error(`Open Library responded ${response.status}`)
      const json = (await response.json()) as unknown
      if (json === null || typeof json !== 'object')
        throw new Error('Open Library returned no object')
      return json as Record<string, unknown>
    }
  }

  return {
    id: 'openlibrary',
    capabilities: { pagination: 'offset', search: true },
    attribution: ATTRIBUTION,
    async fetch(ctx: FetchContext) {
      const page = ctx.cursor === undefined ? 1 : Number(ctx.cursor)
      const url = new URL('/search.json', baseUrl)
      url.searchParams.set('q', ctx.query?.trim() || '*')
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limit))
      const json = await request(url.toString(), ctx.signal)
      const docs = Array.isArray(json.docs) ? (json.docs as OpenLibraryDoc[]) : []
      const total = typeof json.numFound === 'number' ? json.numFound : docs.length
      const nextCursor = docs.length > 0 && page * limit < total ? String(page + 1) : undefined
      return nextCursor === undefined ? { items: docs } : { items: docs, nextCursor }
    },
    normalize(raw: OpenLibraryDoc): Card | null {
      const key = asString(raw.key)
      const title = asString(raw.title)
      if (!key || !title) return null
      const externalId = key.replace(/^\/works\//, '')
      const card: Card = {
        schemaVersion: 1,
        id: cardId('openlibrary', externalId),
        sourceId: 'openlibrary',
        title,
        fetchedAt: new Date(now()).toISOString(),
        url: `https://openlibrary.org${key.startsWith('/') ? key : `/works/${key}`}`,
        attribution: ATTRIBUTION,
      }
      const author = raw.author_name?.find((name) => asString(name))
      if (author) card.subtitle = author.trim()
      const sentence = raw.first_sentence?.find((entry) => asString(entry))
      if (sentence) card.body = sentence.trim()
      const tags = (raw.subject ?? [])
        .map((tag) => asString(tag)?.toLowerCase())
        .filter((tag): tag is string => Boolean(tag))
      const unique = [...new Set(tags)].slice(0, MAX_TAGS)
      if (unique.length > 0) card.tags = unique
      if (typeof raw.cover_i === 'number' && raw.cover_i > 0) {
        card.media = [
          {
            kind: 'image',
            url: `https://covers.openlibrary.org/b/id/${raw.cover_i}-M.jpg`,
            alt: `Cover of ${title}`,
          },
        ]
      }
      if (typeof raw.first_publish_year === 'number') {
        card.facts = [{ label: 'First published', value: raw.first_publish_year }]
      }
      const parsed = safeParseCard(card)
      return parsed.success ? parsed.data : null
    },
  }
}
