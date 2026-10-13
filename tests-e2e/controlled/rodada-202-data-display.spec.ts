import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const ADMIN_STATE = path.resolve('tests-e2e/.auth/admin.json')
const HAS_ADMIN_STATE = fs.existsSync(ADMIN_STATE)

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

test.describe('R202 — tabelas e listas compartilhadas', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test('marketplace continua íntegro após a fundação de dados', async ({ page }) => {
    const response = await page.goto('/campeonatos', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status() ?? 200).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    await noOverflow(page)
  })

  test.describe('admin', () => {
    test.skip(!HAS_ADMIN_STATE, 'Sessão admin não encontrada em tests-e2e/.auth/admin.json')
    test.use({ storageState: ADMIN_STATE })

    test('tabelas administrativas renderizam pelo primitive canônico', async ({ page }) => {
      const response = await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 90_000 })
      expect(response?.status() ?? 200).toBeLessThan(500)

      const tabs = page.locator('.system-admin-tabs')
      await expect(tabs).toBeVisible({ timeout: 60_000 })
      await tabs.getByRole('button', { name: /^Produtoras$/i }).click()

      const table = page.locator('table[data-dz-table="true"]').first()
      await expect(table).toBeVisible({ timeout: 30_000 })
      await expect(table.locator('thead.dz-data-table__head')).toHaveCount(1)
      await expect(table.locator('tbody.dz-data-table__body')).toHaveCount(1)

      const rogue = await page.locator('table:not([data-dz-table="true"])').count()
      expect(rogue, 'Admin renderizou tabela fora da fundação compartilhada').toBe(0)
      await noOverflow(page)
    })
  })
})
