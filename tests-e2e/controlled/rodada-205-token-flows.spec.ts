import { expect, test, type Page } from '@playwright/test'

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente`).toBeLessThanOrEqual(dims.client + 4)
}

test.describe.configure({ timeout: 120_000 })

test.describe('R205 — fluxos por token integrados', () => {
  test('/equipe/entrar usa shell canônico', async ({ page }) => {
    await page.route('**/api/equipes/convites-elenco/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ equipe: { id: 'team-r205', nome: 'TEAM R205', logo_url: null }, line: null, campeonato: null }),
      })
    })
    await page.goto('/equipe/entrar/r205', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.locator('[data-dz-token-flow="page"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-dz-token-flow="card"]')).toBeVisible()
    await expect(page.getByText('TEAM R205')).toBeVisible()
    await noOverflow(page)
  })

  test('/convite/produtora usa shell e retorno compartilhados', async ({ page }) => {
    await page.route('**/api/produtora/convites/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ convite: { tipo: 'criacao', produtora_nome: 'PRODUTORA R205', email_mascarado: 'r***@dropzone.test', status: 'pendente', expira_em: '2030-01-01T00:00:00.000Z' } }),
      })
    })
    await page.goto('/convite/produtora/r205', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.locator('[data-dz-token-flow="page"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('PRODUTORA R205')).toBeVisible()
    await noOverflow(page)
  })

  test('/vendedor usa gate compartilhado', async ({ page }) => {
    await page.route('**/api/vendedores/convite/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valido: true,
          autenticado: false,
          manager: null,
          modo: 'produtora',
          convite: { produtoras: { nome: 'PRODUTORA R205' }, campeonatos: null },
        }),
      })
    })
    await page.goto('/vendedor/r205', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.locator('[data-dz-token-flow="page"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-dz-token-flow="access-gate"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Como deseja continuar?' })).toBeVisible()
    await noOverflow(page)
  })

  test('/i usa o mesmo gate e permite visitante', async ({ page }) => {
    await page.route('**/api/dropzone/public/inscricao/**', async (route) => {
      if (route.request().url().includes('/acompanhamento')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ equipes: [] }) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ autenticado: false, jogador: null, campeonato: { nome: 'R205 CUP' }, grupo: { nome: 'GRUPO A' }, equipes: [], regras: { vagas_por_equipe: 6 }, inscricao_aberta: true }),
      })
    })
    await page.goto('/i/R205', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const gate = page.locator('[data-dz-token-flow="access-gate"]')
    await expect(gate).toBeVisible({ timeout: 30_000 })
    await gate.getByRole('button', { name: 'Continuar sem login' }).click()
    await expect(gate).toHaveCount(0)
    await expect(page.getByText('R205 CUP')).toBeVisible()
    await noOverflow(page)
  })
})
