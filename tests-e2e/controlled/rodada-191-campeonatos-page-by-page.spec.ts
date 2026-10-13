import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe.configure({ mode: 'serial', timeout: 90_000 })

async function open(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  expect(response?.status() || 200).toBeLessThan(500)
  await page.waitForTimeout(350)
}

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

async function rendered(page: Page, selector: string) {
  const node = page.locator(selector).first()
  await expect(node).toBeVisible({ timeout: 15_000 })
  await expect(node).not.toHaveCSS('visibility', 'hidden')
  await expect(node).not.toHaveCSS('opacity', '0')
}

test('/campeonatos — catálogo', async ({ page }) => {
  await open(page, '/campeonatos')
  await rendered(page, '.directory-market-page')
  await rendered(page, '.champ-market-intro')
  await rendered(page, '.champ-market-categories')
  await rendered(page, '#marketplace-catalog')
  await noOverflow(page)
})

test('/campeonatos — primeiro detalhe real', async ({ page }) => {
  await open(page, '/campeonatos')
  const link = page.locator('article.directory-champ-card a.directory-champ-title, article.directory-champ-card a.directory-champ-cover').first()
  test.skip(await link.count() === 0, 'Não há campeonato público para validar o detalhe.')
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^\/campeonatos\//)
  await open(page, String(href))
  await rendered(page, '.champ-public')
  await rendered(page, '.champ-public-banner')
  await rendered(page, '.champ-public-panel')
  await noOverflow(page)
})

test('/campeonatos/[id]/regulamento — página pública', async ({ page }) => {
  await open(page, '/campeonatos')
  const link = page.locator('article.directory-champ-card a.directory-champ-title, article.directory-champ-card a.directory-champ-cover').first()
  test.skip(await link.count() === 0, 'Não há campeonato público para validar o regulamento.')
  const href = await link.getAttribute('href')
  const id = String(href).split('/').filter(Boolean).pop()
  await open(page, `/campeonatos/${id}/regulamento`)
  await rendered(page, '.rulebook-public-page')
  await rendered(page, '.rulebook-public-hero')
  await noOverflow(page)
})

test('/campeonatos/[id]/stream — handoff local', async ({ page }) => {
  await open(page, '/campeonatos')
  const link = page.locator('article.directory-champ-card a.directory-champ-title, article.directory-champ-card a.directory-champ-cover').first()
  test.skip(await link.count() === 0, 'Não há campeonato público para validar stream.')
  const href = await link.getAttribute('href')
  const id = String(href).split('/').filter(Boolean).pop()
  await open(page, `/campeonatos/${id}/stream`)
  await rendered(page, '.local-studio-handoff-page')
  await rendered(page, '.local-studio-handoff-card')
  await noOverflow(page)
})

test('central do campeonato — sessão de produtora, quando disponível', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/produtora.json')
  test.skip(!fs.existsSync(state), 'Sessão de produtora não encontrada.')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await open(page, `${baseURL || 'http://localhost:3000'}/central-campeonato`)
    await rendered(page, '.championship-central-page')
    await rendered(page, '.championship-central-shell')
    await noOverflow(page)
  } finally {
    if (!page.isClosed()) await page.close().catch(() => undefined)
    await context.close().catch(() => undefined)
  }
})

test('painel da produtora — workspace de campeonatos', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/produtora.json')
  test.skip(!fs.existsSync(state), 'Sessão de produtora não encontrada.')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await open(page, `${baseURL || 'http://localhost:3000'}/?painel=1`)
    await rendered(page, '.producer-layout-ref')
    const campeonatoButton = page.getByRole('button', { name: /campeonatos/i }).first()
    if (await campeonatoButton.count()) await campeonatoButton.click()
    await page.waitForTimeout(250)
    await expect(page.locator('.championship-nav-card, .championship-detail-card').first()).toBeVisible({ timeout: 15_000 })
    await noOverflow(page)
  } finally {
    if (!page.isClosed()) await page.close().catch(() => undefined)
    await context.close().catch(() => undefined)
  }
})
