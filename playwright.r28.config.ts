import { defineConfig, devices } from '@playwright/test'
// R28: pure CSS geometry regression; no local server or login required.
// Allow for slow first launch of Chromium on Windows (cold-start overhead).
export default defineConfig({
  testDir: './tests-e2e/controlled',
  testMatch: ['r28-produtora-geometry.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['line']],
  use: { screenshot: 'only-on-failure' },
  projects: [
    { name: 'r28-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'r28-mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})
