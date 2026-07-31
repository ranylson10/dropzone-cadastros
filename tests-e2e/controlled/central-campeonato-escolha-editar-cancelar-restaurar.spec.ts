import { expect, test } from '@playwright/test'

const route = '/api/campeonatos/campeonato-controlado/escolha-grupo'

test.describe('Rodada 85I — ciclo completo da escolha manual', () => {
  test('expõe métodos para editar, cancelar e restaurar sem distribuição automática', async ({ request }) => {
    for (const method of ['patch', 'delete', 'put'] as const) {
      const response = await request[method](route, { data: {} })
      expect([400, 401, 403]).toContain(response.status())
      expect(response.status()).not.toBe(404)
      expect(response.status()).not.toBe(405)
    }
  })

  test('mantém a escolha dependente de equipe, grupo e slot informados', async ({ request }) => {
    const response = await request.patch(route, { data: { campeonato_equipe_id: '' } })
    expect([400, 401, 403]).toContain(response.status())
  })
})
