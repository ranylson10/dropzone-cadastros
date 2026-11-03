import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { deputyFixture } from '../helpers/circuito-fixture'

const producerUrl = '/?painel=1&perfil=produtora&perfil_id=producer-a'
test.setTimeout(90_000)

async function fixture(page: Page) {
  const result = await deputyFixture(page, { ownedProducer: true, analytics: true })
  const producer = result.contexts.find(item => item.id === 'producer-a')!
  const championships = ['Copa Aurora', 'Liga Brasa', 'Diário Circuito'].map((name, index) => ({
    ...producer, id: `cup-${index}`, entity_type: 'championship', profile_type: null,
    name, parent_id: producer.id, data: { produtora_id: producer.id, aprovacao_status: 'aprovado', tipo: 'copa' },
  }))
  await page.route(url => url.pathname === '/api/dropzone', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { rows: championships, summary: { teamCount: 13, gameCount: 2 } } })
  })
  return result
}

async function check(page: Page) {
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() })
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']).analyze()
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
}

test('panel switching stays reachable in the desktop top bar and mobile dock', async ({ page, isMobile }, info) => {
  const data = await fixture(page)
  await page.goto(producerUrl)
  await expect(page.getByRole('heading', { name: 'Painel da produtora', exact: true })).toBeVisible()
  const header = page.locator('.app-header')
  const box = (await header.boundingBox())!
  expect(box.y).toBe(0)
  expect(box.height).toBeLessThanOrEqual(80)
  expect(box.width).toBeGreaterThan((await page.viewportSize())!.width - 2)
  const trigger = isMobile
    ? page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' }).getByRole('button', { name: 'Abrir meus painéis', exact: true })
    : header.getByRole('button', { name: 'Abrir meus painéis: 6B Produções', exact: true })
  await page.getByRole('button', { name: 'Como organizar campeonatos' }).click()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(trigger).toBeInViewport()
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  await expect(picker.getByRole('link', { name: /Equipe Brasa/ })).toBeVisible()
  await check(page)
  await page.screenshot({ path: info.outputPath('workspace-picker.png') })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await picker.getByRole('link', { name: /Equipe Brasa/ }).click()
  await expect(page.getByRole('heading', { name: 'Painel da equipe', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toBeVisible()
  const nextTrigger = isMobile ? page.getByRole('button', { name: 'Abrir meus painéis', exact: true }) : header.getByRole('button', { name: 'Abrir meus painéis: Equipe Brasa', exact: true })
  await nextTrigger.click()
  await picker.getByRole('link', { name: /Jogador Aurora/ }).click()
  await expect(page.getByRole('heading', { name: 'Meu painel', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('workspace-player.png'), fullPage: true })
  await check(page)
  expect(data.errors).toEqual([])
})

test('producer overview uses the available width and compact metrics', async ({ page, isMobile }, info) => {
  await fixture(page)
  await page.goto(producerUrl)
  const metrics = page.locator('.producer-dashboard-kpis')
  await expect(metrics.locator('article').nth(2).locator('strong')).toHaveText('13')
  const values = await metrics.locator('article > strong').allTextContents()
  expect(values).toEqual(['3','3','13','2'])
  const first = (await metrics.locator('article').first().boundingBox())!
  expect(first.height).toBeLessThanOrEqual(105)
  if (isMobile) {
    const shell = (await page.locator('.panel-workspace-shell').boundingBox())!
    expect(shell.x).toBeLessThanOrEqual(17)
    expect(shell.width).toBeGreaterThan((await page.viewportSize())!.width - 35)
    const second = (await metrics.locator('article').nth(1).boundingBox())!
    expect(Math.abs(first.y-second.y)).toBeLessThan(2)
    expect((await page.locator('.dz-focus').boundingBox())!.x).toBeLessThanOrEqual(17)
  }
  await expect(metrics).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await page.getByRole('button', { name: 'Como organizar campeonatos' }).click()
  await expect(page.locator('#producer-dashboard-flow-help')).toBeVisible()
  await page.getByRole('button', { name: 'Como organizar campeonatos' }).click()
  await check(page)
  await page.screenshot({ path: info.outputPath('workspace-producer.png'), fullPage: true })
})

test('account actions open inside the viewport with readable colors', async ({ page, isMobile }, info) => {
  await fixture(page)
  await page.goto(producerUrl)
  await expect(page.getByRole('heading', { name: 'Painel da produtora' })).toBeVisible()
  if (isMobile) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
    await page.getByRole('button', { name: 'Trocar perfil e configurações da conta' }).click()
  } else await page.locator('.app-profile-trigger').click()
  const account = page.getByRole('region', { name: 'Minha conta', exact: true })
  await expect(account.getByRole('button', { name: 'Sair de todos' })).toBeInViewport()
  const box = (await account.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y+box.height).toBeLessThanOrEqual((await page.viewportSize())!.height)
  await check(page)
  await page.screenshot({ path: info.outputPath('workspace-account-menu.png') })
})
