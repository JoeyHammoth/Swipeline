import { expect, test } from '@playwright/test'
import { accessibilityViolations } from '../axe'

/**
 * axe over the example decks. They render whatever their live source returns —
 * a card, a spinner, or an error with a retry button — and every one of those
 * states is something a person has to be able to use, so the scan runs on
 * whichever state the page settled in.
 */
const APPS = [
  { name: 'books-react', port: 4181 },
  { name: 'recipes-react', port: 4182 },
  { name: 'movies-tmdb', port: 4183 },
  { name: 'papers-html', port: 4184 },
] as const

for (const app of APPS) {
  test(`${app.name}: the deck page passes the WCAG A/AA rules`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(`http://127.0.0.1:${app.port}/`)
    await expect(page.getByRole('application')).toBeVisible()

    const state = await page.getByRole('application').evaluate((deck) => {
      const text = `${deck.textContent ?? ''} ${deck.shadowRoot?.textContent ?? ''}`.trim()
      if (deck.querySelector('[data-state]')?.getAttribute('data-state') === 'error') return 'error'
      if (deck.shadowRoot?.querySelector('[data-state="error"]')) return 'error'
      return text === '' ? 'empty' : 'content'
    })

    expect(await accessibilityViolations(page), `${app.name} (${state})`).toEqual([])
    expect(pageErrors).toEqual([])
  })
}
