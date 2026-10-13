import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'

const PUBLIC_PAGES = [
  ['/', '.store-home'],
  ['/campeonatos', '.directory-championship-page'],
  ['/vagas', '.directory-championship-page'],
  ['/equipes', '.directory-page.directory-theme-equipes'],
  ['/jogadores', '.directory-page.directory-theme-jogadores'],
  ['/produtoras', '.directory-page.directory-theme-produtoras'],
  ['/managers', '.directory-page.directory-theme-managers'],
  ['/rank', '.directory-rank-content'],
  ['/carrinho', '.cart-page'],
  ['/login', '.login-portal-panel'],
] as const

const ROLE_STATES = [
  ['produtora', 'produtora.json'],
  ['equipe', 'equipe.json'],
  ['jogador', 'jogador.json'],
  ['manager', 'manager.json'],
] as const

async function noOverflow(page: Page) {
  const report = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(
    report.scroll,
    `${page.url()} estourou horizontalmente: ${report.scroll}px > ${report.client}px`,
  ).toBeLessThanOrEqual(report.client + 4)
}

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  expect(response?.status() ?? 200, `${route} respondeu com erro`).toBeLessThan(500)
}

function stateForOrigin(stateFile: string, baseURL: string | undefined) {
  const storageState = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const origin = new URL(baseURL || 'http://localhost:3000').origin
  for (const entry of storageState.origins || []) {
    if (['localhost', '127.0.0.1'].includes(new URL(entry.origin).hostname)) entry.origin = origin
  }
  return storageState
}

async function openAuthenticatedWorkspace(browser: Browser, baseURL: string | undefined, role: string, stateFile: string) {
  const state = path.resolve('tests-e2e/.auth', stateFile)
  test.skip(!fs.existsSync(state), `Sessão ${role} não encontrada em tests-e2e/.auth/${stateFile}`)
  const storageState = stateForOrigin(state, baseURL)
  const context = await browser.newContext({ storageState })
  const page = await context.newPage()
  await open(page, `${baseURL || 'http://localhost:3000'}/?painel=1`)
  return { context, page }
}

test.describe.configure({ timeout: 120_000 })

test.describe('R207 — auditoria final de arquitetura e layout', () => {
  for (const [route, rootSelector] of PUBLIC_PAGES) {
    test(`${route} abre, monta fundações globais e não estoura horizontalmente`, async ({ page }) => {
      const nativeDialogs: string[] = []
      page.on('dialog', async (dialog) => {
        nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`)
        await dialog.dismiss()
      })

      await open(page, route)
      await expect(page.locator(rootSelector).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-dz-feedback-root]')).toHaveCount(1)
      expect(nativeDialogs, `${route} abriu diálogo nativo durante o carregamento`).toEqual([])
      await noOverflow(page)
    })
  }

  test('/campeonatos preserva ChampionshipListRow e não ressuscita cards do catálogo antigo', async ({ page }) => {
    await open(page, '/campeonatos')
    await expect(page.locator('.directory-champ-card,.championship-poster-card,.dz-champ-card')).toHaveCount(0)

    const rows = page.locator('[data-championship-list-row]')
    if (await rows.count()) {
      await expect(rows.first()).toBeVisible()
      await expect(rows.first().locator('.dz-champ-list-row__metrics')).toBeVisible()
    }
    await noOverflow(page)
  })

  test('/vagas redireciona para o catálogo único de campeonatos preservando filtros', async ({ page }) => {
    await open(page, '/vagas?gratis=1')
    await page.waitForURL('**/campeonatos?**', { timeout: 30_000 })
    const url = new URL(page.url())
    expect(url.pathname).toBe('/campeonatos')
    expect(url.searchParams.get('vagas')).toBe('1')
    expect(url.searchParams.get('gratis')).toBe('1')
    await expect(page.locator('.directory-championship-page')).toHaveCount(1)
    await expect(page.locator('.directory-championship-page')).toBeVisible({ timeout: 30_000 })
    await noOverflow(page)
  })

  test('fluxo por token usa shell canônico no cenário público', async ({ page }) => {
    await page.route('**/api/equipes/convites-elenco/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          equipe: { id: 'team-r207', nome: 'TEAM R207', logo_url: null },
          line: null,
          campeonato: null,
        }),
      })
    })

    await open(page, '/equipe/entrar/r207-final')
    await expect(page.locator('[data-dz-token-flow="page"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-dz-token-flow="card"]')).toBeVisible()
    await expect(page.getByText('TEAM R207')).toBeVisible()
    await noOverflow(page)
  })

  for (const [role, stateFile] of ROLE_STATES) {
    test(`workspace autenticado ${role} usa shell canônico`, async ({ browser, baseURL }) => {
      const { context, page } = await openAuthenticatedWorkspace(browser, baseURL, role, stateFile)
      try {
        const workspace = page.locator(`.dz-workspace[data-workspace-kind="${role}"]`).first()
        await expect(workspace).toBeVisible({ timeout: 30_000 })
        await expect(workspace.locator('.dz-workspace-nav[data-workspace-nav="primary"]')).toBeVisible()
        await noOverflow(page)
      } finally {
        await context.close()
      }
    })
  }

  test('Admin mantém Página inicial integrada e controles canônicos', async ({ browser, baseURL }) => {
    const state = path.resolve('tests-e2e/.auth/admin.json')
    test.skip(!fs.existsSync(state), 'Sessão admin não encontrada em tests-e2e/.auth/admin.json')

    const context = await browser.newContext({ storageState: stateForOrigin(state, baseURL) })
    const page = await context.newPage()
    try {
      await page.route('**/api/site/home', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ config: {} }) })
          return
        }
        await route.continue()
      })

      await open(page, `${baseURL || 'http://localhost:3000'}/admin`)
      const tabs = page.locator('.system-admin-tabs')
      await expect(tabs).toBeVisible({ timeout: 30_000 })
      await tabs.getByRole('button', { name: /^Página inicial$/i }).click()

      const editor = page.locator('.home-editor')
      await expect(editor).toBeVisible({ timeout: 30_000 })
      const controls = editor.locator('input, select, textarea')
      const rogue = editor.locator('input:not([data-dz-control]), select:not([data-dz-control]), textarea:not([data-dz-control])')
      expect(await controls.count()).toBeGreaterThan(0)
      await expect(rogue).toHaveCount(0)
      await noOverflow(page)
    } finally {
      await context.close()
    }
  })
})
