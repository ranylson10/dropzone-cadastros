import { expect, test, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))).toMatchObject({ client: expect.any(Number), scroll: expect.any(Number) })
  const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(dims.scroll, `overflow horizontal: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 3)
}

async function expectLightSurface(page: Page, selector: string) {
  const node = page.locator(selector).first()
  await expect(node).toBeVisible()
  const bg = await node.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg, `${selector} não pode continuar preto/sem superfície`).not.toBe('rgb(0, 0, 0)')
  expect(bg, `${selector} deve ter fundo renderizado`).not.toBe('rgba(0, 0, 0, 0)')
}

const publicPages = [
  ['/', '.store-home'],
  ['/campeonatos', '.directory-market-page'],
  ['/equipes', '.directory-page.directory-theme-equipes'],
  ['/jogadores', '.directory-page.directory-theme-jogadores'],
  ['/produtoras', '.directory-page.directory-theme-produtoras'],
  ['/managers', '.directory-page.directory-theme-managers'],
  ['/rank', '.directory-rank-content'],
  ['/comunidade', '.community-hub-grid'],
  ['/vagas', '.vacancies-page'],
  ['/carrinho', '.cart-page'],
  ['/afiliados', '.affiliate-page'],
  ['/agenda', '.agenda-root'],
  ['/login', '.login-portal-panel'],
  ['/politica-de-privacidade', '.legal-document'],
  ['/termos-de-servico', '.legal-document'],
  ['/exclusao-de-dados', '.legal-document'],
] as const

for (const [route, selector] of publicPages) {
  test(`${route}: página revisada sem layout quebrado`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response?.status() || 200).toBeLessThan(500)
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await expect(page.locator(selector).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}

test('/campeonatos: catálogo usa largura útil, cards claros e detalhe real', async ({ page }) => {
  await page.goto('/campeonatos', { waitUntil: 'networkidle' })
  await expect(page.locator('.champ-market-intro')).toBeVisible()
  await expectLightSurface(page, '.directory-champ-card .directory-champ-body')
  const card = page.locator('a.directory-champ-card').first()
  if (await card.count()) {
    const href = await card.getAttribute('href')
    expect(href).toMatch(/^\/campeonatos\//)
    await page.goto(String(href), { waitUntil: 'networkidle' })
    await expect(page.locator('.champ-public')).toBeVisible()
    await expectLightSurface(page, '.champ-public-panel')
    await expectNoHorizontalOverflow(page)

    const rulebook = page.locator('a[href*="/regulamento"]').first()
    if (await rulebook.count()) {
      const ruleHref = await rulebook.getAttribute('href')
      await page.goto(String(ruleHref), { waitUntil: 'networkidle' })
      await expect(page.locator('.rulebook-public-page')).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }

    const champId = String(href).split('/').filter(Boolean).pop()
    if (champId) {
      await page.goto(`/campeonatos/${champId}/stream`, { waitUntil: 'networkidle' })
      await expect(page.locator('.local-studio-handoff-page')).toBeVisible()
      await expectLightSurface(page, '.local-studio-handoff-card')
    }
  }
})

for (const kind of ['equipes', 'jogadores', 'produtoras', 'managers'] as const) {
  test(`/${kind}: lista e primeiro perfil usam o layout novo`, async ({ page }) => {
    await page.goto(`/${kind}`, { waitUntil: 'networkidle' })
    await expectLightSurface(page, '.directory-list:not(.directory-rank-list)')
    const first = page.locator(`a.directory-list-row-${kind}`).first()
    if (await first.count()) {
      const href = await first.getAttribute('href')
      await page.goto(String(href), { waitUntil: 'networkidle' })
      await expect(page.locator('.profile-command-page')).toBeVisible()
      await expectLightSurface(page, '.directory-profile-tab-panel')
      await expectNoHorizontalOverflow(page)
    }
  })
}

const rolePanels = [
  ['produtora', '.producer-layout-ref'],
  ['equipe', '.team-dashboard'],
  ['jogador', '.player-dashboard'],
  ['manager', '.manager-dashboard'],
] as const

for (const [role, selector] of rolePanels) {
  test(`${role}: painel real usa layout revisado`, async ({ browser, baseURL }) => {
    const state = path.resolve(`tests-e2e/.auth/${role}.json`)
    test.skip(!fs.existsSync(state), `Capture a sessão do perfil ${role}`)
    const context = await browser.newContext({ storageState: state })
    const page = await context.newPage()
    try {
      await page.goto(`${baseURL || 'http://localhost:3000'}/?painel=1`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => undefined)
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 20_000 })
      await expectLightSurface(page, `${selector} .panel`)
      await expectNoHorizontalOverflow(page)
    } finally {
      await context.close()
    }
  })
}

test('admin: todas as abas estão dentro da central revisada', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/admin.json')
  test.skip(!fs.existsSync(state), 'Capture a sessão admin')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await page.goto(`${baseURL || 'http://localhost:3000'}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await expect(page.locator('.system-admin-page')).toBeVisible()
    for (const label of ['Visão geral', 'Página inicial', 'Produtoras', 'Publicações', 'Preços', 'Saques', 'Contas', 'Denúncias', 'Auditoria']) {
      const tab = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
      await expect(tab).toBeVisible()
      await tab.click()
      await expectNoHorizontalOverflow(page)
    }
  } finally {
    await context.close()
  }
})
