import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')

function headers(token: string, profileType: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': profileType,
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

test.describe('Agenda, notificações e relatórios — fluxo seguro e controlado', () => {
  test.setTimeout(150_000)

  test('agenda faz CRUD temporário e notificações/relatórios respeitam validações', async ({ request, browser, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, adminAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const adminToken = await activeAuthToken(browser, adminAuthFile, '/admin')
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let eventId = ''

    try {
      const unauthAgenda = await request.get(`${origin}/api/agenda?scope=me&year=2099&month=7`, {
        timeout: 30_000,
      })
      expect(unauthAgenda.ok(), 'Agenda pessoal sem login deve ser bloqueada.').toBe(false)

      const invalidMonth = await request.get(`${origin}/api/agenda?scope=me&year=2099&month=13`, {
        headers: headers(produtoraToken, 'produtora'),
        timeout: 30_000,
      })
      expect(invalidMonth.status(), 'Mês inválido deve retornar 400.').toBe(400)

      const central = await request.get(`${origin}/api/central-campeonato`, {
        headers: headers(produtoraToken, 'produtora'),
        timeout: 30_000,
      })
      const centralBody = await json(central)
      expect(
        central.ok(),
        `Falha ao carregar campeonatos da produtora: status=${central.status()} erro=${centralBody?.error || JSON.stringify(centralBody)}`,
      ).toBe(true)
      const championshipId = String(
        centralBody?.items?.find((item: { id?: string; permission?: { role?: string } }) => item?.permission?.role === 'owner')?.id || '',
      )
      expect(championshipId, 'A produtora precisa possuir ao menos um campeonato próprio para testar a agenda.').not.toBe('')

      const invalidCreate = await request.post(`${origin}/api/agenda`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          titulo: '[E2E] Evento inválido',
          data_evento: '2099-07-30',
          horario_inicio: '20:00',
          horario_fim: '19:00',
        },
        timeout: 30_000,
      })
      expect(invalidCreate.ok(), 'Agenda deve rejeitar horário final anterior ao início.').toBe(false)

      const create = await request.post(`${origin}/api/agenda`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          titulo: `[E2E] Agenda ${runId}`,
          descricao: 'Evento temporário criado pela auditoria automatizada.',
          data_evento: '2099-07-30',
          horario_inicio: '20:00',
          horario_fim: '21:00',
          tipo: 'reuniao',
          visibilidade: 'campeonato',
          campeonato_id: championshipId,
          cor: '#3b82f6',
        },
        timeout: 30_000,
      })
      const createBody = await json(create)
      expect(create.status(), `Falha ao criar evento: ${createBody?.error || create.status()}`).toBe(201)
      eventId = String(createBody?.item?.id || '')
      expect(eventId).not.toBe('')

      const list = await request.get(`${origin}/api/agenda?scope=campeonato&id=${encodeURIComponent(championshipId)}&year=2099&month=7`, {
        headers: headers(produtoraToken, 'produtora'),
        timeout: 30_000,
      })
      const listBody = await json(list)
      expect(list.ok(), `Falha ao listar agenda: ${listBody?.error || list.status()}`).toBe(true)
      expect(Array.isArray(listBody?.items)).toBe(true)
      const createdItem = listBody?.items?.find((item: { id?: string }) => item.id === eventId)
      expect(createdItem).toBeTruthy()
      expect(createdItem?.editable).toBe(true)
      expect(createdItem?.visibilidade).toBe('campeonato')

      const update = await request.patch(`${origin}/api/agenda`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          id: eventId,
          titulo: `[E2E] Agenda atualizada ${runId}`,
          descricao: 'Evento temporário atualizado pela auditoria.',
          data_evento: '2099-07-30',
          horario_inicio: '20:30',
          horario_fim: '21:30',
          tipo: 'treino',
          visibilidade: 'campeonato',
          campeonato_id: championshipId,
          cor: '#16a34a',
        },
        timeout: 30_000,
      })
      const updateBody = await json(update)
      expect(update.ok(), `Falha ao atualizar evento: ${updateBody?.error || update.status()}`).toBe(true)
      expect(String(updateBody?.item?.id || '')).toBe(eventId)
      expect(updateBody?.item?.titulo).toContain('Agenda atualizada')

      const notificationsUnauth = await request.get(`${origin}/api/notificacoes`, { timeout: 30_000 })
      expect(notificationsUnauth.ok(), 'Notificações sem login devem ser bloqueadas.').toBe(false)

      const notifications = await request.get(`${origin}/api/notificacoes?limit=5`, {
        headers: headers(produtoraToken, 'produtora'),
        timeout: 30_000,
      })
      const notificationsBody = await json(notifications)
      expect(
        notifications.ok(),
        `Falha ao listar notificações: ${notificationsBody?.error || notifications.status()}`,
      ).toBe(true)
      expect(Array.isArray(notificationsBody?.items)).toBe(true)
      expect(typeof notificationsBody?.nao_lidas).toBe('number')

      const invalidNotificationStatus = await request.patch(`${origin}/api/notificacoes`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          id: '00000000-0000-4000-8000-000000000073',
          status: 'status_inexistente',
        },
        timeout: 30_000,
      })
      expect(invalidNotificationStatus.status(), 'Status inválido de notificação deve retornar 400.').toBe(400)

      const reportUnauth = await request.post(`${origin}/api/reports`, {
        data: {},
        timeout: 30_000,
      })
      expect(reportUnauth.ok(), 'Denúncia sem autenticação deve ser bloqueada.').toBe(false)

      const invalidTarget = await request.post(`${origin}/api/reports`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          target_type: 'invalido',
          target_id: 'nao-e-uuid',
          category: 'Teste',
          description: 'Descrição longa o suficiente para validar o endpoint.',
        },
        timeout: 30_000,
      })
      const invalidTargetBody = await json(invalidTarget)
      expect(invalidTarget.status(), 'Alvo inválido de denúncia deve retornar 400.').toBe(400)
      expect(String(invalidTargetBody?.error || '')).toContain('Alvo inválido')

      const shortDescription = await request.post(`${origin}/api/reports`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          target_type: 'campeonato',
          target_id: '00000000-0000-4000-8000-000000000073',
          category: 'Bug',
          description: 'curta',
        },
        timeout: 30_000,
      })
      expect(shortDescription.status(), 'Descrição curta deve ser rejeitada.').toBe(400)

      const adminReportUnauth = await request.patch(`${origin}/api/admin/reports`, {
        data: {
          id: '00000000-0000-4000-8000-000000000073',
          status: 'arquivada',
        },
        timeout: 30_000,
      })
      expect(adminReportUnauth.ok(), 'Moderação de denúncia sem login deve ser bloqueada.').toBe(false)

      const invalidAdminStatus = await request.patch(`${origin}/api/admin/reports`, {
        headers: headers(adminToken, 'admin'),
        data: {
          id: '00000000-0000-4000-8000-000000000073',
          status: 'invalido',
        },
        timeout: 30_000,
      })
      expect(invalidAdminStatus.status(), 'Administrador deve rejeitar status inválido.').toBe(400)
    } finally {
      if (eventId) {
        const cleanup = await request.delete(`${origin}/api/agenda?id=${encodeURIComponent(eventId)}`, {
          headers: headers(produtoraToken, 'produtora'),
          timeout: 30_000,
        })
        const cleanupBody = await json(cleanup)
        expect(cleanup.ok(), `Falha ao limpar evento temporário: ${cleanupBody?.error || cleanup.status()}`).toBe(true)
      }
    }
  })
})
