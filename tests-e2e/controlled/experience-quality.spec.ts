import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

async function accessible(page: Page) {
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() })
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    expect(route.request().method(), 'UI fixtures never write to a connected database').toBe('GET')
    return route.fulfill({ json: { config: {}, rows: [], items: [], announcements: [
      { id: 'quality-cup', nome: 'Copa Circuito', produtora_nome: 'Circuito', tipo: 'copa', valor_inscricao: 30, vagas_livres: 12, total_vagas: 24, logo_url: '/dropzone-icon.png' },
    ] } })
  })
})

test('home prioritizes competitions and keeps navigation accessible', async ({ page, isMobile }) => {
  await page.goto('/')
  const card = page.locator('[data-championship-id="quality-cup"]')
  await expect(card).toBeVisible()
  expect((await card.boundingBox())!.y).toBeLessThan(isMobile ? 700 : 820)
  await accessible(page)
  if (isMobile) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Menu completo do DropZone' })).toBeVisible()
    await accessible(page)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Abrir meus painéis', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Seus painéis', exact: true }).getByRole('link', { name: 'Entrar na minha conta' })).toBeVisible()
    await accessible(page)
  }
})

test('login, signup and recovery keep readable fields and feedback', async ({ page, isMobile }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entre com sua conta' })).toBeVisible()
  await accessible(page)
  if (isMobile) await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveCSS('font-size', '16px')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible()
  await accessible(page)
  await page.goto('/atualizar-senha')
  await expect(page.getByRole('heading', { name: 'Recupere sua senha' })).toBeVisible()
  await accessible(page)
})

test('unavailable artwork keeps the competition readable and usable', async ({ page }) => {
  await page.route('**/_next/image?*', route => route.abort())
  await page.goto('/')
  const card = page.locator('[data-championship-id="quality-cup"]')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('.dz-champ-card-fallback')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Abrir Copa Circuito' })).toHaveAttribute('href', '/campeonatos/quality-cup')
  await expect(card.locator('.dz-champ-card-art')).toHaveCSS('background-color', 'rgb(233, 231, 223)')
})

test('cart and missing page provide readable recovery actions', async ({ page }) => {
  await page.goto('/carrinho')
  await expect(page.getByRole('heading', { name: 'Meu carrinho' })).toBeVisible()
  await accessible(page)
  const response = await page.goto('/pagina-inexistente-qa')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Essa página não foi encontrada.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voltar ao início', exact: true })).toHaveAttribute('href', '/')
  await accessible(page)
})

async function artworkFixture(page: Page) {
  await page.route('**/format-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500"><rect width="1200" height="1500" fill="#f1efe7"/><rect x="10" y="10" width="1180" height="1480" fill="none" stroke="#ad3b22" stroke-width="20"/><text x="600" y="750" text-anchor="middle" font-size="100">1200 × 1500</text></svg>' }))
}

test('championship artwork keeps its complete 4:5 frame and unobstructed corners', async ({ page }, info) => {
  await artworkFixture(page)
  await page.route('**/api/vagas', route => route.fulfill({ json: { announcements: [{ id: 'portrait-cup', nome: 'Copa Retrato', produtora_nome: 'Circuito', tipo: 'copa', valor_inscricao: 30, vagas_livres: 12, banner_url: '/format-fixture.svg' }] } }))
  await page.goto('/')
  const card = page.locator('[data-championship-id="portrait-cup"]')
  const art = card.locator('.dz-champ-card-art')
  await expect(art.locator('img')).toBeVisible()
  await expect(art.locator('img')).toHaveCSS('object-fit', 'contain')
  const box = (await art.boundingBox())!
  expect(box.width / box.height).toBeCloseTo(4 / 5, 2)
  const badges = (await card.locator('.dz-champ-card-badges').boundingBox())!
  expect(badges.y + badges.height).toBeLessThanOrEqual(box.y + 1)
  const actions = (await card.locator('.dz-champ-card-actions').boundingBox())!
  expect(actions.y).toBeGreaterThanOrEqual(box.y + box.height - 1)
  await art.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('complete-championship-art.png') })
})

test('admin carousel artwork stays whole on mobile and follows its image link', async ({ page }, info) => {
  await artworkFixture(page)
  await page.route('**/api/site/home', route => route.fulfill({ json: { config: { hero_slides: [{ title: 'Arte da copa', accent: '', image_url: '/format-fixture.svg', image_href: 'https://example.com/campanha' }] } } }))
  await page.route('https://example.com/campanha', route => route.fulfill({ contentType: 'text/html', body: '<h1>Destino do banner</h1>' }))
  await page.goto('/')
  const banner = page.locator('.store-home-hero-custom-art a')
  await expect(banner).toHaveAttribute('href', 'https://example.com/campanha')
  await expect(banner.locator('img')).toBeVisible()
  await expect(banner.locator('img')).toHaveCSS('object-fit', 'contain')
  await expect(page.locator('.dz-hero-watermark')).toBeHidden()
  const box = (await banner.boundingBox())!
  expect(box.width / box.height).toBeCloseTo(4 / 5, 2)
  await accessible(page)
  await page.screenshot({ path: info.outputPath('clickable-carousel-art.png') })
  await page.getByRole('button', { name: 'Destaque 2', exact: true }).click()
  await expect(banner).toHaveCount(0)
  await page.getByRole('button', { name: 'Destaque 1', exact: true }).click()
  await banner.click()
  await expect(page).toHaveURL('https://example.com/campanha')
})
