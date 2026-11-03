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
