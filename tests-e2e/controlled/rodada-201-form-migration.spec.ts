import { expect, test, type Page } from '@playwright/test'

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

async function expectOnlyCanonicalControls(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() ?? 200, `${route} respondeu com erro`).toBeLessThan(500)

  await page.waitForTimeout(350)
  const rogue = page.locator('input:not([data-dz-control]), select:not([data-dz-control]), textarea:not([data-dz-control])')
  expect(await rogue.count(), `${route} renderizou controle nativo fora da fundação compartilhada`).toBe(0)
  await noOverflow(page)
}

test.describe.configure({ mode: 'serial' })

for (const route of ['/login', '/campeonatos', '/vagas', '/']) {
  test(`${route} usa somente controles canônicos`, async ({ page }) => {
    await expectOnlyCanonicalControls(page, route)
  })
}
