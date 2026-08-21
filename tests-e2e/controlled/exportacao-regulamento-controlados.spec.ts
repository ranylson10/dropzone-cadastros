import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function headers(token: string, profileType: 'produtora' | 'equipe') {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': profileType,
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

async function postWithRetry(
  request: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['post']>[1],
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await request.post(url, { ...options, timeout: 30_000 })
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw lastError
}

async function cleanupChampionship(
  request: APIRequestContext,
  origin: string,
  token: string,
  championshipId: string,
) {
  const response = await request.delete(`${origin}/api/dropzone`, {
    headers: headers(token, 'produtora'),
    data: { entity_type: 'championship', id: championshipId },
    timeout: 30_000,
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao limpar campeonato E2E: ${body?.error || response.status()}`).toBe(true)
}

test.describe('Exportação e regulamento — acesso, overrides e limpeza controlados', () => {
  test.setTimeout(180_000)

  test('produtora exporta, personaliza e cria rascunho enquanto outros perfis são bloqueados', async ({ request, browser, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, equipeAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Exportação e regulamento ${unique}`
    let championshipId = ''

    try {
      const createResponse = await postWithRetry(request, `${origin}/api/dropzone`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          entity_type: 'championship',
          name: championshipName,
          data: {
            nome: championshipName,
            tipo: 'copa',
            logo_url: `${origin}/favicon.ico`,
            numero_vagas: 12,
            formato: 'Mata-mata',
            plataforma: 'mobile',
            servidor: 'BR',
            recurso_export: true,
            recurso_stream: false,
            recurso_rulebook: true,
            recurso_stats: false,
            recurso_broadcast: false,
          },
        },
      })
      const createBody = await json(createResponse)
      expect(createResponse.ok(), `Falha ao criar campeonato: ${createBody?.error || createResponse.status()}`).toBe(true)
      championshipId = String(createBody?.row?.id || '')
      expect(championshipId).not.toBe('')

      const unauthenticatedExport = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/export?format=json`,
        { timeout: 30_000 },
      )
      expect(unauthenticatedExport.ok(), 'Exportação sem login deve ser bloqueada.').toBe(false)

      const exportResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/export?format=json`,
        { headers: headers(produtoraToken, 'produtora'), timeout: 30_000 },
      )
      const exportBody = await json(exportResponse)
      expect(exportResponse.ok(), `Falha na exportação: ${exportBody?.error || exportResponse.status()}`).toBe(true)
      expect(String(exportBody?.campeonato?.id || exportBody?.data?.campeonato?.id || '')).toBe(championshipId)

      const marker = `[E2E] override ${unique}`
      const overridePatch = await request.patch(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/export/overrides`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            merge: true,
            team_color: '#123456',
            equipes: { e2e: { nome: marker } },
          },
          timeout: 30_000,
        },
      )
      const overridePatchBody = await json(overridePatch)
      expect(overridePatch.ok(), `Falha ao salvar override: ${overridePatchBody?.error || overridePatch.status()}`).toBe(true)
      expect(overridePatchBody?.overrides?.team_color).toBe('#123456')
      expect(overridePatchBody?.overrides?.equipes?.e2e?.nome).toBe(marker)

      const overrideRead = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/export/overrides`,
        { headers: headers(produtoraToken, 'produtora'), timeout: 30_000 },
      )
      const overrideReadBody = await json(overrideRead)
      expect(overrideRead.ok()).toBe(true)
      expect(overrideReadBody?.overrides?.team_color).toBe('#123456')
      expect(overrideReadBody?.overrides?.equipes?.e2e?.nome).toBe(marker)

      const forbiddenOverride = await request.patch(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/export/overrides`,
        {
          headers: headers(equipeToken, 'equipe'),
          data: { team_color: '#ffffff' },
          timeout: 30_000,
        },
      )
      expect(forbiddenOverride.ok(), 'Equipe sem vínculo não pode alterar a exportação.').toBe(false)

      const createRulebook = await postWithRetry(
        request,
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {},
        },
      )
      const createRulebookBody = await json(createRulebook)
      expect(createRulebook.ok(), `Falha ao criar regulamento: ${createRulebookBody?.error || createRulebook.status()}`).toBe(true)
      expect(createRulebookBody?.ok).toBe(true)
      expect(String(createRulebookBody?.rulebook?.status || createRulebookBody?.status || '')).toMatch(/rascunho|draft/i)

      const ownerRulebook = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook`,
        { headers: headers(produtoraToken, 'produtora'), timeout: 30_000 },
      )
      const ownerRulebookBody = await json(ownerRulebook)
      expect(ownerRulebook.ok()).toBe(true)
      expect(ownerRulebookBody?.ok).toBe(true)

      const publicDraft = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook?public=1`,
        { timeout: 30_000 },
      )
      expect(publicDraft.status(), 'Rascunho não deve ser exposto publicamente.').toBe(404)

      const forbiddenRulebookEdit = await request.put(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook`,
        {
          headers: headers(equipeToken, 'equipe'),
          data: { respostas: { observacoes_gerais: '[E2E] alteração indevida' } },
          timeout: 30_000,
        },
      )
      expect(forbiddenRulebookEdit.ok(), 'Equipe sem permissão não pode editar o regulamento.').toBe(false)

      // O ambiente publicado ainda não expõe DELETE neste endpoint.
      // Como o campeonato é temporário, o regulamento é removido junto com ele no finally.
      const finalRulebook = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook`,
        { headers: headers(produtoraToken, 'produtora'), timeout: 30_000 },
      )
      const finalRulebookBody = await json(finalRulebook)
      expect(finalRulebook.ok(), `Falha ao reler regulamento: ${finalRulebookBody?.error || finalRulebook.status()}`).toBe(true)
      expect(finalRulebookBody?.ok).toBe(true)
    } finally {
      if (championshipId) await cleanupChampionship(request, origin, produtoraToken, championshipId)
    }
  })
})
