import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')

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

  throw new Error(`Sessão não encontrada em ${file} para ${expectedOrigin}. Rode npm run test:e2e:auth:prepare.`)
}

function produtoraHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': 'produtora',
    'Content-Type': 'application/json',
  }
}

function adminHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function cleanupChampionship(request: APIRequestContext, origin: string, token: string, id: string) {
  const response = await request.delete(`${origin}/api/dropzone`, {
    headers: produtoraHeaders(token),
    data: { entity_type: 'championship', id },
  })
  const body = await response.json().catch(() => null)
  expect(response.ok(), `Falha ao limpar campeonato E2E: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.success).toBe(true)
}

async function readOwnedChampionship(
  request: APIRequestContext,
  origin: string,
  token: string,
  id: string,
) {
  const response = await request.get(
    `${origin}/api/dropzone?entity_type=championship&championship_id=${encodeURIComponent(id)}`,
    { headers: produtoraHeaders(token) },
  )
  const body = await response.json().catch(() => null)
  expect(response.ok(), `Falha ao consultar campeonato: ${body?.error || response.status()}`).toBeTruthy()
  const rows = Array.isArray(body?.rows) ? body.rows : Array.isArray(body) ? body : []
  return rows.find((row: { id?: unknown }) => String(row?.id || '') === id)
}

async function assertPublicPage(
  context: BrowserContext,
  origin: string,
  id: string,
  expectedName: string,
) {
  const page = await context.newPage()
  try {
    const response = await page.goto(`${origin}/campeonatos/${encodeURIComponent(id)}`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status() || 200).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(
      /Application error|Internal Server Error|This page couldn.t load|A server error occurred/i,
    )
    await expect(page.locator('body')).toContainText(expectedName, { timeout: 20_000 })
  } finally {
    await page.close()
  }
}

test.describe('Operação administrativa controlada — aprovação e publicação', () => {
  test('cria pendente, aprova como admin, publica e arquiva automaticamente', async ({ browser, request, baseURL }) => {
    test.skip(
      !fs.existsSync(produtoraAuthFile) || !fs.existsSync(adminAuthFile),
      'Gere as sessões com npm run test:e2e:auth:prepare',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)
    const adminToken = accessTokenFromStorage(adminAuthFile, origin)
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Aprovação controlada ${unique}`
    let championshipId = ''

    const publicContext = await browser.newContext()
    try {
      const createResponse = await request.post(`${origin}/api/dropzone`, {
        headers: produtoraHeaders(produtoraToken),
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
      expect(createBody?.row?.data?.aprovacao_status).toBe('pendente')

      const pending = await readOwnedChampionship(request, origin, produtoraToken, championshipId)
      expect(pending, 'O campeonato pendente deve aparecer para a proprietária').toBeTruthy()
      expect(pending?.data?.aprovacao_status).toBe('pendente')

      const approvalResponse = await request.patch(`${origin}/api/admin/aprovacoes`, {
        headers: adminHeaders(adminToken),
        data: {
          alvo: 'campeonato',
          id: championshipId,
          status: 'aprovado',
          motivo: 'Aprovação automática de teste E2E',
          cobranca_status: 'cortesia',
          cobranca_obs: 'Registro temporário criado e removido automaticamente pelo E2E.',
        },
      })
      const approvalBody = await approvalResponse.json().catch(() => null)
      expect(
        approvalResponse.ok(),
        `Falha na aprovação administrativa: ${approvalBody?.error || approvalResponse.status()}`,
      ).toBeTruthy()
      expect(approvalBody?.ok).toBe(true)
      expect(approvalBody?.item?.id).toBe(championshipId)
      expect(approvalBody?.item?.aprovacao_status).toBe('aprovado')

      const approved = await readOwnedChampionship(request, origin, produtoraToken, championshipId)
      expect(approved?.data?.aprovacao_status).toBe('aprovado')

      await assertPublicPage(publicContext, origin, championshipId, championshipName)
    } finally {
      if (championshipId) await cleanupChampionship(request, origin, produtoraToken, championshipId)
      await publicContext.close()
    }
  })
})
