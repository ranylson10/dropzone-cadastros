import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() || 200).toBeLessThan(500)
  await page.waitForTimeout(900)
}

async function expectFullArtwork(card: Locator, imageSelector: string, actionsSelector: string, captionSelector: string) {
  await expect(card).toBeVisible()
  const image = card.locator(imageSelector).first()
  if (await image.count()) {
    await expect(image).toBeVisible()
    await image.evaluate((img: HTMLImageElement) => img.complete || new Promise<void>((resolve) => img.addEventListener('load', () => resolve(), { once: true })))
    const metrics = await image.evaluate((img: HTMLImageElement) => {
      const box = img.getBoundingClientRect()
      return {
        renderedRatio: box.height ? box.width / box.height : 0,
        naturalRatio: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0,
        fit: getComputedStyle(img).objectFit,
      }
    })
    expect(metrics.fit).toBe('contain')
    if (metrics.renderedRatio && metrics.naturalRatio) {
      expect(Math.abs(metrics.renderedRatio - metrics.naturalRatio)).toBeLessThan(0.04)
    }
  }

  const actions = card.locator(actionsSelector).first()
  await expect(actions).toBeVisible()
  expect(await actions.locator('button,a').count()).toBeGreaterThanOrEqual(3)

  const caption = card.locator(captionSelector).first()
  await expect(caption).toBeVisible()
  const position = await caption.evaluate((node) => getComputedStyle(node).position)
  expect(position).toBe('absolute')
}

test.describe.configure({ mode: 'serial' })

test('/ — destaque é a própria arte, sem janela 16:9 e sem legenda branca externa', async ({ page }) => {
  await open(page, '/')
  const card = page.locator('.store-home-product.championship-poster-card').first()
  if (!await card.count()) return
  await expectFullArtwork(card, '.championship-poster-media > img', '.championship-poster-actions', '.championship-poster-caption')
})

test('/campeonatos — card mantém a proporção real do banner', async ({ page }) => {
  await open(page, '/campeonatos')
  const card = page.locator('.directory-champ-card').first()
  if (!await card.count()) return
  await expectFullArtwork(card, '.directory-champ-cover-empty img', '.directory-champ-quick-actions', '.directory-champ-body')
})

test('/vagas — card mantém arte inteira e informações sobre a própria arte', async ({ page }) => {
  await open(page, '/vagas')
  const card = page.locator('.vacancy-catalog-card').first()
  if (!await card.count()) return
  await expectFullArtwork(card, '.vacancy-catalog-cover img', '.vacancy-catalog-actions', '.vacancy-catalog-content')
})
