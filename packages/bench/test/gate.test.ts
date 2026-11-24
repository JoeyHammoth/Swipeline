import { describe, expect, it } from 'vitest'
import { runBenchmark } from '../src/index.js'

/**
 * The CI gate. The benchmark is synthetic, so the thresholds are about
 * regression, not a quality claim: the default pipeline must clearly beat
 * random and must not fall behind popularity by the documented margin.
 */
describe('ranking benchmark gate', () => {
  it('keeps the default pipeline ahead of random on the fixed seed', async () => {
    const report = await runBenchmark({ seed: 42, users: 20, cards: 60, k: 10 })
    const { default: pipeline, random, popularity } = report.strategies
    expect(pipeline.precisionAtK).toBeGreaterThan(random.precisionAtK * 1.1)
    expect(pipeline.precisionAtK).toBeGreaterThanOrEqual(popularity.precisionAtK - 0.05)
    expect(pipeline.precisionAtK).toBeLessThanOrEqual(1)
    expect(pipeline.diversity).toBeGreaterThan(0.03)
    expect(pipeline.coverage).toBeGreaterThan(0.3)
  })
})
