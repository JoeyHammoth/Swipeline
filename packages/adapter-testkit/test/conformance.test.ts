import type { Card, SourceAdapter } from '@swipeline/core'
import { describe, expect, it } from 'vitest'
import { AdapterConformanceError, assertAdapterConformance } from '../src/index.js'

const ISO = new Date(Date.UTC(2026, 10, 24)).toISOString()

function adapter(overrides: Partial<SourceAdapter<{ id: string; title: string }>> = {}) {
  const base: SourceAdapter<{ id: string; title: string }> = {
    id: 'demo',
    capabilities: { pagination: 'none' },
    async fetch() {
      return { items: [] }
    },
    normalize(raw): Card | null {
      if (!raw.id || !raw.title) return null
      return {
        schemaVersion: 1,
        id: `demo:${raw.id}`,
        sourceId: 'demo',
        title: raw.title,
        fetchedAt: ISO,
      }
    },
  }
  return { ...base, ...overrides }
}

describe('assertAdapterConformance', () => {
  it('reports counts for a conforming adapter', () => {
    const report = assertAdapterConformance(adapter(), {
      validRaw: [{ id: '1', title: 'One' }],
      invalidRaw: [{ id: '', title: '' }],
    })
    expect(report.checked).toBe(1)
    expect(report.dropped).toBe(1)
  })

  it('fails when ids are not namespaced by the adapter', () => {
    const wrongId = adapter({
      normalize: (raw) => ({
        schemaVersion: 1,
        id: raw.id,
        sourceId: 'demo',
        title: raw.title,
        fetchedAt: ISO,
      }),
    })
    expect(() =>
      assertAdapterConformance(wrongId, { validRaw: [{ id: '1', title: 'One' }] }),
    ).toThrow(/not namespaced/)
  })

  it('fails when normalize throws on a bad row', () => {
    const throwing = adapter({
      normalize: () => {
        throw new Error('boom')
      },
    })
    expect(() => assertAdapterConformance(throwing, { validRaw: [] })).toThrow(
      AdapterConformanceError,
    )
  })

  it('lists every failure at once', () => {
    try {
      assertAdapterConformance(adapter({ id: '' }), {
        validRaw: [{ id: '1', title: 'One' }],
        invalidRaw: [{ id: '2', title: 'Two' }],
      })
      throw new Error('expected a conformance failure')
    } catch (error) {
      expect(error).toBeInstanceOf(AdapterConformanceError)
      expect((error as AdapterConformanceError).failures.length).toBeGreaterThan(1)
    }
  })
})
