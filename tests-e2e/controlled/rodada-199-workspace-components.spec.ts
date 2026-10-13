import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

const workspaces = [
  { role: 'produtora', kind: 'produtora', labels: ['Visão geral', 'Campeonatos'] },
  { role: 'equipe', kind: 'equipe', labels: ['Início', 'Elenco', 'Competições', 'Desempenho', 'Mais'] },
  { role: 'jogador', kind: 'jogador', labels: ['Início', 'Competições', 'Equipe', 'Desempenho', 'Perfil'] },
  { role: 'manager', kind: 'manager', labels: ['Campeonatos', 'Equipes', 'Jogadores', 'Perfil'] },
] as const

test.describe.configure({ mode: 'serial' })

for (const workspace of workspaces) {
  test(`${workspace.role}: usa shell, header, navegação e conteúdo compartilhados`, async ({ browser, baseURL }) => {
    const state = path.resolve(`tests-e2e/.auth/${workspace.role}.json`)
    test.skip(!fs.existsSync(state), `Capture a sessão do perfil ${workspace.role}`)
    const context = await browser.newContext({ storageState: state })
    const page = await context.newPage()
    try {
      const response = await page.goto(`${baseURL || 'http://localhost:3000'}/?painel=1`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      expect(response?.status() ?? 200).toBeLessThan(500)

      const root = page.locator(`.dz-workspace[data-workspace-kind="${workspace.kind}"]`).first()
      await expect(root).toBeVisible({ timeout: 20_000 })
      await expect(root.locator('.dz-workspace-header').first()).toBeVisible()
      await expect(root.locator('.dz-workspace-nav[data-workspace-nav="primary"]').first()).toBeVisible()
      await expect(root.locator('.dz-workspace-content').first()).toBeVisible()

      for (const label of workspace.labels) {
        await expect(root.locator('.dz-workspace-nav__item', { hasText: label }).first()).toBeVisible()
      }

      await noOverflow(page)
    } finally {
      await context.close()
    }
  })
}

test('equipe: navegação compartilhada abre subnavegação compartilhada', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/equipe.json')
  test.skip(!fs.existsSync(state), 'Capture a sessão do perfil equipe')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await page.goto(`${baseURL || 'http://localhost:3000'}/?painel=1`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const root = page.locator('.dz-workspace[data-workspace-kind="equipe"]').first()
    await expect(root).toBeVisible({ timeout: 20_000 })
    await root.locator('.dz-workspace-nav__item', { hasText: 'Elenco' }).first().click()
    const subnav = root.locator('.dz-workspace-subnav[data-workspace-nav="secondary"]').first()
    await expect(subnav).toBeVisible()
    await expect(subnav.getByRole('button', { name: 'Jogadores' })).toBeVisible()
    await expect(subnav.getByRole('button', { name: 'Lines' })).toBeVisible()
    await expect(subnav.getByRole('button', { name: 'Convites' })).toBeVisible()
    await noOverflow(page)
  } finally {
    await context.close()
  }
})
