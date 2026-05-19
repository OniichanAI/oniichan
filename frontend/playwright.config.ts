import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-level E2E. The stack is assumed to already be running on
 * http://localhost:4200 (frontend) and http://localhost:8000 (backend).
 *
 * scripts/ci/e2e.sh boots Docker Compose and waits for both ports before
 * invoking `npx playwright test`, so we don't have Playwright manage a web
 * server itself — keeps the same command working in CI and locally.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
