import { describe, expect, it } from 'vitest'
import { runBenchmark } from '../src/index.js'

describe('runBenchmark', () => {
  it('is deterministic for a seed', async () => {
    const first = await runBenchmark({ seed: 7, users: 4, cards: 20, k: 5 })
    const second = await runBenchmark({ seed: 7, users: 4, cards: 20, k: 5 })
    expect(first).toEqual(second)
  })

  it('reports every strategy and metric', async () => {
    const report = await runBenchmark({ seed: 7, users: 3, cards: 20, k: 5 })
    for (const strategy of ['default', 'random', 'popularity', 'tagOnly'] as const) {
      const metrics = report.strategies[strategy]
      expect(metrics.picks).toBeGreaterThan(0)
      expect(metrics.precisionAtK).toBeGreaterThanOrEqual(0)
      expect(metrics.precisionAtK).toBeLessThanOrEqual(1)
      expect(metrics.diversity).toBeGreaterThanOrEqual(0)
      expect(metrics.coverage).toBeGreaterThan(0)
      expect(metrics.regret).toBeGreaterThanOrEqual(0)
    }
  })

  it('separates seeds so results are not accidentally identical', async () => {
    const a = await runBenchmark({ seed: 1, users: 3, cards: 20, k: 5 })
    const b = await runBenchmark({ seed: 2, users: 3, cards: 20, k: 5 })
    expect(a.strategies.default.precisionAtK).not.toBe(b.strategies.default.precisionAtK)
  })

  it('beats random by the documented margin on the default seed', async () => {
    const report = await runBenchmark({ seed: 42, users: 20, cards: 60, k: 10 })
    expect(report.strategies.default.precisionAtK).toBeGreaterThan(
      report.strategies.random.precisionAtK,
    )
    expect(report.strategies.default.precisionAtK).toBeGreaterThanOrEqual(
      report.strategies.popularity.precisionAtK - 0.05,
    )
  })
})
