import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const baseURL = process.env.E2E_BASE_URL?.trim() || 'https://www.dpzone.site'
const controlledDir = resolve(process.cwd(), 'tests-e2e', 'controlled')

function controlledSpecs() {
  if (!existsSync(controlledDir)) return { staticSpecs: [] as string[], runtimeSpecs: [] as string[], removedSpecs: [] as string[] }
  const staticSpecs: string[] = []
  const runtimeSpecs: string[] = []
  const removedSpecs: string[] = []

  for (const name of readdirSync(controlledDir).filter((item) => item.endsWith('.spec.ts'))) {
    try {
      const source = readFileSync(join(controlledDir, name), 'utf8')
      const pattern = `**/controlled/${name}`

      if (/artes-postagem|PostArtworkWorkspace|post-artworks\.css/.test(source)) {
        removedSpecs.push(pattern)
        continue
      }

      const usesRuntime =
        /[(]\s*{\s*[^}]*\b(page|browser|context|request)\b[^}]*}\s*[)]/s.test(source)
        || source.includes('APIRequestContext')

      if (usesRuntime) runtimeSpecs.push(pattern)
      else staticSpecs.push(pattern)
    } catch {
      // Arquivo ilegível não entra silenciosamente na suíte.
    }
  }

  return { staticSpecs, runtimeSpecs, removedSpecs }
}

const { staticSpecs, runtimeSpecs, removedSpecs } = controlledSpecs()

export default defineConfig({
  testDir: './tests-e2e',
  testMatch: ['controlled/**/*.spec.ts'],
  testIgnore: removedSpecs,
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
    {
      name: 'contracts-static',
      testMatch: staticSpecs,
    },
    {
      name: 'contracts-runtime-desktop',
      testMatch: runtimeSpecs,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'contracts-runtime-mobile',
      testMatch: runtimeSpecs,
      use: { ...devices['Pixel 7'] },
    },
  ],
})
