import { expect, test } from '@playwright/test'

const championship = {
  id: 'r204-championship',
  nome: 'R204 TEST CUP',
  tipo: 'SQUAD',
  logo_url: '/dropzone-icon.png',
  banner_url: '/dropzone-icon.png',
  valor_inscricao: 25,
  vagas_livres: 8,
  total_vagas: 12,
  produtora_nome: 'DropZone Teste',
  vendedores: [{ id: 'seller-r204', nome: 'Vendedor R204' }],
}

async function noOverflow(page: import('@playwright/test').Page) {
  const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente`).toBeLessThanOrEqual(dims.client + 4)
}

test.describe.configure({ timeout: 120_000 })

test.describe('R204/R208 — commerce integrado', () => {
  test('card do portfólio comercial compartilha favorito/carrinho com /carrinho', async ({ page }) => {
    await page.route('**/api/vendedores/seller-r204/vagas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ manager: { id: 'seller-r204', nome: 'Vendedor R204' }, announcements: [championship] }),
      })
    })
    await page.goto('/vendedores/seller-r204', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const card = page.locator('[data-championship-id="r204-championship"]')
    await expect(card).toBeVisible({ timeout: 30_000 })

    await card.getByRole('button', { name: /Favoritar R204 TEST CUP/i }).click()
    await expect(card.getByRole('button', { name: /Remover R204 TEST CUP dos favoritos/i })).toHaveAttribute('aria-pressed', 'true')

    await card.getByRole('button', { name: /Adicionar R204 TEST CUP ao carrinho/i }).click()
    await expect(card.getByRole('button', { name: /Remover R204 TEST CUP do carrinho/i })).toHaveAttribute('aria-pressed', 'true')

    const local = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('dropzone:cart:v1') || '[]'),
      wishlist: JSON.parse(localStorage.getItem('dropzone:wishlist:v1') || '[]'),
    }))
    expect(local.cart.some((item: any) => item.id === 'r204-championship')).toBeTruthy()
    expect(local.wishlist.some((item: any) => item.id === 'r204-championship')).toBeTruthy()

    await page.goto('/carrinho', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByText('R204 TEST CUP').first()).toBeVisible({ timeout: 30_000 })
    await noOverflow(page)
  })

  test('portfólio do vendedor preserva atribuição no carrinho guest', async ({ page }) => {
    await page.route('**/api/vendedores/seller-r204/vagas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ manager: { id: 'seller-r204', nome: 'Vendedor R204' }, announcements: [championship] }),
      })
    })
    await page.goto('/vendedores/seller-r204', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const card = page.locator('[data-championship-id="r204-championship"]')
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.getByRole('button', { name: /Adicionar R204 TEST CUP ao carrinho/i }).click()

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dropzone:cart:v1') || '[]').find((item: any) => item.id === 'r204-championship'))
    expect(saved?.origin).toBe('vendedor')
    expect(saved?.sellerManagerId).toBe('seller-r204')
    await noOverflow(page)
  })
})
