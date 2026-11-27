import { fileURLToPath } from 'node:url'

/**
 * Resolve workspace packages to their sources. A fresh clone can then run an
 * example with `pnpm install && pnpm --filter ./examples/<name> dev`, without a
 * prior `pnpm build`, and edits in `packages/**` show up immediately.
 */
const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export const workspaceAliases: Record<string, string> = {
  '@swipeline/adapter-arxiv': source('../packages/adapter-arxiv/src/index.ts'),
  '@swipeline/adapter-openlibrary': source('../packages/adapter-openlibrary/src/index.ts'),
  '@swipeline/adapter-themealdb': source('../packages/adapter-themealdb/src/index.ts'),
  '@swipeline/adapter-tmdb': source('../packages/adapter-tmdb/src/index.ts'),
  '@swipeline/binding-testkit': source('../packages/binding-testkit/src/index.ts'),
  '@swipeline/cards': source('../packages/cards/src/index.ts'),
  '@swipeline/core': source('../packages/core/src/index.ts'),
  '@swipeline/element': source('../packages/element/src/index.ts'),
  '@swipeline/gestures': source('../packages/gestures/src/index.ts'),
  '@swipeline/i18n': source('../packages/i18n/src/index.ts'),
  '@swipeline/theme': source('../packages/theme/src/index.ts'),
  '@swipeline/svelte': source('../packages/svelte/src/index.ts'),
  '@swipeline/vue': source('../packages/vue/src/index.ts'),
  // Longest key first: Vite aliases match by prefix, so the stylesheet must be
  // listed before the package root that would otherwise resolve it as a subpath.
  '@swipeline/react/styles.css': source('../packages/react/styles.css'),
  '@swipeline/react': source('../packages/react/src/index.tsx'),
  '@swipeline/store-indexeddb': source('../packages/store-indexeddb/src/index.ts'),
}
