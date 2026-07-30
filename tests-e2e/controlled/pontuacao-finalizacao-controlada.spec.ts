import { test, expect, type APIRequestContext } from '@playwright/test'
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
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')

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
      // Ignora entradas locais que não sejam uma sessão Supabase.
    }
  }
  throw new Error(`Sessão não encontrada em ${file} para ${expectedOrigin}. Rode npm run testar:tudo.`)
}

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
  const response = await request.post(`${origin}/api/dropzone`, {
    headers: headers(token, profileType),
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

async function getTeamId(request: APIRequestContext, origin: string, token: string) {
  const response = await request.get(`${origin}/api/me`, { headers: headers(token, 'equipe') })
  const body = await json(response)
  expect(response.ok(), `Falha ao identificar equipe E2E: ${body?.error || response.status()}`).toBeTruthy()
  const id = String(body?.account?.id || '')
  expect(id, 'A sessão de equipe deve retornar o ID do perfil.').not.toBe('')
  return id
}

async function getOrCreateTeamLine(
  request: APIRequestContext,
  origin: string,
  token: string,
  equipeId: string,
  unique: string,
) {
  const listResponse = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(token, 'equipe'),
  })
  const listBody = await json(listResponse)
  expect(listResponse.ok(), `Falha ao consultar lines: ${listBody?.error || listResponse.status()}`).toBeTruthy()
  const lines = Array.isArray(listBody?.lines) ? listBody.lines : []
  const active = lines.find((line: any) => String(line?.status || 'ativo').toLowerCase() !== 'inativo')
  if (active?.id) return { id: String(active.id), temporary: false }

  const createResponse = await request.post(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(token, 'equipe'),
    data: { nome: `[E2E] Line pontuação ${unique}` },
  })
  const createBody = await json(createResponse)
  expect(createResponse.ok(), `Falha ao criar line E2E: ${createBody?.error || createResponse.status()}`).toBeTruthy()
  const id = String(createBody?.line?.id || '')
  expect(id).not.toBe('')
  return { id, temporary: true }
}

async function removeTemporaryLine(
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
  expect(response.ok(), `Falha ao remover line E2E: ${body?.error || response.status()}`).toBeTruthy()
}

async function approveChampionship(
  request: APIRequestContext,
  origin: string,
  token: string,
  championshipId: string,
) {
  const response = await request.patch(`${origin}/api/admin/aprovacoes`, {
    headers: headers(token),
    data: {
      alvo: 'campeonato',
      id: championshipId,
      status: 'aprovado',
      motivo: 'Aprovação automática para teste de pontuação.',
      cobranca_status: 'cortesia',
      cobranca_obs: 'Registro temporário removido automaticamente pelo E2E.',
    },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao aprovar campeonato: ${body?.error || response.status()}`).toBeTruthy()
  expect(body?.item?.aprovacao_status).toBe('aprovado')
}

async function listEntities(
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
  expect(response.ok(), `Falha ao listar ${entityType}: ${body?.error || response.status()}`).toBeTruthy()
  return Array.isArray(body?.rows) ? body.rows : []
}

async function activeMapCode(request: APIRequestContext, origin: string) {
  const response = await request.get(`${origin}/api/mapas`)
  const body = await json(response)
  expect(response.ok(), `Falha ao consultar mapas: ${body?.error || response.status()}`).toBeTruthy()
  const map = (Array.isArray(body?.mapas) ? body.mapas : []).find((item: any) => item?.ativo !== false && item?.codigo)
  const code = String(map?.codigo || '')
  expect(code, 'É necessário ao menos um mapa ativo.').not.toBe('')
  return code
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
  expect(response.ok(), `Falha ao excluir jogo E2E: ${body?.error || response.status()}`).toBeTruthy()
}

test.describe('Pontuação controlada — resultado, tabela, finalização e reabertura', () => {
  test.setTimeout(150_000)

  test('produtora lança resultado real, valida classificação, finaliza e reabre a queda', async ({ request, baseURL }) => {
    test.skip(
      !fs.existsSync(produtoraAuthFile) || !fs.existsSync(adminAuthFile) || !fs.existsSync(equipeAuthFile),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)
    const adminToken = accessTokenFromStorage(adminAuthFile, origin)
    const equipeToken = accessTokenFromStorage(equipeAuthFile, origin)
    const equipeId = await getTeamId(request, origin, equipeToken)
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const line = await getOrCreateTeamLine(request, origin, equipeToken, equipeId, unique)
    const mapaCodigo = await activeMapCode(request, origin)

    let championshipId = ''
    let phaseId = ''
    let groupId = ''
    let slotId = ''
    let gameId = ''

    try {
      const championshipName = `[E2E] Pontuação controlada ${unique}`
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
          recurso_stats: true,
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

      const slots = await listEntities(request, origin, produtoraToken, 'group_slot', championshipId)
      const firstSlot = slots.find((row: any) => String(row?.data?.group_id || row?.data?.grupo_id || '') === groupId)
      slotId = String(firstSlot?.id || '')
      expect(slotId).not.toBe('')

      const participation = await createEntity(request, origin, equipeToken, 'equipe', {
        entity_type: 'championship_team',
        parent_id: championshipId,
        ref_id: equipeId,
        data: {
          campeonato_id: championshipId,
          slot_id: slotId,
          grupo_id: groupId,
          line_id: line.id,
        },
      })
      const championshipTeamId = String(participation?.id || participation?.data?.id || '')
      expect(championshipTeamId, 'A inscrição deve retornar o ID de campeonato_equipe.').not.toBe('')

      const gameResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogos`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            fase_id: phaseId,
            nome: `Jogo E2E ${unique}`,
            numero_partidas: 1,
            quedas: [{ numero: 1, mapa_codigo: mapaCodigo }],
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
      const gameBody = await json(gameResponse)
      expect(gameResponse.ok(), `Falha ao criar jogo: ${gameBody?.error || gameResponse.status()}`).toBeTruthy()
      gameId = String(gameBody?.jogo?.id || '')
      const fallId = String(gameBody?.jogo?.quedas?.[0]?.id || '')
      expect(gameId).not.toBe('')
      expect(fallId).not.toBe('')

      const scoreResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/sumula/manual`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            partida_id: fallId,
            origem: 'manual',
            equipes: [
              {
                campeonato_equipe_id: championshipTeamId,
                posicao: 1,
                abates: 7,
                punicao_pontos: 0,
                jogadores: [],
              },
            ],
          },
        },
      )
      const scoreBody = await json(scoreResponse)
      expect(scoreResponse.ok(), `Falha ao salvar súmula: ${scoreBody?.error || scoreResponse.status()}`).toBeTruthy()
      expect(scoreBody?.ok).toBe(true)

      const statsResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/estatisticas/equipes?partida_id=${encodeURIComponent(fallId)}`,
      )
      const statsBody = await json(statsResponse)
      expect(statsResponse.ok(), `Falha ao consultar classificação: ${statsBody?.error || statsResponse.status()}`).toBeTruthy()
      const ranked = Array.isArray(statsBody?.equipes) ? statsBody.equipes : []
      expect(ranked).toHaveLength(1)
      expect(String(ranked[0]?.campeonato_equipe_id || '')).toBe(championshipTeamId)
      expect(Number(ranked[0]?.abates || 0)).toBe(7)
      expect(Number(ranked[0]?.booyahs || 0)).toBe(1)
      expect(Number(ranked[0]?.colocacao || 0)).toBe(1)

      const scorerResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/pontuador/${encodeURIComponent(gameId)}`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const scorerBody = await json(scorerResponse)
      expect(scorerResponse.ok(), `Falha ao carregar pontuador: ${scorerBody?.error || scorerResponse.status()}`).toBeTruthy()
      expect(Array.isArray(scorerBody?.classificacao_jogo)).toBe(true)
      expect(scorerBody.classificacao_jogo.some((item: any) => String(item?.campeonato_equipe_id || '') === championshipTeamId)).toBe(true)

      const finishResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/quedas/${encodeURIComponent(fallId)}/finalizar`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const finishBody = await json(finishResponse)
      expect(finishResponse.ok(), `Falha ao finalizar queda: ${finishBody?.error || finishResponse.status()}`).toBeTruthy()
      expect(finishBody?.queda?.status).toBe('finalizada')

      const blockedEditResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/sumula/manual`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            partida_id: fallId,
            equipes: [{ campeonato_equipe_id: championshipTeamId, posicao: 1, abates: 8, jogadores: [] }],
          },
        },
      )
      const blockedEditBody = await json(blockedEditResponse)
      expect(blockedEditResponse.ok()).toBe(false)
      expect(String(blockedEditBody?.error || '')).toMatch(/finalizada/i)

      const reopenResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/quedas/${encodeURIComponent(fallId)}/reabrir`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const reopenBody = await json(reopenResponse)
      expect(reopenResponse.ok(), `Falha ao reabrir queda: ${reopenBody?.error || reopenResponse.status()}`).toBeTruthy()
      expect(reopenBody?.queda?.status).toBe('em_andamento')
    } finally {
      if (gameId) await deleteGame(request, origin, produtoraToken, championshipId, gameId)
      if (slotId) await deleteEntity(request, origin, produtoraToken, 'group_slot', slotId)
      if (groupId) await deleteEntity(request, origin, produtoraToken, 'group', groupId)
      if (phaseId) await deleteEntity(request, origin, produtoraToken, 'phase', phaseId)
      if (championshipId) await deleteEntity(request, origin, produtoraToken, 'championship', championshipId)
      if (line.temporary) await removeTemporaryLine(request, origin, equipeToken, equipeId, line.id)
    }
  })
})
