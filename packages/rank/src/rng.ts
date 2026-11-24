/** Small seeded PRNG (mulberry32). Deterministic across platforms. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Marsaglia–Tsang gamma sampler, used for exact Beta samples in Thompson. */
function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    const u = Math.max(rng(), Number.EPSILON)
    return sampleGamma(shape + 1, rng) * u ** (1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = gaussian(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function sampleBeta(a: number, b: number, rng: () => number): number {
  const left = Math.max(a, Number.EPSILON)
  const right = Math.max(b, Number.EPSILON)
  const x = sampleGamma(left, rng)
  const y = sampleGamma(right, rng)
  return x / (x + y)
}
