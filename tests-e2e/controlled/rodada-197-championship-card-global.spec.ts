import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() ?? 200).toBeLessThan(500)
  await page.waitForTimeout(500)
}

async function expectNoOverflow(page: Page) {
  const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(dims.scroll).toBeLessThanOrEqual(dims.client + 4)
}

async function expectCanonicalCard(card: Locator) {
  await expect(card).toBeVisible()
  await expect(card.locator('.dz-champ-card-actions')).toBeVisible()
  const caption = card.locator('.dz-champ-card-caption')
  await expect(caption).toBeVisible()
  expect(await caption.evaluate((node) => getComputedStyle(node).position)).toBe('absolute')
}

test.describe.configure({ mode: 'serial' })

test('Home continua usando o ChampionshipCard canônico', async ({ page }) => {
  await open(page, '/')
  const card = page.locator('.dz-champ-card').first()
  if (await card.count()) await expectCanonicalCard(card)
  await expect(page.locator('.store-home-product.championship-poster-card,.directory-champ-card,.vacancy-catalog-card')).toHaveCount(0)
  await expectNoOverflow(page)
})

test('/campeonatos usa ChampionshipListRow e não card', async ({ page }) => {
  await open(page, '/campeonatos')
  await expect(page.locator('.dz-champ-card')).toHaveCount(0)
  const row = page.locator('[data-championship-list-row]').first()
  if (await row.count()) {
    await expect(row).toBeVisible()
    await expect(row.locator('.dz-champ-list-row__metrics')).toBeVisible()
    await expect(row.locator('.dz-champ-list-row__actions')).toBeVisible()
  }
  await expectNoOverflow(page)
})

test('/vagas é alias e redireciona para /campeonatos?vagas=1', async ({ page }) => {
  await open(page, '/vagas?gratis=1')
  const url = new URL(page.url())
  expect(url.pathname).toBe('/campeonatos')
  expect(url.searchParams.get('vagas')).toBe('1')
  expect(url.searchParams.get('gratis')).toBe('1')
  await expect(page.locator('.directory-championship-page')).toBeVisible()
  await expectNoOverflow(page)
})
