import { expect, test } from '@playwright/test'

test('API de saúde responde sem erro de servidor', async ({ request }) => {
  const response = await request.get('/api/ping')

  expect(response.status(), await response.text()).toBeLessThan(500)
  expect(response.ok()).toBeTruthy()
})
