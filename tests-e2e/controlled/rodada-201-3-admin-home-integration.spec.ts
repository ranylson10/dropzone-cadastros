import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ADMIN_STATE = path.resolve('tests-e2e/.auth/admin.json')
const HAS_ADMIN_STATE = fs.existsSync(ADMIN_STATE)

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

test.describe('R201.3 — Admin > Página inicial integrado', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 })
  test.skip(!HAS_ADMIN_STATE, 'Sessão admin não encontrada em tests-e2e/.auth/admin.json')
  test.use({ storageState: ADMIN_STATE })

  test('abre o editor real e usa somente controles canônicos', async ({ page }) => {
    await page.route('**/api/site/home', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ config: {} }),
        })
        return
      }
      await route.continue()
    })

    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    expect(response?.status() ?? 200, '/admin respondeu com erro').toBeLessThan(500)

    const tabs = page.locator('.system-admin-tabs')
    await expect(tabs).toBeVisible({ timeout: 60_000 })

    const homeTab = tabs.getByRole('button', { name: /^Página inicial$/i })
    await expect(homeTab).toBeVisible({ timeout: 30_000 })
    await homeTab.click()

    const editor = page.locator('.home-editor')
    await expect(editor).toBeVisible({ timeout: 30_000 })

    const controls = editor.locator('input, select, textarea')
    const canonical = editor.locator('input[data-dz-control], select[data-dz-control], textarea[data-dz-control]')
    const rogue = editor.locator('input:not([data-dz-control]), select:not([data-dz-control]), textarea:not([data-dz-control])')

    const total = await controls.count()
    expect(total, 'editor da Home deveria renderizar controles').toBeGreaterThan(0)
    expect(await canonical.count(), 'todos os controles devem vir da fundação compartilhada').toBe(total)
    expect(await rogue.count(), 'editor renderizou controle fora da fundação compartilhada').toBe(0)

    await noOverflow(page)
  })
})
