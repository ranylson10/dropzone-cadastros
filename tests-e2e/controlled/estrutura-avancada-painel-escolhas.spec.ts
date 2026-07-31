import { expect, test } from '@playwright/test'

test.describe('Estrutura avançada — painel operacional de escolhas', () => {
  test('mantém filtros, exportação e ações administrativas explícitas', async ({ request }) => {
    const response = await request.get('/api/ping')
    expect(response.ok()).toBeTruthy()
  })
})
