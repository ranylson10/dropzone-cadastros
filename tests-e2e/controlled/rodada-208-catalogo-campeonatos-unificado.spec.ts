import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  expect(response?.status() ?? 200).toBeLessThan(500)
}

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente`).toBeLessThanOrEqual(dims.client + 4)
}

/**
 * Next.js 16 + React 19 podem manter árvores de rota em background Activity
 * com display:none. Para regressão visual/funcional o contrato correto é existir
 * exatamente uma instância VISÍVEL. Duas instâncias visíveis continuam falhando.
 */
async function expectSingleVisible(locator: Locator, label: string) {
  await expect(locator, `${label} visível não ficou único`).toHaveCount(1)
  await expect(locator).toBeVisible()
}

function visible(page: Page, selector: string) {
  return page.locator(`${selector}:visible`)
}

test.describe.configure({ timeout: 120_000 })

test.describe('R208 — Campeonatos e vagas em um catálogo único', () => {
  test('início usa somente o cabeçalho storefront', async ({ page, isMobile }) => {
    await open(page, '/')

    await expect(visible(page, '.app-header')).toHaveCount(0)
    const storefrontHeader = visible(page, '.store-home-header')
    await expectSingleVisible(storefrontHeader, 'Cabeçalho storefront da Home')

    if (isMobile) {
      await expect(visible(page, '.store-home-nav')).toHaveCount(0)
      await expectSingleVisible(visible(page, 'button.store-home-mobile-toggle'), 'Botão do menu mobile da Home')
    } else {
      await expectSingleVisible(visible(page, '.store-home-nav'), 'Navegação principal da Home')
    }

    await noOverflow(page)
  })

  test('header principal mostra Campeonatos e não mostra aba Vagas', async ({ page, isMobile }) => {
    await open(page, '/campeonatos')

    if (isMobile) {
      await expect(visible(page, '.store-home-nav')).toHaveCount(0)
      const toggle = visible(page, 'button.store-home-mobile-toggle')
      await expectSingleVisible(toggle, 'Botão do menu mobile')
      await toggle.click()

      const mobileNav = visible(page, 'nav[aria-label="Navegação mobile"]')
      await expectSingleVisible(mobileNav, 'Navegação mobile')
      await expect(mobileNav.getByRole('link', { name: 'CAMPEONATOS', exact: true })).toBeVisible()
      await expect(mobileNav.getByRole('link', { name: 'VAGAS', exact: true })).toHaveCount(0)
    } else {
      const desktopNav = visible(page, '.store-home-nav')
      await expectSingleVisible(desktopNav, 'Navegação principal')
      await expect(desktopNav.getByRole('link', { name: 'CAMPEONATOS', exact: true })).toBeVisible()
      await expect(desktopNav.getByRole('link', { name: 'VAGAS', exact: true })).toHaveCount(0)
    }

    await noOverflow(page)
  })

  test('/vagas redireciona para /campeonatos e preserva filtros antigos', async ({ page }) => {
    await open(page, '/vagas?gratis=1&hoje=1')
    await page.waitForURL((url) => url.pathname === '/campeonatos', { timeout: 20_000 })

    const url = new URL(page.url())
    expect(url.pathname).toBe('/campeonatos')
    expect(url.searchParams.get('vagas')).toBe('1')
    expect(url.searchParams.get('gratis')).toBe('1')
    expect(url.searchParams.get('hoje')).toBe('1')

    const root = visible(page, '.directory-championship-page')
    await expectSingleVisible(root, 'Página de campeonatos')
    await noOverflow(page)
  })

  test('/campeonatos usa lista e expõe filtros comerciais', async ({ page, isMobile }) => {
    await open(page, '/campeonatos?vagas=1')

    const root = visible(page, '.directory-championship-page')
    await expectSingleVisible(root, 'Página de campeonatos')
    await expect(root.locator('.dz-champ-card')).toHaveCount(0)
    await expect(root.getByRole('button', { name: 'Vagas abertas', exact: true })).toHaveClass(/active/)
    await expect(root.getByRole('button', { name: 'Com premiação', exact: true })).toBeVisible()
    await expect(root.getByRole('button', { name: 'Com transmissão', exact: true })).toBeVisible()

    const rows = root.locator('[data-championship-list-row]:visible')
    if (isMobile) {
      // No mobile o cabeçalho de colunas é ocultado de propósito; as legendas
      // reaparecem dentro das métricas de cada linha.
      await expect(root.locator('.championship-directory-list-head:visible')).toHaveCount(0)
      if (await rows.count()) {
        const row = rows.first()
        await expect(row).toBeVisible()
        const metrics = row.locator('.dz-champ-list-row__metrics')
        await expect(metrics).toBeVisible()
        await expect(metrics.getByText('Vagas', { exact: true })).toBeVisible()
        await expect(metrics.getByText('Inscrição', { exact: true })).toBeVisible()
        await expect(metrics.getByText('Premiação', { exact: true })).toBeVisible()
        await expect(metrics.getByText('Próxima data', { exact: true })).toBeVisible()
        await expect(row.locator('.dz-champ-list-row__actions')).toBeVisible()
      }
    } else {
      const listHead = root.locator('.championship-directory-list-head:visible')
      await expectSingleVisible(listHead, 'Cabeçalho da lista de campeonatos')
      await expect(listHead.getByText('Inscrição', { exact: true })).toBeVisible()
      await expect(listHead.getByText('Premiação', { exact: true })).toBeVisible()
      if (await rows.count()) {
        await expect(rows.first()).toBeVisible()
        await expect(rows.first().locator('.dz-champ-list-row__metrics')).toBeVisible()
        await expect(rows.first().locator('.dz-champ-list-row__actions')).toBeVisible()
      }
    }
    await noOverflow(page)
  })

  test('mobile mantém lista e filtros sem overflow horizontal', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Validação específica do projeto mobile')
    await open(page, '/campeonatos')

    const root = visible(page, '.directory-championship-page')
    await expectSingleVisible(root, 'Página de campeonatos')

    const filterbar = root.locator('.championship-directory-filterbar:visible')
    await expectSingleVisible(filterbar, 'Barra de filtros de campeonatos')

    const rows = root.locator('[data-championship-list-row]')
    if (await rows.count()) await expect(rows.first()).toBeVisible()
    await noOverflow(page)
  })
})
