import { assertAdapterConformance } from '@swipeline/adapter-testkit'
import { describe, expect, it, vi } from 'vitest'
import { createTheMealDbAdapter, type MealDbRow } from '../src/index.js'
import fixture from './fixtures/search.json' with { type: 'json' }

const meals = fixture.meals as MealDbRow[]

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('themealdb adapter', () => {
  it('passes adapter conformance', () => {
    const report = assertAdapterConformance(createTheMealDbAdapter(), {
      validRaw: meals,
      invalidRaw: [{ strMeal: 'No id' }, { idMeal: '1' }] as MealDbRow[],
    })
    expect(report.checked).toBe(2)
    expect(report.dropped).toBe(2)
  })

  it('maps instructions, tags and facts', () => {
    const card = createTheMealDbAdapter().normalize(meals[0] as MealDbRow)
    expect(card?.id).toBe('themealdb:52771')
    expect(card?.subtitle).toBe('Pasta · Italian')
    expect(card?.tags).toContain('spicy')
    expect(card?.facts).toContainEqual({ label: 'Cuisine', value: 'Italian' })
    expect(card?.media?.[0]?.alt).toContain('Spicy Arrabiata Penne')
  })

  it('treats a null meal list as an empty deck', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      response({ meals: null }),
    )
    const adapter = createTheMealDbAdapter({
      fetch: fetch as unknown as typeof globalThis.fetch,
      now: () => Date.UTC(2026, 10, 24),
    })
    const page = await adapter.fetch({ query: 'pasta' })
    expect(page).toEqual({ items: [] })
    expect(String(fetch.mock.calls[0]?.[0])).toContain('s=pasta')
  })
})
