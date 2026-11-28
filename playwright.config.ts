import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const HOST = '127.0.0.1'

export default defineConfig({
  testDir: './e2e',
  // The example decks have their own config and servers (`pnpm e2e:examples`).
  testIgnore: ['examples/**'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        // `pnpm audit:docs` compares the audit page with this summary.
        ['json', { outputFile: 'test-results/audit-fixtures.json' }],
      ]
    : 'list',
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // CI uses Playwright's pinned Chromium. `PLAYWRIGHT_CHANNEL=chrome` lets a
      // machine whose OS the bundled build no longer supports run the same tests
      // against its installed Chrome instead.
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    // Bind IPv4 explicitly: Vite's default `localhost` can resolve to ::1, which
    // the 127.0.0.1 readiness check would never reach.
    command: `pnpm --filter ./examples/conformance dev --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}/react.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
