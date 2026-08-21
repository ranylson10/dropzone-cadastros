import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { acquireFileLock, releaseFileLock } from '../support/file-lock'
import { activeAuthToken } from '../support/auth-session'

const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')
const managerAuthFile = path.resolve('tests-e2e/.auth/manager.json')
const lockFile = path.resolve('tests-e2e/.auth/convites-permissoes.lock')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

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

async function accountId(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: 'equipe' | 'manager',
) {
  const response = await request.get(`${origin}/api/me`, { headers: headers(token, profileType) })
  const body = await json(response)
  expect(response.ok(), `Falha ao identificar ${profileType}: ${body?.error || response.status()}`).toBeTruthy()
  const id = String(body?.account?.id || '')
  expect(id, `A sessão de ${profileType} deve retornar account.id.`).not.toBe('')
  return id
}


async function archiveNotification(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: string,
  id: string,
) {
  if (!id) return
  await request.delete(`${origin}/api/notificacoes?id=${encodeURIComponent(id)}`, {
    headers: headers(token, profileType),
  }).catch(() => null)
}

test.describe('Convites e permissões controlados — staff de equipe', () => {
  test.setTimeout(420_000)

  test('equipe convida manager, valida isolamento, atualiza permissões e remove o vínculo', async ({ request, browser, baseURL }) => {
    test.skip(
      !fs.existsSync(equipeAuthFile) || !fs.existsSync(managerAuthFile),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    await acquireFileLock(lockFile, 'convites e permissões')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')
    const managerToken = await activeAuthToken(browser, managerAuthFile, '/managers')
    const equipeId = await accountId(request, origin, equipeToken, 'equipe')
    const managerId = await accountId(request, origin, managerToken, 'manager')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let conviteId = ''
    let notificacaoId = ''
    let staffAtivo = false

    try {
      // Garante que não exista vínculo ativo deixado por uma execução interrompida.
      const initialStaffResponse = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(equipeToken, 'equipe'),
      })
      const initialStaffBody = await json(initialStaffResponse)
      expect(initialStaffResponse.ok(), `Falha ao consultar staff inicial: ${initialStaffBody?.error || initialStaffResponse.status()}`).toBeTruthy()
      const existing = (Array.isArray(initialStaffBody?.staff) ? initialStaffBody.staff : [])
        .find((item: any) => String(item?.manager_id || '') === managerId)
      if (existing) {
        const removeExisting = await request.delete(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
          headers: headers(equipeToken, 'equipe'),
          data: { manager_id: managerId },
        })
        const removeExistingBody = await json(removeExisting)
        expect(removeExisting.ok(), `Falha ao limpar vínculo antigo: ${removeExistingBody?.error || removeExisting.status()}`).toBeTruthy()
      }

      const inviteResponse = await request.post(
        `${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff/convites`,
        {
          headers: headers(equipeToken, 'equipe'),
          data: {
            manager_id: managerId,
            mensagem: `[E2E] Convite controlado ${unique}`,
            validade_dias: 1,
            pode_ver: true,
            pode_editar: false,
            pode_escalar: true,
            pode_gerar_token: false,
          },
        },
      )
      const inviteBody = await json(inviteResponse)
      expect(inviteResponse.ok(), `Falha ao criar convite: ${inviteBody?.error || inviteResponse.status()}`).toBeTruthy()
      conviteId = String(inviteBody?.convite?.id || '')
      notificacaoId = String(inviteBody?.convite?.notificacao_id || '')
      expect(conviteId).not.toBe('')
      expect(notificacaoId).not.toBe('')

      const managerNotificationsResponse = await request.get(`${origin}/api/notificacoes?unread=1&limit=50`, {
        headers: headers(managerToken, 'manager'),
      })
      const managerNotificationsBody = await json(managerNotificationsResponse)
      expect(managerNotificationsResponse.ok(), `Falha ao consultar correio do manager: ${managerNotificationsBody?.error || managerNotificationsResponse.status()}`).toBeTruthy()
      const notification = (Array.isArray(managerNotificationsBody?.items) ? managerNotificationsBody.items : [])
        .find((item: any) => String(item?.id || '') === notificacaoId)
      expect(notification, 'O convite deve aparecer no correio do manager.').toBeTruthy()
      expect(notification?.tipo).toBe('convite_manager_equipe')

      // A identidade da equipe não é a destinatária e não possui o perfil manager convidado.
      const forbiddenResponse = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(notificacaoId)}/aceitar`,
        { headers: headers(equipeToken, 'equipe'), data: {} },
      )
      expect(forbiddenResponse.ok(), 'Uma identidade diferente do manager convidado não pode aceitar a notificação.').toBeFalsy()

      const acceptResponse = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(notificacaoId)}/aceitar`,
        { headers: headers(managerToken, 'manager'), data: {} },
      )
      const acceptBody = await json(acceptResponse)
      expect(acceptResponse.ok(), `Falha ao aceitar convite: ${acceptBody?.error || acceptResponse.status()}`).toBeTruthy()
      expect(acceptBody?.ok).toBe(true)
      staffAtivo = true

      const staffResponse = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(equipeToken, 'equipe'),
      })
      const staffBody = await json(staffResponse)
      expect(staffResponse.ok(), `Falha ao listar staff: ${staffBody?.error || staffResponse.status()}`).toBeTruthy()
      const staff = (Array.isArray(staffBody?.staff) ? staffBody.staff : [])
        .find((item: any) => String(item?.manager_id || '') === managerId)
      expect(staff, 'O manager aceito deve aparecer como staff ativo.').toBeTruthy()
      expect(staff?.pode_ver).toBe(true)
      expect(staff?.pode_editar).toBe(false)
      expect(staff?.pode_escalar).toBe(true)
      expect(staff?.pode_gerar_token).toBe(false)

      const patchResponse = await request.patch(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(equipeToken, 'equipe'),
        data: {
          manager_id: managerId,
          pode_ver: true,
          pode_editar: true,
          pode_escalar: false,
          pode_gerar_token: true,
        },
      })
      const patchBody = await json(patchResponse)
      expect(patchResponse.ok(), `Falha ao atualizar permissões: ${patchBody?.error || patchResponse.status()}`).toBeTruthy()
      expect(patchBody?.staff?.pode_editar).toBe(true)
      expect(patchBody?.staff?.pode_escalar).toBe(false)
      expect(patchBody?.staff?.pode_gerar_token).toBe(true)

      // O próprio manager não pode alterar suas permissões usando a rota exclusiva do dono.
      const managerPatchResponse = await request.patch(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(managerToken, 'manager'),
        data: { manager_id: managerId, pode_editar: false },
      })
      expect(managerPatchResponse.ok(), 'O manager não pode elevar/reduzir as próprias permissões.').toBeFalsy()

      const removeResponse = await request.delete(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(equipeToken, 'equipe'),
        data: { manager_id: managerId },
      })
      const removeBody = await json(removeResponse)
      expect(removeResponse.ok(), `Falha ao remover staff: ${removeBody?.error || removeResponse.status()}`).toBeTruthy()
      expect(removeBody?.ok).toBe(true)
      staffAtivo = false

      const finalStaffResponse = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
        headers: headers(equipeToken, 'equipe'),
      })
      const finalStaffBody = await json(finalStaffResponse)
      expect(finalStaffResponse.ok()).toBeTruthy()
      const finalActive = (Array.isArray(finalStaffBody?.staff) ? finalStaffBody.staff : [])
        .some((item: any) => String(item?.manager_id || '') === managerId)
      expect(finalActive, 'O manager removido não deve permanecer no staff ativo.').toBe(false)
    } finally {
      if (staffAtivo) {
        await request.delete(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff`, {
          headers: headers(equipeToken, 'equipe'),
          data: { manager_id: managerId },
        }).catch(() => null)
      } else if (conviteId && !notificacaoId) {
        await request.delete(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/staff/convites`, {
          headers: headers(equipeToken, 'equipe'),
          data: { convite_id: conviteId },
        }).catch(() => null)
      }

      await archiveNotification(request, origin, managerToken, 'manager', notificacaoId)
      releaseFileLock(lockFile)
    }
  })
})
