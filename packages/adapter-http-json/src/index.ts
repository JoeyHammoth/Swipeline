import {
  type Card,
  type CardAttribution,
  cardId,
  type FetchContext,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'
import { readPath } from './read-path.js'

export { readPath } from './read-path.js'

export type PaginationMode = 'page' | 'offset' | 'cursor' | 'none'

export interface PaginationConfig {
  mode: PaginationMode
  /** Query parameter that carries the page/offset/cursor. Defaults per mode. */
  param?: string
  /** Rows requested per page; also used to detect the last page. Defaults to 20. */
  pageSize?: number
  /** First page/offset value. Defaults to 1 for `page`, 0 for `offset`. */
  start?: number
  /** For `cursor` mode: expression that yields the next cursor. Defaults to `next`. */
  nextPath?: string
}

export interface FieldMap {
  /** External id expression; required and must be non-empty after mapping. */
  id: string
  title: string
  subtitle?: string
  body?: string
  /** Array or comma-separated string; lower-cased, trimmed, deduplicated, max 12. */
  tags?: string
  url?: string
  /** Array of URL strings or `{url, alt, kind}` objects. */
  media?: string
  /** Array of `{label, value, unit}` objects. */
  facts?: string
  /** Object copied into `Card.extra`. */
  extra?: string
}

export interface HttpJsonAdapterConfig {
  /** Source id used in card ids. Must be stable between versions. */
  id: string
  /** Absolute URL. Supports `{page}`, `{offset}`, `{cursor}`, `{limit}` and `{query}`. */
  url: string
  /** Expression for the array of raw rows. Defaults to the response itself. */
  itemsPath?: string
  map: FieldMap
  pagination?: PaginationConfig
  /** Query parameter for `ctx.query`; defaults to `q`. Pass `false` to disable search. */
  queryParam?: string | false
  /** Declared filter names, appended as query parameters. */
  filters?: readonly string[]
  attribution?: CardAttribution
  /** Injected for tests; defaults to global `fetch`. */
  fetch?: typeof globalThis.fetch
  retry?: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    /** Injected in tests so retry tests do not wait. */
    sleep?: (ms: number) => Promise<void>
  }
  /** Injected clock for deterministic `fetchedAt`. */
  now?: () => number
}

export interface HttpJsonStats {
  fetched: number
  dropped: number
}

export interface HttpJsonAdapter extends SourceAdapter<unknown> {
  readonly stats: HttpJsonStats
  resetStats(): void
}

export class HttpJsonError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'HttpJsonError'
    this.status = status
  }
}

const MAX_TAGS = 12
const DEFAULT_PAGE_SIZE = 20

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
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

function normalizeTags(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const entry of raw) {
    const tag = asString(entry)?.toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length === MAX_TAGS) break
  }
  return tags.length > 0 ? tags : undefined
}

function normalizeMedia(value: unknown): Card['media'] | undefined {
  if (!Array.isArray(value)) return undefined
  const media: NonNullable<Card['media']> = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      if (!isHttpUrl(entry)) continue
      media.push({ kind: 'image', url: entry })
      continue
    }
    if (entry === null || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const url = asString(record.url)
    if (!url || !isHttpUrl(url)) continue
    const kind = record.kind === 'video' ? 'video' : 'image'
    const item: NonNullable<Card['media']>[number] = { kind, url }
    const alt = asString(record.alt)
    if (alt) item.alt = alt
    media.push(item)
  }
  return media.length > 0 ? media : undefined
}

function normalizeFacts(value: unknown): Card['facts'] | undefined {
  if (!Array.isArray(value)) return undefined
  const facts: NonNullable<Card['facts']> = []
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const label = asString(record.label)
    const factValue = record.value
    if (!label) continue
    if (typeof factValue !== 'string' && typeof factValue !== 'number') continue
    const fact: NonNullable<Card['facts']>[number] = { label, value: factValue }
    const unit = asString(record.unit)
    if (unit) fact.unit = unit
    facts.push(fact)
  }
  return facts.length > 0 ? facts : undefined
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(header)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * One adapter for any REST/JSON source: a URL, an items path, a field map and a
 * pagination mode. Retries 429/5xx with backoff and `Retry-After`, respects the
 * abort signal, drops rows that do not map to a Card instead of failing a page.
 */
export function createHttpJsonAdapter(config: HttpJsonAdapterConfig): HttpJsonAdapter {
  const pagination: PaginationConfig = config.pagination ?? { mode: 'none' }
  const pageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE
  const mode = pagination.mode
  const fetchImpl = config.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createHttpJsonAdapter needs a fetch implementation')
  }
  const sleep = config.retry?.sleep ?? delay
  const maxRetries = config.retry?.maxRetries ?? 2
  const baseDelay = config.retry?.baseDelayMs ?? 300
  const maxDelay = config.retry?.maxDelayMs ?? 5_000
  const now = config.now ?? Date.now

  const stats: HttpJsonStats = { fetched: 0, dropped: 0 }

  function requestUrl(ctx: FetchContext): string {
    const page = ctx.cursor === undefined ? (pagination.start ?? 1) : Number(ctx.cursor)
    const offset = ctx.cursor === undefined ? (pagination.start ?? 0) : Number(ctx.cursor)
    const query = ctx.query ?? ''
    const replaced = config.url
      .replaceAll('{page}', String(page))
      .replaceAll('{offset}', String(offset))
      .replaceAll('{cursor}', encodeURIComponent(ctx.cursor ?? ''))
      .replaceAll('{limit}', String(pageSize))
      .replaceAll('{query}', encodeURIComponent(query))

    const url = new URL(replaced)
    if (mode === 'page' && !config.url.includes('{page}')) {
      url.searchParams.set(pagination.param ?? 'page', String(page))
    }
    if (mode === 'offset' && !config.url.includes('{offset}')) {
      url.searchParams.set(pagination.param ?? 'offset', String(offset))
    }
    if (mode === 'cursor' && ctx.cursor !== undefined && !config.url.includes('{cursor}')) {
      url.searchParams.set(pagination.param ?? 'cursor', ctx.cursor)
    }
    if (mode !== 'none' && mode !== 'cursor' && !config.url.includes('{limit}')) {
      url.searchParams.set('limit', String(pageSize))
    }
    if (ctx.query && config.queryParam !== false) {
      url.searchParams.set(config.queryParam ?? 'q', ctx.query)
    }
    for (const [key, value] of Object.entries(ctx.filters ?? {})) {
      if (!(config.filters ?? []).includes(key)) continue
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  function nextCursorFor(
    current: number,
    items: readonly unknown[],
    pageJson: unknown,
  ): string | undefined {
    if (mode === 'none') return undefined
    if (mode === 'cursor') {
      const next = readPath(pageJson, pagination.nextPath ?? 'next')
      return asString(next)
    }
    if (items.length < pageSize) return undefined
    return String(mode === 'page' ? current + 1 : current + pageSize)
  }

  function normalize(raw: unknown): Card | null {
    const externalId = asString(readPath(raw, config.map.id))
    const title = asString(readPath(raw, config.map.title))
    if (!externalId || !title) {
      stats.dropped += 1
      return null
    }

    const card: Card = {
      schemaVersion: 1,
      id: cardId(config.id, externalId),
      sourceId: config.id,
      title,
      fetchedAt: new Date(now()).toISOString(),
    }

    const subtitle = config.map.subtitle ? asString(readPath(raw, config.map.subtitle)) : undefined
    if (subtitle) card.subtitle = subtitle
    const body = config.map.body ? asString(readPath(raw, config.map.body)) : undefined
    if (body) card.body = body
    const tags = config.map.tags ? normalizeTags(readPath(raw, config.map.tags)) : undefined
    if (tags) card.tags = tags
    const url = config.map.url ? asString(readPath(raw, config.map.url)) : undefined
    if (url && isHttpUrl(url)) card.url = url
    const media = config.map.media ? normalizeMedia(readPath(raw, config.map.media)) : undefined
    if (media) card.media = media
    const facts = config.map.facts ? normalizeFacts(readPath(raw, config.map.facts)) : undefined
    if (facts) card.facts = facts
    if (config.map.extra) {
      const extra = readPath(raw, config.map.extra)
      if (extra !== null && typeof extra === 'object' && !Array.isArray(extra)) {
        card.extra = extra as Record<string, unknown>
      }
    }
    if (config.attribution) card.attribution = config.attribution

    const parsed = safeParseCard(card)
    if (!parsed.success) {
      stats.dropped += 1
      return null
    }
    return parsed.data
  }

  async function fetchPage(ctx: FetchContext): Promise<{ items: unknown[]; nextCursor?: string }> {
    const url = requestUrl(ctx)
    let attempt = 0
    for (;;) {
      if (ctx.signal?.aborted) throw new HttpJsonError('request aborted')
      try {
        const init: RequestInit = { headers: { accept: 'application/json' } }
        if (ctx.signal) init.signal = ctx.signal
        const response = await fetchImpl(url, init)

        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxRetries) {
            const hinted = retryAfterMs(response.headers.get('retry-after'))
            const backoff = Math.min(maxDelay, baseDelay * 2 ** attempt)
            attempt += 1
            await sleep(hinted ?? backoff)
            continue
          }
          throw new HttpJsonError(
            `source responded ${response.status} after retries`,
            response.status,
          )
        }
        if (!response.ok) {
          throw new HttpJsonError(`source responded ${response.status}`, response.status)
        }

        let json: unknown
        try {
          json = await response.json()
        } catch {
          throw new HttpJsonError('source did not return JSON', response.status)
        }
        const candidates = config.itemsPath ? readPath(json, config.itemsPath) : json
        if (!Array.isArray(candidates)) {
          throw new HttpJsonError('itemsPath did not resolve to an array')
        }
        stats.fetched += candidates.length
        const fallback = mode === 'page' ? 1 : 0
        const current =
          ctx.cursor === undefined ? (pagination.start ?? fallback) : Number(ctx.cursor)
        const nextCursor = nextCursorFor(current, candidates, json)
        return nextCursor === undefined ? { items: candidates } : { items: candidates, nextCursor }
      } catch (cause) {
        if (cause instanceof HttpJsonError) throw cause
        if (attempt >= maxRetries) {
          throw new HttpJsonError(cause instanceof Error ? cause.message : 'network request failed')
        }
        attempt += 1
        await sleep(Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)))
      }
    }
  }

  // The core contract speaks cursor/offset/none; a page number is an offset,
  // so it is advertised as such while the request layer keeps using `page`.
  const capabilities: SourceAdapter['capabilities'] = {
    pagination: mode === 'page' ? 'offset' : mode,
  }
  if (config.queryParam !== false) capabilities.search = true
  if (config.filters && config.filters.length > 0) capabilities.filters = [...config.filters]

  const adapter: HttpJsonAdapter = {
    id: config.id,
    capabilities,
    ...(config.attribution ? { attribution: config.attribution } : {}),
    fetch: fetchPage,
    normalize,
    stats,
    resetStats(): void {
      stats.fetched = 0
      stats.dropped = 0
    },
  }
  return adapter
}
