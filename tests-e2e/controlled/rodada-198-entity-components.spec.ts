import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() ?? 200).toBeLessThan(500)
  await page.waitForTimeout(500)
}

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente`).toBeLessThanOrEqual(dims.client + 4)
}

test.describe.configure({ mode: 'serial' })

for (const kind of ['equipes', 'jogadores', 'produtoras', 'managers'] as const) {
  test(`/${kind} usa linha canônica de entidade e perfil compartilhado`, async ({ page }) => {
    await open(page, `/${kind}`)
    await noOverflow(page)

    const rows = page.locator(`.dz-entity-row[data-entity-kind="${kind}"]`)
    if (!await rows.count()) return

    const first = rows.first()
    await expect(first).toBeVisible()
    await expect(first.locator('.dz-entity-avatar')).toBeVisible()

    const href = await first.getAttribute('href')
    expect(href).toBeTruthy()
    await open(page, String(href))

    const hero = page.locator(`.dz-entity-profile-hero[data-entity-profile-kind="${kind}"]`)
    await expect(hero).toBeVisible()
    await expect(hero.locator('.dz-entity-profile-hero__avatar')).toBeVisible()
    await expect(hero.locator('h1')).toBeVisible()
    await noOverflow(page)
  })
}

test('as quatro entidades usam a mesma raiz visual de linha', async ({ page }) => {
  const classes = new Set<string>()
  for (const kind of ['equipes', 'jogadores', 'produtoras', 'managers'] as const) {
    await open(page, `/${kind}`)
    const row = page.locator('.dz-entity-row').first()
    if (!await row.count()) continue
    const className = await row.getAttribute('class')
    if (className) classes.add(className.replace(`dz-entity-row--${kind}`, 'dz-entity-row--KIND').replace(`directory-list-row-${kind}`, 'directory-list-row-KIND'))
  }
  expect(classes.size).toBeLessThanOrEqual(1)
})
