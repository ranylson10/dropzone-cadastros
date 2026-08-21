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
  data: Record<string, unknown>,
) {
  const response = await request.post(`${origin}/api/dropzone`, {
    headers: headers(token, 'produtora'),
    data,
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao criar ${String(data.entity_type)}: ${body?.error || response.status()}`).toBeTruthy()
  return body?.row
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
      motivo: 'Aprovação automática para teste de estrutura, jogo e quedas.',
      cobranca_status: 'cortesia',
      cobranca_obs: 'Registro temporário removido automaticamente pelo E2E.',
    },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao aprovar campeonato: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.item?.aprovacao_status).toBe('aprovado')
}

async function activeMapCodes(request: APIRequestContext, origin: string) {
  const response = await request.get(`${origin}/api/mapas`)
  const body = await json(response)
  expect(response.ok(), `Falha ao consultar mapas: ${body?.error || response.status()}`).toBeTruthy()
  const maps = Array.isArray(body?.mapas) ? body.mapas : []
  const codes = maps
    .filter((map: any) => map?.ativo !== false && map?.codigo)
    .map((map: any) => String(map.codigo))
  expect(codes.length, 'O catálogo deve possuir ao menos um mapa ativo.').toBeGreaterThanOrEqual(1)
  return codes
}

async function deleteGame(
  request: APIRequestContext,
  origin: string,
  token: string,
  championshipId: string,
  gameId: string,
) {
  const response = await request.delete(
    `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos/${encodeURIComponent(gameId)}?force=1`,
    { headers: headers(token, 'produtora') },
  )
  const body = await json(response)
  expect(response.ok(), `Falha ao excluir jogo temporário: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.ok).toBe(true)
}

test.describe('Estrutura controlada — jogo e quedas com limpeza automática', () => {
  test.setTimeout(120_000)

  test('produtora cria fase, grupo, jogo, valida quedas, altera mapa e limpa tudo', async ({ request, browser, baseURL }) => {
    test.skip(
      !fs.existsSync(produtoraAuthFile) || !fs.existsSync(adminAuthFile),
      'As sessões são criadas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const adminToken = await activeAuthToken(browser, adminAuthFile, '/admin')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Estrutura e quedas ${unique}`
    const maps = await activeMapCodes(request, origin)
    const firstMap = maps[0]
    const secondMap = maps[1] || maps[0]

    let championshipId = ''
    let phaseId = ''
    let groupId = ''
    let gameId = ''

    try {
      const championship = await createEntity(request, origin, produtoraToken, {
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

      const phase = await createEntity(request, origin, produtoraToken, {
        entity_type: 'phase',
        parent_id: championshipId,
        name: `Fase E2E ${unique}`,
        data: { campeonato_id: championshipId, ordem: 1 },
      })
      phaseId = String(phase?.id || '')
      expect(phaseId).not.toBe('')

      const group = await createEntity(request, origin, produtoraToken, {
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

      const createGameResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            fase_id: phaseId,
            nome: `Jogo E2E ${unique}`,
            numero_partidas: 2,
            quedas: [
              { numero: 1, mapa_codigo: firstMap },
              { numero: 2, mapa_codigo: secondMap },
            ],
            grupos_ids: [groupId],
            intervalo_quedas_minutos: 20,
            tipo_pontuacao: 'normal',
            papel_na_fase: 'normal',
            permite_troca_jogadores: true,
            minimo_quedas_jogadas_jogador: 0,
            status: 'ativo',
          },
        },
      )
      const createGameBody = await json(createGameResponse)
      expect(
        createGameResponse.ok(),
        `Falha ao criar jogo controlado: ${createGameBody?.error || createGameResponse.status()}`,
      ).toBeTruthy()
      gameId = String(createGameBody?.jogo?.id || '')
      expect(gameId, 'A API deve retornar o ID do jogo criado.').not.toBe('')
      expect(createGameBody?.jogo?.quedas).toHaveLength(2)
      expect(createGameBody?.jogo?.grupos).toHaveLength(1)

      const listResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos?fase_id=${encodeURIComponent(phaseId)}`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const listBody = await json(listResponse)
      expect(listResponse.ok(), `Falha ao listar jogos: ${listBody?.error || listResponse.status()}`).toBeTruthy()
      const listedGame = (Array.isArray(listBody?.jogos) ? listBody.jogos : []).find(
        (game: any) => String(game?.id || '') === gameId,
      )
      expect(listedGame, 'O jogo deve aparecer na listagem da fase.').toBeTruthy()
      expect(listedGame?.quedas).toHaveLength(2)

      const fallsResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos/${encodeURIComponent(gameId)}/quedas`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const fallsBody = await json(fallsResponse)
      expect(fallsResponse.ok(), `Falha ao listar quedas: ${fallsBody?.error || fallsResponse.status()}`).toBeTruthy()
      const falls = Array.isArray(fallsBody?.quedas) ? fallsBody.quedas : []
      expect(falls).toHaveLength(2)
      expect(falls.map((fall: any) => Number(fall?.numero_partida))).toEqual([1, 2])

      const firstFallId = String(falls[0]?.id || '')
      expect(firstFallId, 'A primeira queda deve possuir ID.').not.toBe('')

      const updateMapResponse = await request.patch(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos/${encodeURIComponent(gameId)}/quedas/${encodeURIComponent(firstFallId)}/mapa`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: { mapa_codigo: secondMap },
        },
      )
      const updateMapBody = await json(updateMapResponse)
      expect(
        updateMapResponse.ok(),
        `Falha ao atualizar mapa da queda: ${updateMapBody?.error || updateMapResponse.status()}`,
      ).toBeTruthy()
      expect(String(updateMapBody?.queda?.mapa_codigo || '').toLowerCase()).toBe(secondMap.toLowerCase())

      const deletedGameId = gameId
      await deleteGame(request, origin, produtoraToken, championshipId, gameId)
      gameId = ''

      const afterDeleteResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos?fase_id=${encodeURIComponent(phaseId)}`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const afterDeleteBody = await json(afterDeleteResponse)
      expect(afterDeleteResponse.ok()).toBeTruthy()
      expect(
        (Array.isArray(afterDeleteBody?.jogos) ? afterDeleteBody.jogos : []).some(
          (game: any) => String(game?.id || '') === deletedGameId,
        ),
      ).toBe(false)
    } finally {
      if (gameId) await deleteGame(request, origin, produtoraToken, championshipId, gameId)
      if (groupId) await deleteEntity(request, origin, produtoraToken, 'group', groupId)
      if (phaseId) await deleteEntity(request, origin, produtoraToken, 'phase', phaseId)
      if (championshipId) await deleteEntity(request, origin, produtoraToken, 'championship', championshipId)
    }
  })
})
