import { expect, test } from '@playwright/test'

// Verifica a home REAL, não um HTML de simulação. Rodar no localhost
// com uma sessão limpa; não utiliza API que grave dados em produção.
test('R15: home pública usa o eixo do catálogo e não gera scroll lateral', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes('mobile')
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const home = page.locator('.store-home.home-platform-v15')
  await expect(home).toBeVisible({ timeout: 20_000 })
  const banner = home.locator('.store-home-hero')
  const header = home.locator('.store-home-header-inner--unified')
  const search = home.locator('.store-home-content-search')
  await expect(banner).toBeVisible()
  await expect(search).toBeVisible()
  await expect(home.locator('.store-home-categories > a').first()).toBeVisible()

  const sizes = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()
      return rect ? { left: rect.left, right: rect.right, width: rect.width } : null
    }
    return {
      header: box('.store-home-header-inner--unified'),
      hero: box('.store-home-hero'),
      content: box('.store-home-content'),
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      background: getComputedStyle(document.querySelector('.store-home-body')!).backgroundColor,
    }
  })
  expect(sizes.header).not.toBeNull()
  expect(sizes.hero).not.toBeNull()
  expect(sizes.content).not.toBeNull()
  expect(sizes.scroll, 'Página criou rolagem horizontal').toBeLessThanOrEqual(sizes.viewport + 2)
  expect(sizes.hero!.width).toBeLessThanOrEqual(962)
  expect(sizes.content!.width).toBeLessThanOrEqual(962)
  expect(Math.abs(sizes.header!.left - sizes.hero!.left), 'Header e banner desalinhados').toBeLessThanOrEqual(3)
  expect(Math.abs(sizes.content!.left - sizes.hero!.left), 'Banner e conteúdo desalinhados').toBeLessThanOrEqual(3)
  expect(sizes.background, 'Tema claro ainda ativo na home').toBe('rgb(16, 35, 49)')
  await testInfo.attach('home-layout-r15', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})
