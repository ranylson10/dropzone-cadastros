import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.setTimeout(90_000)
async function check(page: Page) {
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() })
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']).analyze()
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { rows: [], items: [], equipes: [], jogadores: [], final_concluida: false, publicacao: { visivel: true } } })
  })
})

test('team separates agenda from tabs and collapses unavailable telemetry', async ({ page }) => {
  await page.goto('/equipes/b85a889c-0f86-4f01-90c8-d72540b68bd6')
  const group = page.locator('.directory-profile-tabs[role=tablist]')
  await expect(group.getByRole('tab').first()).toBeVisible()
  await expect(group.getByRole('link', { name: 'Agenda' })).toHaveCount(0)
  await expect(page.locator('.competitive-profile-details')).not.toHaveAttribute('open')
  await check(page)
  await page.getByText('Mais estatísticas', { exact: true }).click()
  await expect(page.locator('.competitive-profile-details')).toHaveAttribute('open', '')
  await check(page)
})

test('championship statistics use keyboard tabs and accessible filter headings', async ({ page }) => {
  await page.goto('/campeonatos/24bc1d2b-758b-4cbb-a6b7-b815b2d9f493')
  await check(page)
  await page.getByRole('tab', { name: /^Estatísticas/ }).click()
  const tabs = page.getByRole('tablist', { name: 'Tipo de estatística' })
  const table = tabs.getByRole('tab', { name: 'Tabela' })
  await table.focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'MVP' })).toHaveAttribute('aria-selected', 'true')
  await check(page)
  const filters = page.getByRole('button', { name: 'Abrir filtros', exact: true })
  if (await filters.isVisible()) { await filters.click(); await check(page) }
})

for (const route of ['/agenda','/lili']) test(`${route} has a page title and readable controls`, async ({ page }) => {
  await page.goto(route)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page)
})
