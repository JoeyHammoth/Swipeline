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
      '@swipeline/store-memory': source('./packages/store-memory/src/index.ts'),
      '@swipeline/gestures': source('./packages/gestures/src/index.ts'),
      '@swipeline/core': source('./packages/core/src/index.ts'),
      '@swipeline/bench': source('./packages/bench/src/index.ts'),
      '@swipeline/rank': source('./packages/rank/src/index.ts'),
      '@swipeline/react': source('./packages/react/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts'],
    },
  },
})
