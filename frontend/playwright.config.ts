import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — smoke E2E suite for the E-Shop storefront.
 *
 * Targets the docker-compose stack (frontend on :5173, backend on :5000).
 * Set `E2E_BASE_URL` to point at a different environment.
 *
 * Run:
 *   npx playwright install --with-deps   # one-time, installs browsers
 *   npx playwright test                   # runs the suite
 *   npx playwright test --ui              # interactive mode
 *   npx playwright test --reporter=html   # HTML report
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],

  // Spin up the frontend dev server if E2E_BASE_URL is not set and a local
  // server isn't already running. For CI / docker-compose, set E2E_BASE_URL
  // and Playwright will skip the webServer block.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
