import { defineConfig, devices } from '@playwright/test'

/**
 * The example decks are audited separately from the binding fixtures: they fetch
 * from live APIs, boot four Vite servers and are slower and less deterministic,
 * so they run on the nightly schedule instead of on every pull request.
 */
const HOST = '127.0.0.1'

const APPS = [
  { name: 'books-react', port: 4181 },
  { name: 'recipes-react', port: 4182 },
  { name: 'movies-tmdb', port: 4183 },
  { name: 'papers-html', port: 4184 },
] as const

export default defineConfig({
  testDir: './e2e/examples',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: APPS.map((app) => ({
    command: `pnpm --filter ./examples/${app.name} dev --host ${HOST} --port ${app.port} --strictPort`,
    url: `http://${HOST}:${app.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
})
