import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The package tests run the suite under jsdom. These run the same assertions in a
 * real browser, against the fixture page each binding ships, so pointer, keyboard
 * and shadow-DOM behaviour is certified rather than simulated. axe then checks the
 * same page against the WCAG A and AA rules.
 */
const FIXTURES = ['react', 'element', 'vue', 'svelte'] as const

for (const name of FIXTURES) {
  test(`${name} binding passes the conformance suite in Chromium`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(`/${name}.html`)
    const report = await page.evaluate(async () => {
      const fixture = window as Window & {
        __swipelineConformance?: () => Promise<{ binding: string; checks: number }>
      }
      if (!fixture.__swipelineConformance) {
        throw new Error('The fixture page did not expose __swipelineConformance')
      }
      return fixture.__swipelineConformance()
    })

    expect(pageErrors).toEqual([])
    expect(report).toEqual({ binding: name, checks: 7 })

    // WCAG 2.0, 2.1 and 2.2 at levels A and AA. The newer rule sets are what
    // catch focus-not-obscured, dragging alternatives and target size, which the
    // 2.0 tags alone do not include.
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(
      accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([])
  })
}
