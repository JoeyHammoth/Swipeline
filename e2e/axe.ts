import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * WCAG 2.0, 2.1 and 2.2 at levels A and AA. The newer rule sets are what catch
 * focus not obscured, a non-drag way to operate the deck, and target size, which
 * the 2.0 tags alone do not include.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const

export interface AxeViolationReport {
  readonly id: string
  readonly impact: string | null | undefined
  readonly nodes: readonly unknown[]
}

/** Violations only: incomplete and inapplicable results are not failures. */
export async function accessibilityViolations(page: Page): Promise<AxeViolationReport[]> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze()
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target),
  }))
}
