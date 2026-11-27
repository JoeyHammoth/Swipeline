import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Tests import workspace packages by name. Resolve them to source so a test
      // run does not depend on a prior build, and so coverage is measured there.
      '@swipeline/store-memory/conformance': source('./packages/store-memory/src/conformance.ts'),
      '@swipeline/adapter-testkit': source('./packages/adapter-testkit/src/index.ts'),
      '@swipeline/adapter-http-json': source('./packages/adapter-http-json/src/index.ts'),
      '@swipeline/store-indexeddb': source('./packages/store-indexeddb/src/index.ts'),
      '@swipeline/store-postgres': source('./packages/store-postgres/src/index.ts'),
      '@swipeline/store-remote': source('./packages/store-remote/src/index.ts'),
      '@swipeline/store-sqlite': source('./packages/store-sqlite/src/index.ts'),
      '@swipeline/sinks': source('./packages/sinks/src/index.ts'),
      '@swipeline/store-memory': source('./packages/store-memory/src/index.ts'),
      '@swipeline/gestures': source('./packages/gestures/src/index.ts'),
      '@swipeline/cards': source('./packages/cards/src/index.ts'),
      '@swipeline/theme': source('./packages/theme/src/index.ts'),
      '@swipeline/i18n': source('./packages/i18n/src/index.ts'),
      '@swipeline/vue': source('./packages/vue/src/index.ts'),
      '@swipeline/core': source('./packages/core/src/index.ts'),
      '@swipeline/server': source('./packages/server/src/index.ts'),
      '@swipeline/cli': source('./packages/cli/src/index.ts'),
      '@swipeline/bench': source('./packages/bench/src/index.ts'),
      '@swipeline/rank': source('./packages/rank/src/index.ts'),
      '@swipeline/react': source('./packages/react/src/index.ts'),
      '@swipeline/embed': source('./packages/embed/src/index.ts'),
      '@swipeline/vector': source('./packages/vector/src/index.ts'),
      '@swipeline/adapter-openlibrary': source('./packages/adapter-openlibrary/src/index.ts'),
      '@swipeline/adapter-themealdb': source('./packages/adapter-themealdb/src/index.ts'),
      '@swipeline/adapter-arxiv': source('./packages/adapter-arxiv/src/index.ts'),
      '@swipeline/adapter-tmdb': source('./packages/adapter-tmdb/src/index.ts'),
      '@swipeline/element': source('./packages/element/src/index.ts'),
      '@swipeline/binding-testkit': source('./packages/binding-testkit/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
    // One file per worker puts 30+ processes on a two-core runner, and the
    // Postgres conformance suite runs a WASM Postgres inside one of them. The
    // default 5s is a CPU-contention limit rather than a real hang, so it is
    // raised instead of splitting the suite into a second job.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts'],
    },
  },
})
