import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')

function headers(token: string, profileType?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(profileType ? { 'x-profile-type': profileType } : {}),
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

async function createEntity(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: string,
  data: Record<string, unknown>,
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request.post(`${origin}/api/dropzone`, {
        headers: headers(token, profileType),
        data,
        timeout: 30_000,
      })
      const body = await json(response)
      expect(response.ok(), `Falha ao criar ${String(data.entity_type)}: ${body?.error || response.status()}`).toBeTruthy()
      return body?.row
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500))
    }
  }

  throw lastError
}

async function deleteEntity(
  request: APIRequestContext,
  origin: string,
  token: string,
  entityType: string,
  id: string,
) {
  const response = await request.delete(`${origin}/api/dropzone`, {
    headers: headers(token, 'produtora'),
    data: { entity_type: entityType, id },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao limpar ${entityType}: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.success).toBe(true)
}

async function getTeamId(request: APIRequestContext, origin: string, token: string) {
  const response = await request.get(`${origin}/api/me`, {
    headers: headers(token, 'equipe'),
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao identificar equipe E2E: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.account?.profile_type).toBe('equipe')
  const id = String(body?.account?.id || '')
  expect(id, 'A sessão de equipe deve retornar o ID do perfil').not.toBe('')
  return id
}


async function getOrCreateTeamLine(
  request: APIRequestContext,
  origin: string,
  token: string,
  equipeId: string,
  unique: string,
) {
  const response = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(token, 'equipe'),
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao consultar lines da equipe: ${body?.error || response.status()}`).toBeTruthy()

  const lines = Array.isArray(body?.lines) ? body.lines : []
  const active = lines.find((line: any) => String(line?.status || 'ativo').toLowerCase() !== 'inativo')
  if (active?.id) return { id: String(active.id), temporary: false }

  const createResponse = await request.post(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(token, 'equipe'),
    data: { nome: `[E2E] Line temporária ${unique}` },
  })
  const createBody = await json(createResponse)
  expect(
    createResponse.ok(),
    `Falha ao criar line temporária E2E: ${createBody?.error || createResponse.status()}`,
  ).toBeTruthy()

  const id = String(createBody?.line?.id || '')
  expect(id, 'A API deve retornar o ID da line temporária').not.toBe('')
  return { id, temporary: true }
}

async function removeTemporaryTeamLine(
  request: APIRequestContext,
  origin: string,
  token: string,
  equipeId: string,
  lineId: string,
) {
  const response = await request.delete(
    `${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines?line_id=${encodeURIComponent(lineId)}`,
    { headers: headers(token, 'equipe') },
  )
  const body = await json(response)
  expect(response.ok(), `Falha ao remover line temporária E2E: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.ok).toBe(true)
}

async function approveChampionship(
  request: APIRequestContext,
  origin: string,
  token: string,
  id: string,
) {
  const response = await request.patch(`${origin}/api/admin/aprovacoes`, {
    headers: headers(token),
    data: {
      alvo: 'campeonato',
      id,
      status: 'aprovado',
      motivo: 'Aprovação automática para inscrição controlada E2E',
      cobranca_status: 'cortesia',
      cobranca_obs: 'Campeonato temporário removido automaticamente pelo E2E.',
    },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao aprovar campeonato: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.item?.aprovacao_status).toBe('aprovado')
}

async function listChampionshipEntities(
  request: APIRequestContext,
  origin: string,
  token: string,
  entityType: string,
  championshipId: string,
) {
  const response = await request.get(
    `${origin}/api/dropzone?entity_type=${encodeURIComponent(entityType)}&championship_id=${encodeURIComponent(championshipId)}`,
    { headers: headers(token, 'produtora') },
  )
  const body = await json(response)
  expect(response.ok(), `Falha ao consultar ${entityType}: ${body?.error || response.status()}`).toBeTruthy()
  return Array.isArray(body?.rows) ? body.rows : []
}

test.describe('Inscrição controlada de equipe — vaga e limpeza automática', () => {
  test.setTimeout(90_000)
  test('equipe ocupa uma vaga real e a produtora libera o slot no final', async ({ request, browser, baseURL }) => {
    test.skip(
      !fs.existsSync(produtoraAuthFile) || !fs.existsSync(adminAuthFile) || !fs.existsSync(equipeAuthFile),
      'Gere as sessões com npm run test:e2e:auth:prepare',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const adminToken = await activeAuthToken(browser, adminAuthFile, '/admin')
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')
    const equipeId = await getTeamId(request, origin, equipeToken)
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const line = await getOrCreateTeamLine(request, origin, equipeToken, equipeId, unique)
    const lineId = line.id
    const championshipName = `[E2E] Inscrição controlada ${unique}`

    let championshipId = ''
    let phaseId = ''
    let groupId = ''
    let slotId = ''

    try {
      const championship = await createEntity(request, origin, produtoraToken, 'produtora', {
        entity_type: 'championship',
        name: championshipName,
        data: {
          nome: championshipName,
          tipo: 'copa',
          logo_url: `${origin}/favicon.ico`,
          numero_vagas: 4,
          formato: 'Mata-mata',
          plataforma: 'mobile',
          servidor: 'BR',
          recurso_export: false,
          recurso_stream: false,
          recurso_rulebook: false,
          recurso_stats: false,
          recurso_broadcast: false,
        },
      })
      championshipId = String(championship?.id || '')
      expect(championshipId).not.toBe('')

      await approveChampionship(request, origin, adminToken, championshipId)

      const phase = await createEntity(request, origin, produtoraToken, 'produtora', {
        entity_type: 'phase',
        parent_id: championshipId,
        name: `Fase E2E ${unique}`,
        data: { campeonato_id: championshipId, ordem: 1 },
      })
      phaseId = String(phase?.id || '')
      expect(phaseId).not.toBe('')

      const group = await createEntity(request, origin, produtoraToken, 'produtora', {
        entity_type: 'group',
        parent_id: championshipId,
        name: 'Grupo A',
        data: {
          campeonato_id: championshipId,
          fase_id: phaseId,
          slots: 4,
          championship_type: 'copa',
        },
      })
      groupId = String(group?.id || '')
      expect(groupId).not.toBe('')

      const slots = await listChampionshipEntities(
        request,
        origin,
        produtoraToken,
        'group_slot',
        championshipId,
      )
      const firstSlot = slots.find((row: any) => String(row?.data?.group_id || row?.data?.grupo_id || '') === groupId)
      slotId = String(firstSlot?.id || '')
      expect(slotId, 'O grupo deve gerar pelo menos um slot').not.toBe('')
      expect(firstSlot?.data?.status).toBe('livre')

      const participation = await createEntity(request, origin, equipeToken, 'equipe', {
        entity_type: 'championship_team',
        parent_id: championshipId,
        ref_id: equipeId,
        data: {
          campeonato_id: championshipId,
          slot_id: slotId,
          grupo_id: groupId,
          line_id: lineId,
        },
      })
      expect(String(participation?.data?.championship_id || '')).toBe(championshipId)
      expect(String(participation?.data?.team_id || '')).toBe(equipeId)
      expect(String(participation?.data?.slot_id || '')).toBe(slotId)

      const entries = await listChampionshipEntities(
        request,
        origin,
        produtoraToken,
        'championship_team',
        championshipId,
      )
      const createdEntry = entries.find(
        (row: any) =>
          String(row?.data?.team_id || '') === equipeId &&
          String(row?.data?.slot_id || '') === slotId,
      )
      expect(createdEntry, 'A inscrição deve aparecer para a produtora').toBeTruthy()

      const occupiedSlots = await listChampionshipEntities(
        request,
        origin,
        produtoraToken,
        'group_slot',
        championshipId,
      )
      const occupied = occupiedSlots.find((row: any) => String(row?.id || '') === slotId)
      expect(String(occupied?.data?.team_id || occupied?.data?.equipe_id || '')).toBe(equipeId)
      expect(occupied?.data?.status).toBe('ocupado')

      // Liberação real da vaga: remove a participação espelhada e devolve o slot ao estado livre.
      await deleteEntity(request, origin, produtoraToken, 'group_slot', slotId)
      slotId = ''

      const afterCleanup = await listChampionshipEntities(
        request,
        origin,
        produtoraToken,
        'championship_team',
        championshipId,
      )
      expect(
        afterCleanup.some((row: any) => String(row?.data?.team_id || '') === equipeId),
        'A participação deve ser removida após liberar o slot',
      ).toBe(false)
    } finally {
      // Ordem inversa para não deixar estrutura temporária no banco.
      if (slotId) await deleteEntity(request, origin, produtoraToken, 'group_slot', slotId)
      if (groupId) await deleteEntity(request, origin, produtoraToken, 'group', groupId)
      if (phaseId) await deleteEntity(request, origin, produtoraToken, 'phase', phaseId)
      if (championshipId) await deleteEntity(request, origin, produtoraToken, 'championship', championshipId)
      if (line.temporary) await removeTemporaryTeamLine(request, origin, equipeToken, equipeId, lineId)
    }
  })
})
