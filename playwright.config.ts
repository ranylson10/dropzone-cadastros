import { defineConfig, devices } from '@playwright/test'

const configuredBaseUrl = process.env.E2E_BASE_URL?.trim()
// OAuth/Supabase local usa localhost. Não misture com 127.0.0.1,
// pois localStorage e cookies são separados por origem.
const baseURL = configuredBaseUrl || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Contra a Vercel, limite a concorrência para evitar saturar rotas e o banco
  // durante os testes controlados. Localmente, preserve o paralelismo padrão.
  workers: process.env.CI ? 2 : configuredBaseUrl ? 4 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'relatorios-testes/playwright-resultados',
  reporter: [
    ['line'],
    ['html', { outputFolder: 'relatorios-testes/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Operações de API contra a Vercel podem sofrer cold start e contenção.
    // Mantém limite finito, mas evita falsos negativos de exatamente 12 segundos.
    actionTimeout: configuredBaseUrl ? 30_000 : 12_000,
    navigationTimeout: 30_000,
  },
  webServer: configuredBaseUrl
    ? undefined
    : {
        command: 'npm run dev',
        url: `${baseURL}/api/ping`,
        reuseExistingServer: true,
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
