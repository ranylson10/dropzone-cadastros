import { expect, test, type Page } from '@playwright/test'

async function expectPosterCard(page: Page, cardSelector: string, imageSelector: string, actionsSelector: string) {
  const card = page.locator(cardSelector).first()
  if (!await card.count()) return
  await expect(card).toBeVisible()

  const image = card.locator(imageSelector).first()
  if (await image.count()) {
    await expect(image).toBeVisible()
    const fit = await image.evaluate((node) => getComputedStyle(node).objectFit)
    expect(fit).toBe('contain')
  }

  const actions = card.locator(actionsSelector).first()
  await expect(actions).toBeVisible()
  expect(await actions.locator('button,a').count()).toBeGreaterThanOrEqual(3)
}

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() || 200).toBeLessThan(500)
  await page.waitForTimeout(900)
}

test.describe.configure({ mode: 'serial' })

test('/ — campeonatos em destaque usam arte inteira e 3 ações', async ({ page }) => {
  await open(page, '/')
  await expectPosterCard(page, '.store-home-product', '.store-home-product-media > img', '.store-home-product-actions')
})

test('/campeonatos — catálogo usa arte inteira e 3 ações', async ({ page }) => {
  await open(page, '/campeonatos')
  await expectPosterCard(page, '.directory-champ-card', '.directory-champ-cover-empty img', '.directory-champ-quick-actions')
})

test('/vagas — cards usam o mesmo padrão', async ({ page }) => {
  await open(page, '/vagas')
  await expectPosterCard(page, '.vacancy-catalog-card', '.vacancy-catalog-cover img', '.vacancy-catalog-actions')
})
