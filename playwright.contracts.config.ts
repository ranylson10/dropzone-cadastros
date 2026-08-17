import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const baseURL = process.env.E2E_BASE_URL?.trim() || 'https://www.dpzone.site'
const controlledDir = resolve(process.cwd(), 'tests-e2e', 'controlled')

function intentionallyRemovedSpecs(): string[] {
  if (!existsSync(controlledDir)) return []
  return readdirSync(controlledDir)
    .filter((name) => name.endsWith('.spec.ts'))
    .filter((name) => {
      try {
        const source = readFileSync(join(controlledDir, name), 'utf8')
        return /artes-postagem|PostArtworkWorkspace|post-artworks\.css/.test(source)
      } catch {
        return false
      }
    })
    .map((name) => `**/controlled/${name}`)
}

export default defineConfig({
  testDir: './tests-e2e',
  testMatch: ['controlled/**/*.spec.ts'],
  testIgnore: intentionallyRemovedSpecs(),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  outputDir: 'relatorios-testes/playwright-resultados-contratos',
  reporter: [
    ['line'],
    ['json', { outputFile: 'relatorios-testes/playwright-contratos-resultados.json' }],
    ['html', { outputFolder: 'relatorios-testes/playwright-report-contratos', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 35_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
})
