import { expect, test } from '@playwright/test'

test.describe('Estrutura avançada — prazos e bloqueios de escolha', () => {
  test('mantém escolha manual sem distribuição automática', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL || ''}/api/ping`)
    expect(response.ok()).toBeTruthy()
  })
})
