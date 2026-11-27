import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The package tests run the suite under jsdom. These run the same assertions in a
 * real browser, against the fixture page each binding ships, so pointer, keyboard
 * and shadow-DOM behaviour is certified rather than simulated. axe then checks the
 * same page against the WCAG A and AA rules.
 */
const FIXTURES = ['react', 'element', 'vue'] as const

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

    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(
      accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([])
  })
}
