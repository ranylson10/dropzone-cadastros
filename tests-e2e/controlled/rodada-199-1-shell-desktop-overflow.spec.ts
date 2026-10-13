import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() ?? 200).toBeLessThan(500)
  await page.waitForTimeout(450)
}

async function expectNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const root = document.documentElement
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((node) => {
        const rect = node.getBoundingClientRect()
        return {
          tag: node.tagName.toLowerCase(),
          cls: String(node.className || '').slice(0, 180),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.right > root.clientWidth + 4 || item.left < -4)
      .slice(0, 8)
    return { scroll: root.scrollWidth, client: root.clientWidth, offenders }
  })

  expect(
    report.scroll,
    `${page.url()} estourou horizontalmente: ${JSON.stringify(report.offenders)}`,
  ).toBeLessThanOrEqual(report.client + 4)
}

test.describe.configure({ mode: 'serial' })

for (const kind of ['equipes', 'jogadores', 'produtoras', 'managers'] as const) {
  test(`/${kind}/[id] cabe dentro do shell autenticado`, async ({ page }) => {
    await open(page, `/${kind}`)
    await expectNoHorizontalOverflow(page)

    const first = page.locator(`.dz-entity-row[data-entity-kind="${kind}"]`).first()
    if (!await first.count()) return
    const href = await first.getAttribute('href')
    expect(href).toBeTruthy()

    await open(page, String(href))
    await expect(page.locator(`.dz-entity-profile-hero[data-entity-profile-kind="${kind}"]`)).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const layout = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('.app-shell-main.page-authenticated')
      const header = document.querySelector<HTMLElement>('.app-header')
      if (!main || !header) return null
      const mainRect = main.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      return {
        viewport: document.documentElement.clientWidth,
        mainLeft: Math.round(mainRect.left),
        mainRight: Math.round(mainRect.right),
        mainWidth: Math.round(mainRect.width),
        headerWidth: Math.round(headerRect.width),
      }
    })

    if (layout && layout.viewport > 900) {
      expect(layout.headerWidth).toBe(232)
      expect(layout.mainLeft).toBe(232)
      expect(layout.mainRight).toBeLessThanOrEqual(layout.viewport + 1)
      expect(layout.mainWidth).toBeLessThanOrEqual(layout.viewport - 232 + 1)
    }
  })
}

test('/campeonatos preserva header horizontal e largura total', async ({ page }) => {
  await open(page, '/campeonatos')
  await expectNoHorizontalOverflow(page)
  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.app-shell-main.marketplace-shell-page')
    if (!main) return null
    const rect = main.getBoundingClientRect()
    return { left: Math.round(rect.left), right: Math.round(rect.right), viewport: document.documentElement.clientWidth }
  })
  if (layout && layout.viewport > 900) {
    expect(layout.left).toBe(0)
    expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1)
  }
})
