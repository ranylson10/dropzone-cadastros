import { expect, test } from '@playwright/test'

async function noOverflow(page: import('@playwright/test').Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente`).toBeLessThanOrEqual(dims.client + 4)
}

const routes = ['/', '/campeonatos', '/equipes', '/jogadores']

test.describe.configure({ mode: 'serial' })

test.describe('R203 — feedback global', () => {
  for (const route of routes) {
    test(`${route} monta a fundação global sem diálogo nativo`, async ({ page }) => {
      const nativeDialogs: string[] = []
      page.on('dialog', async (dialog) => {
        nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`)
        await dialog.dismiss()
      })

      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      expect(response?.status() ?? 200, `${route} respondeu com erro`).toBeLessThan(500)
      await expect(page.locator('[data-dz-feedback-root]')).toHaveCount(1)
      expect(nativeDialogs, `${route} abriu diálogo nativo`).toEqual([])
      await noOverflow(page)
    })
  }
})
