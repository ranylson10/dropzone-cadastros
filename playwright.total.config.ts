import { defineConfig, devices } from '@playwright/test'

const configuredBaseUrl = process.env.E2E_BASE_URL?.trim()
const baseURL = configuredBaseUrl || 'https://www.dpzone.site'

export default defineConfig({
  testDir: './tests-e2e',
  testMatch: [
    'public/**/*.spec.ts',
    'auth/**/*.spec.ts',
    'functional/**/*.spec.ts',
    'total/**/*.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: 'relatorios-testes/playwright-resultados-total',
  reporter: [
    ['line'],
    ['json', { outputFile: 'relatorios-testes/playwright-total-resultados.json' }],
    ['html', { outputFolder: 'relatorios-testes/playwright-report-total', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 40_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
})
