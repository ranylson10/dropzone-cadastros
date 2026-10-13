import { test, expect } from '@playwright/test'

const routes = ['/', '/campeonatos', '/login']

test.describe.configure({ mode: 'serial' })

test('R196 — CSS compartilhado está carregado no runtime', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      surface: styles.getPropertyValue('--dz-ui-surface').trim(),
      accent: styles.getPropertyValue('--dz-ui-accent').trim(),
      controlHeight: styles.getPropertyValue('--dz-ui-control-height').trim(),
    }
  })
  expect(tokens.surface).not.toBe('')
  expect(tokens.accent).not.toBe('')
  expect(tokens.controlHeight).toBe('42px')
})

for (const route of routes) {
  test(`${route} continua sem overflow depois da fundação compartilhada`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    expect(response?.status() ?? 200).toBeLessThan(500)
    const dims = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(dims.scroll).toBeLessThanOrEqual(dims.client + 4)
  })
}
