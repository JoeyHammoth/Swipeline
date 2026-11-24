import type { Card } from './card.js'

/** Call context passed to `SourceAdapter.fetch`. */
export interface FetchContext {
  /** Opaque cursor from the previous page; absent on the first page. */
  cursor?: string
  /** Free-text query when `capabilities.search` is true. */
  query?: string
  /** Declared filters from `capabilities.filters`. */
  filters?: Record<string, unknown>
  signal?: AbortSignal
}

/**
 * Turns raw records from one source into Cards.
 *
 * `normalize` returns `null` for anything it cannot map and never throws on a
 * single malformed record: one bad row must not empty a deck. The engine also
 * guards against a throwing adapter, so a bug degrades to a skipped card.
 */
export interface SourceAdapter<TRaw = unknown> {
  id: string
  capabilities: {
    pagination: 'cursor' | 'offset' | 'none'
    search?: boolean
    filters?: string[]
  }
  attribution?: Card['attribution']
  fetch(ctx: FetchContext): Promise<{ items: TRaw[]; nextCursor?: string }>
  normalize(raw: TRaw): Card | null
}
