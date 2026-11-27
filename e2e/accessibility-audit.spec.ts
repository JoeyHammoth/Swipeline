import { expect, type Page, test } from '@playwright/test'
import { accessibilityViolations } from './axe'
import { deckText } from './deck'

/**
 * The parts of the accessibility audit a browser can check by itself: keyboard
 * only operation, reflow at 320 CSS px, the WCAG 2.2 target-size minimum, forced
 * colours and reduced motion. Screen-reader and touch passes stay manual; see
 * docs/reference/a11y-audit.md.
 */
const FIXTURES = ['react', 'element', 'vue', 'svelte'] as const

/** What holds focus, descending into a shadow root, as the browser would. */
async function focused(page: Page): Promise<{ role: string | null; action: string | null }> {
  return page.evaluate(() => {
    let active = document.activeElement as HTMLElement | null
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement as HTMLElement | null
    }
    return {
      role: active?.getAttribute('role') ?? null,
      action: active?.getAttribute('data-action') ?? null,
    }
  })
}

for (const name of FIXTURES) {
  test(`${name}: keyboard-only reaches the deck and every action`, async ({ page }) => {
    await page.goto(`/${name}.html`)
    const start = await deckText(page)

    const tabUntil = async (predicate: () => Promise<boolean>): Promise<boolean> => {
      for (let pass = 0; pass < 12; pass += 1) {
        await page.keyboard.press('Tab')
        if (await predicate()) return true
      }
      return false
    }

    expect(
      await tabUntil(async () => (await focused(page)).role === 'application'),
      'Tab never reached the deck',
    ).toBe(true)

    await page.keyboard.press('ArrowRight')
    await expect.poll(() => deckText(page)).not.toBe(start)
    // Focus stays on the deck after an advance instead of falling back to <body>.
    expect((await focused(page)).role).toBe('application')

    expect(
      await tabUntil(async () => (await focused(page)).action !== null),
      'Tab never reached an action button',
    ).toBe(true)

    const beforeAction = await deckText(page)
    await page.keyboard.press('Enter')
    await expect.poll(() => deckText(page)).not.toBe(beforeAction)
  })

  test(`${name}: reflows at 320 CSS px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(`/${name}.html`)
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(width.scroll, 'the page scrolls horizontally at 320px').toBeLessThanOrEqual(
      width.client + 1,
    )
  })

  test(`${name}: action targets meet the WCAG 2.2 minimum`, async ({ page }) => {
    await page.goto(`/${name}.html`)
    const controls = page.locator('[data-action]')
    const count = await controls.count()
    expect(count).toBeGreaterThanOrEqual(4)
    for (let index = 0; index < count; index += 1) {
      const box = await controls.nth(index).boundingBox()
      expect(box, `action ${index} has no box`).not.toBeNull()
      if (box) {
        expect(box.width, `action ${index} is narrower than 24px`).toBeGreaterThanOrEqual(24)
        expect(box.height, `action ${index} is shorter than 24px`).toBeGreaterThanOrEqual(24)
      }
    }
  })

  test.describe(`${name} with forced colours`, () => {
    test.use({ forcedColors: 'active' })

    test(`${name}: passes the WCAG A/AA rules`, async ({ page }) => {
      await page.goto(`/${name}.html`)
      expect(await accessibilityViolations(page)).toEqual([])
    })
  })

  test.describe(`${name} with reduced motion`, () => {
    test.use({ reducedMotion: 'reduce' })

    test(`${name}: still advances on a key press`, async ({ page }) => {
      await page.goto(`/${name}.html`)
      const start = await deckText(page)
      await page.keyboard.press('Tab')
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => deckText(page)).not.toBe(start)
    })
  })
}
