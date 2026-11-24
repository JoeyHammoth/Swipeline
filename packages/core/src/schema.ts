/**
 * Shared identifiers and constants for the wire formats.
 *
 * Every schema in this package is versioned. A change to the shape of `Card`,
 * `SwipeEvent` or `Profile` bumps `SCHEMA_VERSION` and ships a migration; see
 * docs/architecture/contracts.md.
 */

/** Version stamped into every serialized Card, SwipeEvent and Profile. */
export const SCHEMA_VERSION = 1

/**
 * Crockford base32 ULID: 26 characters, no I, L, O or U, so ids sort by time
 * and cannot be confused with look-alike digits when read by a human.
 */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function isUlid(value: string): boolean {
  return ULID_PATTERN.test(value)
}

/**
 * A card id is namespaced by its source so one history can span many sources
 * without collisions: `${sourceId}:${externalId}`.
 */
export function cardId(sourceId: string, externalId: string): string {
  if (!sourceId) throw new TypeError('sourceId is required')
  if (!externalId) throw new TypeError('externalId is required')
  return `${sourceId}:${externalId}`
}

/** Splits a card id back into its source and external parts. */
export function parseCardId(id: string): { sourceId: string; externalId: string } | null {
  const separator = id.indexOf(':')
  if (separator <= 0 || separator === id.length - 1) return null
  return { sourceId: id.slice(0, separator), externalId: id.slice(separator + 1) }
}

/** True when `id` is namespaced by `sourceId`. */
export function isCardIdForSource(id: string, sourceId: string): boolean {
  return id.startsWith(`${sourceId}:`) && id.length > sourceId.length + 1
}
