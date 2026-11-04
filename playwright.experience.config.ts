import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3001'
export default defineConfig({
  testDir: './tests-e2e/controlled',
  testMatch: ['experience-quality.spec.ts', 'experience-workspace.spec.ts', 'producer-studio.spec.ts'],
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  outputDir: 'relatorios-testes/experience-results',
  reporter: [['line'], ['html', { outputFolder: 'relatorios-testes/experience-report', open: 'never' }]],
  use: { baseURL, reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: [
    ...(process.env.CI ? [{ command: 'node scripts/e2e/serve-readonly-supabase-fixture.mjs', url: 'http://127.0.0.1:54321/health', reuseExistingServer: false, timeout: 10_000 }] : []),
    { command: 'npm run start --workspace dropzone-web -- --port 3001', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
  projects: [
    { name: 'experience-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'experience-mobile', use: { ...devices['Pixel 7'] } },
  ],
})
