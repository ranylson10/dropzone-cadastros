import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

const authFile = path.resolve('tests-e2e/.auth/produtora.json')
function accessTokenFromStorage(file: string, expectedOrigin: string): string {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  const origin = state.origins?.find((item) => item.origin === expectedOrigin)
  for (const entry of origin?.localStorage || []) {
    if (!entry.name?.includes('auth-token') || !entry.value) continue
    try {
      const parsed = JSON.parse(entry.value) as {
        access_token?: unknown
        currentSession?: { access_token?: unknown }
      }
      const token = parsed.access_token || parsed.currentSession?.access_token
      if (typeof token === 'string' && token.length > 20) return token
    } catch {
      // Ignora entradas que não sejam a sessão do Supabase.
    }
  }
  throw new Error(`Sessão da produtora não encontrada para ${expectedOrigin}. Rode npm run test:e2e:auth:prepare.`)
}
function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': 'produtora',
    'Content-Type': 'application/json',
  }
}
async function cleanupChampionship(request: APIRequestContext, origin: string, token: string, id: string) {
  const response = await request.delete(`${origin}/api/dropzone`, {
    headers: authHeaders(token),
    data: { entity_type: 'championship', id },
  })
  const body = await response.json().catch(() => null)
  expect(response.ok(), `Falha ao limpar campeonato E2E: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.success).toBe(true)
}
async function verifyCreatedChampionship(
  request: APIRequestContext,
  origin: string,
  token: string,
  id: string,
  expectedName: string,
) {
  const listResponse = await request.get(
    `${origin}/api/dropzone?entity_type=championship&championship_id=${encodeURIComponent(id)}`,
    { headers: authHeaders(token) },
  )
  const listBody = await listResponse.json().catch(() => null)
  expect(listResponse.ok(), `Falha ao consultar campeonato criado: ${listBody?.error || listResponse.status()}`).toBeTruthy()
  const rows = Array.isArray(listBody?.rows) ? listBody.rows : Array.isArray(listBody) ? listBody : []
  const created = rows.find((row: { id?: unknown }) => String(row?.id || '') === id)
  expect(created, 'O campeonato criado deve aparecer na listagem autenticada da produtora').toBeTruthy()
  expect(created?.name || created?.data?.nome).toBe(expectedName)
}
test.describe('Operações reais controladas — criação e limpeza automática', () => {
  test('produtora cria, consulta e arquiva um campeonato temporário', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(authFile), 'Gere as sessões com npm run test:e2e:auth:prepare')
    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const token = accessTokenFromStorage(authFile, origin)
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Campeonato controlado ${unique}`
    let championshipId = ''
    try {
      const createResponse = await request.post(`${origin}/api/dropzone`, {
        headers: authHeaders(token),
        data: {
          entity_type: 'championship',
          name: championshipName,
          data: {
            nome: championshipName,
            tipo: 'diario',
            logo_url: `${origin}/favicon.ico`,
            numero_vagas: 12,
            formato: 'Jogo Único',
            plataforma: 'mobile',
            servidor: 'BR',
            recurso_export: false,
            recurso_stream: false,
            recurso_rulebook: false,
            recurso_stats: false,
            recurso_broadcast: false,
          },
        },
      })
      const createBody = await createResponse.json().catch(() => null)
      expect(
        createResponse.ok(),
        `Falha na criação controlada: ${createBody?.error || createResponse.status()}`,
      ).toBeTruthy()
      championshipId = String(createBody?.row?.id || '')
      expect(championshipId, 'A API deve retornar o ID do campeonato criado').not.toBe('')
      expect(createBody?.row?.name || createBody?.row?.data?.nome).toBe(championshipName)

      await verifyCreatedChampionship(request, origin, token, championshipId, championshipName)
    } finally {
      if (championshipId) await cleanupChampionship(request, origin, token, championshipId)
    }
  })
})
