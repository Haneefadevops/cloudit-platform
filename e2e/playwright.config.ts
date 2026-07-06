import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load environment variables from e2e/.env (keep credentials out of source control)
config({ path: resolve(__dirname, '.env') })

const baseURL = process.env.E2E_BASE_URL || 'https://to-admin.cloudit.lk'

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: process.env.E2E_HEADED !== 'true',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: resolve(__dirname, '.auth/admin.json'),
      },
      dependencies: ['setup'],
      teardown: 'teardown',
      testIgnore: /login\.spec\.ts/,
    },
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /login\.spec\.ts/,
    },
    {
      name: 'teardown',
      testMatch: /auth\.teardown\.ts/,
    },
  ],
  outputDir: './test-results',
})
