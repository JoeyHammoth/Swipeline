import type { Page } from '@playwright/test'

/**
 * The deck's text, including a shadow root when the binding renders into one.
 * A role locator finds the deck inside open shadow trees; `textContent` alone
 * would miss the Web Component's contents.
 */
export async function deckText(page: Page): Promise<string> {
  const deck = page.locator('[role="application"]').first()
  return deck.evaluate((element) =>
    `${element.textContent ?? ''} ${element.shadowRoot?.textContent ?? ''}`
      .replace(/\s+/g, ' ')
      .trim(),
  )
}
