import { expect, test } from '@playwright/test'
import { deputyFixture } from '../helpers/circuito-fixture'
import { assertSharedIdentity } from '../helpers/shared-identity'
import { inspectContrast } from '../../scripts/design/inspect-contrast.mjs'

test.setTimeout(90_000)
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }) })

test('guest dock opens panels independently of the header menu and restores focus', async ({ page }) => {
  await page.goto('/equipes')
  const trigger = page.getByRole('button', { name: 'Abrir meus painéis', exact: true })
  await trigger.click()
  const sheet = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  await expect(sheet.getByRole('link', { name: 'Entrar na minha conta' })).toHaveAttribute('href', /returnTo=/)
  expect((await sheet.boundingBox())!.y).toBeGreaterThan(250)
  await expect(sheet.getByRole('link', { name: 'Produtoras', exact: true })).toHaveCount(0)
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    expect(await sheet.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menu completo do DropZone' })).toBeVisible()
})

test('authorized subprofiles open normal panels and keep deputy permissions across switches', async ({ page }, info) => {
  const fixture = await deputyFixture(page, { ownedProducer: true })
  await page.goto('/equipes')
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  const sheet = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  await expect(sheet.getByRole('region', { name: 'Equipes' })).toHaveCount(1)
  await expect(sheet.getByText('Vice-líder', { exact: true })).toHaveCount(0)
  await expect(sheet.getByText('Equipe · Vice-líder')).toHaveCount(2)
  await expect(sheet.getByRole('link', { name: /6B Produções/ })).toHaveAttribute('href', /perfil=produtora&perfil_id=producer-a/)
  await assertSharedIdentity(page)
  expect(await page.evaluate(inspectContrast, '.dz-panel-switcher *')).toEqual([])
  await page.screenshot({ path: info.outputPath('panels-sheet.png') })
  await sheet.getByRole('link', { name: /Equipe Brasa/ }).click()
  await expect(page).toHaveURL(/painel=1&perfil=equipe&perfil_id=team-b/)
  await expect(page.getByRole('heading', { name: 'Painel da equipe', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  await expect(sheet.getByRole('link', { name: /Equipe Brasa/ })).toHaveAttribute('aria-current', 'true')
  await sheet.getByRole('link', { name: /Jogador Aurora/ }).click()
  await expect(page.getByRole('heading', { name: /Jogador Aurora/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  await sheet.getByRole('link', { name: /6B Produções/ }).click()
  await expect(page.getByRole('region', { name: 'Visão geral da produtora', exact: true })).toBeVisible()
  const dock = page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' })
  await dock.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.locator('.store-home-header:visible')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Visão geral da produtora', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  await sheet.getByRole('link', { name: /Equipe Aurora/ }).click()
  await expect(page.getByRole('heading', { name: /Equipe Aurora/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toHaveCount(0)
  expect(fixture.errors).toEqual([])
})

test('picker retries failed reads and refreshes permissions whenever reopened', async ({ page }) => {
  const fixture = await deputyFixture(page)
  let failed = true
  let requests = 0
  let revoked = false
  await page.route('**/api/me/contexts', route => {
    expect(route.request().method()).toBe('GET')
    requests++
    return failed ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: { contexts: fixture.contexts.filter(item => !revoked || item.id !== 'team-b') } })
  })
  await page.goto('/equipes')
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  const sheet = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  await expect(sheet.getByRole('alert')).toContainText('Não foi possível')
  failed = false
  await sheet.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(sheet.getByRole('link', { name: /Equipe Brasa/ })).toBeVisible()
  await page.keyboard.press('Escape')
  const previous = requests
  revoked = true
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  await expect(sheet.getByRole('link', { name: /Equipe Aurora/ })).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Equipe Brasa/ })).toHaveCount(0)
  expect(requests).toBeGreaterThan(previous)
  expect(fixture.errors).toEqual([])
})

test('long profile lists remain searchable and scroll inside a short mobile sheet', async ({ page }, info) => {
  const fixture = await deputyFixture(page, { ownedProducer: true, extraTeams: 10 })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/equipes')
  await page.getByRole('button', { name: 'Abrir meus painéis' }).click()
  const sheet = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  const search = sheet.getByRole('textbox', { name: 'Buscar painel' })
  await expect(search).toBeVisible()
  await search.fill('6B')
  await expect(sheet.getByRole('link')).toHaveCount(1)
  await expect(sheet.getByRole('link', { name: /6B Produções/ })).toBeVisible()
  await search.fill('inexistente')
  await expect(sheet.getByRole('status')).toHaveText('Nenhum painel encontrado.')
  await search.fill('')
  const last = sheet.getByRole('link', { name: /Jogador Brasa/ })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  const content = sheet.locator('.system-modal-content')
  expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(568 * .82 + 2)
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('panels-short-screen.png') })
  expect(fixture.errors).toEqual([])
})

test('championship wrappers are flat on mobile while desktop and item rows keep their surfaces', async ({ page }, info) => {
  const url = '/campeonatos/d9fd2723-800c-418b-bd35-b5a5186b685e'
  await page.goto(url)
  await page.getByRole('tab', { name: /^Equipes/ }).click()
  for (const selector of ['.dz-champ-simple-header', '.champ-public-panel', '.champ-public-nav']) {
    const element = page.locator(`${selector}:visible`)
    await expect(element).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(element).toHaveCSS('border-radius', '0px')
    await expect(element).toHaveCSS('border-top-width', '0px')
  }
  const rows = page.locator('.champ-public-team-row:visible')
  await expect(rows.nth(1)).toBeVisible()
  await expect(rows.first()).toHaveCSS('background-color', 'rgb(255, 254, 249)')
  await expect(rows.nth(1)).toHaveCSS('background-color', 'rgb(233, 231, 223)')
  await page.screenshot({ path: info.outputPath('championship-flat-mobile.png'), fullPage: true })
  await assertSharedIdentity(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('.dz-champ-simple-header:visible')).toHaveCSS('background-color', 'rgb(255, 254, 249)')
  await expect(page.locator('.dz-champ-simple-header:visible')).toHaveCSS('border-top-width', '1px')
})

test('mobile ranking and profile headers consume the flat shared heading skin', async ({ page }, info) => {
  await page.goto('/rank')
  await expect(page.locator('.directory-rank-hero:visible')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect(await page.locator('.directory-page-body:visible').evaluate(element => getComputedStyle(element, '::before').content)).toBe('none')
  expect(await page.evaluate(inspectContrast, '.directory-rank-hero *')).toEqual([])
  await page.screenshot({ path: info.outputPath('ranking-flat-mobile.png') })
  await page.goto('/equipes/b85a889c-0f86-4f01-90c8-d72540b68bd6')
  const hero = page.locator('.profile-command-hero:visible')
  await expect(hero).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  expect(await hero.evaluate(element => ['::before', '::after'].map(pseudo => getComputedStyle(element, pseudo).content))).toEqual(['none', 'none'])
  await expect(page.locator('.profile-command-facts:visible')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('profile-flat-mobile.png') })
})
