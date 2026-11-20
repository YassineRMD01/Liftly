import { defineConfig, devices } from '@playwright/test';

/** End-to-end tests: `npm run e2e` (starts the dev server on port 4300 unless one is running). */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'off',
    viewport: { width: 1440, height: 1000 },
    // a locally installed Chromium can be used instead of the downloaded one
    ...(process.env['PW_CHROMIUM'] ? { launchOptions: { executablePath: process.env['PW_CHROMIUM'] } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: 'npx ng serve --port 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
