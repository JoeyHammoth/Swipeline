import { expect, test } from '@playwright/test'
import { accessibilityViolations } from './axe'
import { deckText } from './deck'

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
    // Scan the page before the suite runs: the suite tears its deck down, and an
    // empty page passes every axe rule.
    await expect(page.locator('[role="application"]').first()).toBeVisible()
    // A page that renders nothing passes every axe rule, so prove a card is up.
    await expect.poll(() => deckText(page)).toContain('First card')
    expect(await accessibilityViolations(page)).toEqual([])

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
  })
}
