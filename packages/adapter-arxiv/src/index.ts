import {
  type Card,
  type CardAttribution,
  cardId,
  type FetchContext,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'

export interface ArxivOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  baseUrl?: string
  /** Categories combined with OR when the query is empty. */
  categories?: readonly string[]
  /** Entries per page. arXiv caps this at 2000. */
  limit?: number
  retry?: { maxRetries?: number; sleep?: (ms: number) => Promise<void> }
}

/** One parsed `<entry>` from the arXiv Atom feed. */
export interface ArxivEntry {
  id: string
  title: string
  summary: string
  published?: string
  authors: string[]
  categories: string[]
  url?: string
}

const ATTRIBUTION: CardAttribution = {
  text: 'Powered by arXiv',
  url: 'https://arxiv.org',
  required: true,
}

const MAX_BODY = 600
const MAX_TAGS = 8

function decode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function textOf(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match?.[1] === undefined ? undefined : decode(match[1])
}

/** Parses the subset of Atom that arXiv returns; exported for fixture tests. */
export function parseArxivFeed(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = []
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1] ?? ''
    const id = textOf(block, 'id')
    const title = textOf(block, 'title')
    if (!id || !title) continue
    const summary = textOf(block, 'summary') ?? ''
    const published = textOf(block, 'published')
    const authors = [...block.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((entry) => decode(entry[1] ?? ''))
      .filter(Boolean)
    const categories = [...block.matchAll(/term="([^"]+)"/g)]
      .map((entry) => entry[1] ?? '')
      .filter(Boolean)
    const alternate = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1]
    const entry: ArxivEntry = { id, title, summary, authors, categories }
    if (published) entry.published = published
    if (alternate) entry.url = alternate
    entries.push(entry)
  }
  return entries
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * arXiv Atom API as paper Cards. Queries are passed through as an arXiv search
 * expression; without one, the configured categories are OR-ed.
 */
export function createArxivAdapter(options: ArxivOptions = {}): SourceAdapter<ArxivEntry> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? 'https://export.arxiv.org/api/query'
  const limit = options.limit ?? 50
  const now = options.now ?? Date.now
  const categories = options.categories ?? ['cs.LG', 'cs.CL']
  const sleep = options.retry?.sleep ?? delay
  const maxRetries = options.retry?.maxRetries ?? 2

  async function request(url: string, signal?: AbortSignal): Promise<string> {
    let attempt = 0
    for (;;) {
      if (signal?.aborted) throw new Error('arXiv request aborted')
      const init: RequestInit = { headers: { accept: 'application/atom+xml' } }
      if (signal) init.signal = signal
      const response = await fetchImpl(url, init)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          attempt += 1
          await sleep(300 * 2 ** (attempt - 1))
          continue
        }
      }
      if (!response.ok) throw new Error(`arXiv responded ${response.status}`)
      return response.text()
    }
  }

  return {
    id: 'arxiv',
    capabilities: { pagination: 'offset', search: true },
    attribution: ATTRIBUTION,
    async fetch(ctx: FetchContext) {
      const start = ctx.cursor === undefined ? 0 : Number(ctx.cursor)
      const url = new URL(baseUrl)
      const query = ctx.query?.trim()
      url.searchParams.set(
        'search_query',
        query || categories.map((category) => `cat:${category}`).join(' OR '),
      )
      url.searchParams.set('start', String(start))
      url.searchParams.set('max_results', String(limit))
      url.searchParams.set('sortBy', 'submittedDate')
      url.searchParams.set('sortOrder', 'descending')
      const entries = parseArxivFeed(await request(url.toString(), ctx.signal))
      const nextCursor = entries.length === limit ? String(start + limit) : undefined
      return nextCursor === undefined ? { items: entries } : { items: entries, nextCursor }
    },
    normalize(raw: ArxivEntry): Card | null {
      const title = raw.title.trim()
      if (!title || !raw.id) return null
      const externalId = raw.id.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '')
      const card: Card = {
        schemaVersion: 1,
        id: cardId('arxiv', externalId || raw.id),
        sourceId: 'arxiv',
        title,
        fetchedAt:
          raw.published && Number.isFinite(Date.parse(raw.published))
            ? new Date(raw.published).toISOString()
            : new Date(now()).toISOString(),
        url: raw.url ?? raw.id,
        attribution: ATTRIBUTION,
      }
      if (raw.authors.length > 0) card.subtitle = raw.authors.slice(0, 4).join(', ')
      if (raw.summary) card.body = raw.summary.slice(0, MAX_BODY)
      const tags = [...new Set(raw.categories.map((tag) => tag.toLowerCase()))].slice(0, MAX_TAGS)
      if (tags.length > 0) card.tags = tags
      if (raw.published && Number.isFinite(Date.parse(raw.published))) {
        card.facts = [{ label: 'Published', value: raw.published.slice(0, 10) }]
      }
      const parsed = safeParseCard(card)
      return parsed.success ? parsed.data : null
    },
  }
}
