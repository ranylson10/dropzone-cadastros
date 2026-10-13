import { defineConfig, devices } from '@playwright/test'

const configuredBaseUrl = process.env.E2E_BASE_URL?.trim()
const baseURL = configuredBaseUrl || 'http://localhost:3208'

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'relatorios-testes/playwright-resultados-r208',
  reporter: [
    ['line'],
    ['html', { outputFolder: 'relatorios-testes/playwright-report-r208', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: configuredBaseUrl
    ? undefined
    : {
        command: 'npm run dev --workspace dropzone-web -- -p 3208',
        url: `${baseURL}/api/ping`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
