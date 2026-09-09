import { expect, test } from '@playwright/test'

test('home pública carrega e hidrata sem falha de chunk', async ({ page, baseURL }) => {
  const pageErrors: string[] = []
  const failedChunks: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.url().includes('/_next/static/')) {
      failedChunks.push(`${request.url()}: ${request.failure()?.errorText || 'falha'}`)
    }
  })

  const response = await page.goto(new URL('/', baseURL || 'http://127.0.0.1:3000').toString(), {
    waitUntil: 'networkidle',
  })

  expect(response?.status()).toBeLessThan(500)
  await expect(page).toHaveURL(/\/login\?returnTo=%2F/)
  await expect(page.getByRole('heading', { name: 'ENTRE COM SUA CONTA' })).toBeVisible()
  expect(failedChunks).toEqual([])
  expect(pageErrors).toEqual([])
})
