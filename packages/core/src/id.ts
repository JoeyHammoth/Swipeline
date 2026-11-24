const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const TIME_LENGTH = 10
const RANDOM_LENGTH = 16

function defaultRandom(): number {
  const source = globalThis.crypto
  if (source && typeof source.getRandomValues === 'function') {
    const buffer = new Uint32Array(1)
    source.getRandomValues(buffer)
    return (buffer[0] ?? 0) / 2 ** 32
  }
  return Math.random()
}

export interface UlidOptions {
  /** Milliseconds since the epoch. Injected so tests and benchmarks are deterministic. */
  now?: number
  /** Returns a number in [0, 1). Injected for deterministic ids. */
  random?: () => number
}

/**
 * Crockford base32 ULID: 48 bits of timestamp followed by 80 random bits.
 * Lexicographic order therefore matches time order, which is what lets the
 * event log sort by id alone. Injecting `now`/`random` keeps ids reproducible.
 */
export function createUlid(options: UlidOptions = {}): string {
  const random = options.random ?? defaultRandom
  let time = Math.max(0, Math.floor(options.now ?? Date.now()))
  let timePart = ''
  for (let index = 0; index < TIME_LENGTH; index += 1) {
    timePart = ENCODING.charAt(time % 32) + timePart
    time = Math.floor(time / 32)
  }

  let randomPart = ''
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    const value = Math.min(31, Math.max(0, Math.floor(random() * 32)))
    randomPart += ENCODING.charAt(value)
  }

  return timePart + randomPart
}
