import {
  type Card,
  cardSchema,
  isCardIdForSource,
  type SourceAdapter,
  safeParseCard,
} from '@swipeline/core'

export interface AdapterConformanceOptions<TRaw> {
  /** Rows the adapter must normalize. At least one is required. */
  validRaw: readonly TRaw[]
  /** Rows the adapter must drop without throwing. */
  invalidRaw?: readonly TRaw[]
}

export interface ConformanceReport {
  adapterId: string
  checked: number
  dropped: number
}

export class AdapterConformanceError extends Error {
  readonly failures: readonly string[]

  constructor(adapterId: string, failures: readonly string[]) {
    super(`Adapter "${adapterId}" failed conformance:\n- ${failures.join('\n- ')}`)
    this.name = 'AdapterConformanceError'
    this.failures = failures
  }
}

function assertCards(adapterId: string, cards: readonly (Card | null)[], failures: string[]): void {
  if (cards.length === 0) failures.push('normalize produced no cards for valid rows')
  for (const [index, card] of cards.entries()) {
    if (!card) {
      failures.push(`valid row ${index} normalized to null`)
      continue
    }
    const parsed = safeParseCard(card)
    if (!parsed.success) failures.push(`valid row ${index} is not a Card: ${parsed.error.message}`)
    if (card.sourceId !== adapterId) {
      failures.push(`valid row ${index} has sourceId "${card.sourceId}", expected "${adapterId}"`)
    }
    if (!isCardIdForSource(card.id, adapterId)) {
      failures.push(`valid row ${index} id "${card.id}" is not namespaced by "${adapterId}"`)
    }
    if (card.tags) {
      const normalized = card.tags.map((tag) => tag.trim().toLowerCase())
      if (normalized.some((tag, i) => tag !== card.tags?.[i])) {
        failures.push(`valid row ${index} has unnormalized tags`)
      }
      if (new Set(card.tags).size !== card.tags.length) {
        failures.push(`valid row ${index} has duplicate tags`)
      }
    }
  }
}

/**
 * The checks every adapter must pass, independent of the source. Throws an
 * `AdapterConformanceError` listing every failure so a new adapter PR shows all
 * problems at once instead of one per run.
 *
 * The testkit does not invent fixtures: adapters pass real recorded rows, and
 * the same helper runs for `http-json` and hand-written adapters in CI.
 */
export function assertAdapterConformance<TRaw>(
  adapter: SourceAdapter<TRaw>,
  options: AdapterConformanceOptions<TRaw>,
): ConformanceReport {
  const failures: string[] = []

  if (!adapter.id) failures.push('adapter.id is empty')
  if (!['cursor', 'offset', 'none'].includes(adapter.capabilities.pagination)) {
    failures.push(`unknown pagination mode "${adapter.capabilities.pagination}"`)
  }

  const cards = options.validRaw.map((raw) => {
    try {
      return adapter.normalize(raw)
    } catch (cause) {
      failures.push(`normalize threw on a valid row: ${String(cause)}`)
      return null
    }
  })
  assertCards(adapter.id, cards, failures)

  // Ids must be stable across calls, or history breaks on a refetch.
  for (const [index, raw] of options.validRaw.entries()) {
    const first = cards[index]
    if (!first) continue
    const second = adapter.normalize(raw)
    if (second?.id !== first.id) {
      failures.push(`valid row ${index} produced a different id on a second call`)
    }
  }

  let dropped = 0
  for (const [index, raw] of (options.invalidRaw ?? []).entries()) {
    let card: Card | null = null
    try {
      card = adapter.normalize(raw)
    } catch (cause) {
      failures.push(`normalize threw instead of dropping invalid row ${index}: ${String(cause)}`)
      continue
    }
    if (card === null) {
      dropped += 1
      continue
    }
    const parsed = cardSchema.safeParse(card)
    if (parsed.success) failures.push(`invalid row ${index} was accepted as a Card`)
  }

  if (failures.length > 0) throw new AdapterConformanceError(adapter.id, failures)
  return { adapterId: adapter.id, checked: cards.length, dropped }
}
