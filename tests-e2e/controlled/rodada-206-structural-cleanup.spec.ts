import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll).toBeLessThanOrEqual(dims.client + 4)
}

test('/campeonatos preserva a lista canônica depois da limpeza', async ({ page }) => {
  const response = await page.goto('/campeonatos', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() ?? 200).toBeLessThan(500)
  await page.waitForTimeout(500)

  await expect(page.locator('.dz-champ-card,.directory-champ-card,.store-home-product.championship-poster-card')).toHaveCount(0)
  const rows = page.locator('[data-championship-list-row]')
  if (await rows.count()) await expect(rows.first()).toBeVisible()
  await noOverflow(page)
})

test('workspace da produtora não depende das classes de navegação antigas', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/produtora.json')
  test.skip(!fs.existsSync(state), 'Capture a sessão do perfil produtora')

  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    const response = await page.goto(`${baseURL || 'http://localhost:3000'}/?painel=1`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    expect(response?.status() ?? 200).toBeLessThan(500)
    const root = page.locator('.dz-workspace[data-workspace-kind="produtora"]').first()
    await expect(root).toBeVisible({ timeout: 20_000 })
    await expect(root.locator('.dz-workspace-nav[data-workspace-nav="primary"]')).toBeVisible()
    await expect(root.locator('.producer-hub-nav-primary,.producer-hub-subnav')).toHaveCount(0)
    await noOverflow(page)
  } finally {
    await context.close()
  }
})
