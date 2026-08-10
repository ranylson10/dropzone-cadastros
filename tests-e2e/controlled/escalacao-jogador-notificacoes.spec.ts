import { expect, test, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { acquireFileLock, releaseFileLock } from '../support/file-lock'

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')
const jogadorAuthFile = path.resolve('tests-e2e/.auth/jogador.json')
const lockFile = path.resolve('tests-e2e/.auth/escalacao-jogador-notificacoes.lock')

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
      // Ignora entradas que não sejam uma sessão Supabase.
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

function authUserIdFromToken(token: string): string {
  const payload = token.split('.')[1] || ''
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const body = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { sub?: unknown }
  const id = typeof body?.sub === 'string' ? body.sub : ''
  expect(id, 'A sessão do jogador deve possuir sub (auth user id).').not.toBe('')
  return id
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

async function accountId(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: 'equipe' | 'jogador',
) {
  const response = await request.get(`${origin}/api/me`, { headers: headers(token, profileType) })
  const body = await json(response)
  expect(response.ok(), `Falha ao identificar ${profileType}: ${body?.error || response.status()}`).toBeTruthy()
  const id = String(body?.account?.id || '')
  expect(id, `A sessão de ${profileType} deve retornar account.id.`).not.toBe('')
  return id
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
  if (!id) return
  const response = await request.delete(`${origin}/api/dropzone`, {
    headers: headers(token, 'produtora'),
    data: { entity_type: entityType, id },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao limpar ${entityType}: ${body?.error || response.status()}`).toBeTruthy()
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
      motivo: 'Aprovação automática para E2E de escalação do jogador.',
      cobranca_status: 'cortesia',
      cobranca_obs: 'Registro temporário removido ao final do teste.',
    },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao aprovar campeonato: ${body?.error || response.status()}`).toBeTruthy()
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

async function ensurePlayerOnTeam(
  request: APIRequestContext,
  origin: string,
  equipeToken: string,
  jogadorToken: string,
  equipeId: string,
  jogadorId: string,
) {
  const rosterResponse = await request.get(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(equipeToken, 'equipe'),
  })
  const rosterBody = await json(rosterResponse)
  expect(rosterResponse.ok(), `Falha ao consultar elenco E2E: ${rosterBody?.error || rosterResponse.status()}`).toBeTruthy()
  const existingPlayer = (Array.isArray(rosterBody?.lines) ? rosterBody.lines : [])
    .flatMap((line: any) => Array.isArray(line?.jogadores) ? line.jogadores : [])
    .find((player: any) => String(player?.jogador_id || '') === jogadorId)
  if (existingPlayer) return

  const acceptNotification = async (notificationId: string) => {
    const acceptResponse = await request.post(
      `${origin}/api/notificacoes/${encodeURIComponent(notificationId)}/aceitar`,
      { headers: headers(jogadorToken, 'jogador'), data: {} },
    )
    const acceptBody = await json(acceptResponse)
    expect(acceptResponse.ok(), `Falha ao vincular jogador à equipe E2E: ${acceptBody?.error || acceptResponse.status()}`).toBeTruthy()
    await archiveNotification(request, origin, jogadorToken, 'jogador', notificationId)
  }

  const inviteResponse = await request.post(`${origin}/api/equipes/relacionamentos`, {
    headers: headers(equipeToken, 'equipe'),
    data: { action: 'invite_player', equipe_id: equipeId, jogador_id: jogadorId },
  })
  const inviteBody = await json(inviteResponse)

  if (inviteResponse.ok()) {
    const notificationId = String(inviteBody?.notification?.id || '')
    expect(notificationId, 'O convite de elenco deve criar notificação para o jogador.').not.toBe('')
    await acceptNotification(notificationId)
    return
  }

  const errorMessage = String(inviteBody?.error || '')
  if (/já faz parte da equipe/i.test(errorMessage)) return

  if (/solicitação pendente/i.test(errorMessage)) {
    const pendingResponse = await request.get(`${origin}/api/notificacoes?limit=100`, {
      headers: headers(jogadorToken, 'jogador'),
    })
    const pendingBody = await json(pendingResponse)
    expect(pendingResponse.ok(), `Falha ao localizar convite pendente: ${pendingBody?.error || pendingResponse.status()}`).toBeTruthy()
    const pending = (Array.isArray(pendingBody?.items) ? pendingBody.items : []).find((item: any) =>
      item?.tipo === 'convite_jogador_equipe_direto'
      && item?.status === 'nao_lida'
      && String(item?.payload?.equipe_id || '') === equipeId
      && String(item?.payload?.jogador_id || '') === jogadorId,
    )
    expect(pending?.id, 'Deve existir a notificação pendente informada pela API.').toBeTruthy()
    await acceptNotification(String(pending.id))
    return
  }

  throw new Error(`Falha inesperada ao preparar vínculo jogador/equipe: ${errorMessage || inviteResponse.status()}`)
}

async function createLine(
  request: APIRequestContext,
  origin: string,
  equipeToken: string,
  equipeId: string,
  unique: string,
) {
  const response = await request.post(`${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines`, {
    headers: headers(equipeToken, 'equipe'),
    data: { nome: `[E2E] Escalação ${unique}` },
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao criar line E2E: ${body?.error || response.status()}`).toBeTruthy()
  const lineId = String(body?.line?.id || '')
  expect(lineId).not.toBe('')
  return lineId
}

async function removeLine(
  request: APIRequestContext,
  origin: string,
  equipeToken: string,
  equipeId: string,
  lineId: string,
) {
  if (!lineId) return
  const response = await request.delete(
    `${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines?line_id=${encodeURIComponent(lineId)}`,
    { headers: headers(equipeToken, 'equipe') },
  )
  const body = await json(response)
  expect(response.ok(), `Falha ao remover line E2E: ${body?.error || response.status()}`).toBeTruthy()
}

async function addPlayerToLine(
  request: APIRequestContext,
  origin: string,
  equipeToken: string,
  equipeId: string,
  lineId: string,
  jogadorAuthUserId: string,
) {
  const detailResponse = await request.get(
    `${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines/${encodeURIComponent(lineId)}`,
    { headers: headers(equipeToken, 'equipe') },
  )
  const detailBody = await json(detailResponse)
  expect(detailResponse.ok(), `Falha ao carregar roster da line: ${detailBody?.error || detailResponse.status()}`).toBeTruthy()
  const rosterPlayer = (Array.isArray(detailBody?.roster) ? detailBody.roster : [])
    .find((item: any) => String(item?.jogador_auth_user_id || '') === jogadorAuthUserId)
  expect(rosterPlayer, 'O jogador E2E deve estar no elenco geral da equipe.').toBeTruthy()

  const rosterId = String(rosterPlayer?.id || '')
  const addResponse = await request.post(
    `${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines/${encodeURIComponent(lineId)}`,
    {
      headers: headers(equipeToken, 'equipe'),
      data: { action: 'add_member', equipe_jogador_id: rosterId },
    },
  )
  const addBody = await json(addResponse)
  expect(addResponse.ok(), `Falha ao adicionar jogador à line: ${addBody?.error || addResponse.status()}`).toBeTruthy()
  return rosterId
}

async function removePlayerFromLine(
  request: APIRequestContext,
  origin: string,
  equipeToken: string,
  equipeId: string,
  lineId: string,
  rosterId: string,
) {
  if (!lineId || !rosterId) return
  const response = await request.post(
    `${origin}/api/equipes/${encodeURIComponent(equipeId)}/lines/${encodeURIComponent(lineId)}`,
    {
      headers: headers(equipeToken, 'equipe'),
      data: { action: 'remove_member', equipe_jogador_id: rosterId },
    },
  )
  const body = await json(response)
  expect(response.ok(), `Falha ao remover jogador da line E2E: ${body?.error || response.status()}`).toBeTruthy()
}

async function findNotification(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: string,
  predicate: (item: any) => boolean,
) {
  const response = await request.get(`${origin}/api/notificacoes?limit=50`, {
    headers: headers(token, profileType),
  })
  const body = await json(response)
  expect(response.ok(), `Falha ao consultar notificações: ${body?.error || response.status()}`).toBeTruthy()
  return (Array.isArray(body?.items) ? body.items : []).find(predicate) || null
}

test.describe('Escalação do jogador por notificação — fluxo controlado', () => {
  test.setTimeout(180_000)

  test('gera convite para a line, jogador confirma, depois recebe outro e recusa', async ({ request, baseURL }) => {
    test.skip(test.info().project.name !== 'chromium-desktop', 'Fluxo controlado por API executado apenas uma vez.')
    test.skip(
      !fs.existsSync(produtoraAuthFile)
        || !fs.existsSync(adminAuthFile)
        || !fs.existsSync(equipeAuthFile)
        || !fs.existsSync(jogadorAuthFile),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    await acquireFileLock(lockFile, 'escalação do jogador por notificação')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)
    const adminToken = accessTokenFromStorage(adminAuthFile, origin)
    const equipeToken = accessTokenFromStorage(equipeAuthFile, origin)
    const jogadorToken = accessTokenFromStorage(jogadorAuthFile, origin)
    const jogadorAuthUserId = authUserIdFromToken(jogadorToken)
    const equipeId = await accountId(request, origin, equipeToken, 'equipe')
    const jogadorId = await accountId(request, origin, jogadorToken, 'jogador')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let lineId = ''
    let rosterId = ''
    let championshipId = ''
    let phaseId = ''
    let groupId = ''
    let slotId = ''
    let participationId = ''
    let acceptedPlayerId = ''
    let firstLinkId = ''
    let secondLinkId = ''
    let acceptNotificationId = ''
    let rejectNotificationId = ''
    let acceptResponseNotificationId = ''
    let rejectResponseNotificationId = ''

    try {
      await ensurePlayerOnTeam(request, origin, equipeToken, jogadorToken, equipeId, jogadorId)
      lineId = await createLine(request, origin, equipeToken, equipeId, unique)
      rosterId = await addPlayerToLine(request, origin, equipeToken, equipeId, lineId, jogadorAuthUserId)

      const championshipName = `[E2E] Escalação por notificação ${unique}`
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
          line_id: lineId,
        },
      })
      participationId = String(participation?.id || participation?.data?.id || '')
      expect(participationId).not.toBe('')

      const firstLinkResponse = await request.post(`${origin}/api/equipe/escalacoes`, {
        headers: headers(equipeToken, 'equipe'),
        data: {
          campeonato_equipe_id: participationId,
          titulo: `Escalação E2E aceitar ${unique}`,
          limite_jogadores: 6,
        },
      })
      const firstLinkBody = await json(firstLinkResponse)
      expect(firstLinkResponse.ok(), `Falha ao gerar escalação: ${firstLinkBody?.error || firstLinkResponse.status()}`).toBeTruthy()
      firstLinkId = String(firstLinkBody?.link?.id || '')
      expect(firstLinkId).not.toBe('')
      expect(Number(firstLinkBody?.notificacoes_enviadas || 0)).toBeGreaterThan(0)

      const acceptNotification = await findNotification(
        request,
        origin,
        jogadorToken,
        'jogador',
        (item) => item?.tipo === 'convite_escalacao_jogador'
          && String(item?.payload?.link_id || '') === firstLinkId
          && item?.status === 'nao_lida',
      )
      expect(acceptNotification, 'O jogador da line deve receber a escalação no correio.').toBeTruthy()
      acceptNotificationId = String(acceptNotification?.id || '')

      const acceptResponse = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(acceptNotificationId)}/aceitar`,
        { headers: headers(jogadorToken, 'jogador'), data: {} },
      )
      const acceptBody = await json(acceptResponse)
      expect(acceptResponse.ok(), `Falha ao confirmar escalação: ${acceptBody?.error || acceptResponse.status()}`).toBeTruthy()
      expect(acceptBody?.ok).toBe(true)
      acceptedPlayerId = String(acceptBody?.inscricao?.id || '')
      expect(acceptedPlayerId, 'A confirmação deve criar/retornar campeonato_jogador.').not.toBe('')

      const playersResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/jogadores`,
      )
      const playersBody = await json(playersResponse)
      expect(playersResponse.ok(), `Falha ao conferir formação: ${playersBody?.error || playersResponse.status()}`).toBeTruthy()
      const participationView = (Array.isArray(playersBody?.participacoes) ? playersBody.participacoes : [])
        .find((item: any) => String(item?.id || '') === participationId)
      expect(
        (participationView?.jogadores || []).some((item: any) => String(item?.id || '') === acceptedPlayerId),
        'Jogador confirmado deve aparecer na formação do campeonato.',
      ).toBe(true)

      const acceptSenderResponse = await findNotification(
        request,
        origin,
        equipeToken,
        'equipe',
        (item) => item?.tipo === 'escalacao_jogador_resposta'
          && String(item?.payload?.link_id || '') === firstLinkId
          && item?.payload?.resposta === 'aceito',
      )
      expect(acceptSenderResponse, 'Quem gerou a escalação deve receber a confirmação do jogador.').toBeTruthy()
      acceptResponseNotificationId = String(acceptSenderResponse?.id || '')

      const secondLinkResponse = await request.post(`${origin}/api/equipe/escalacoes`, {
        headers: headers(equipeToken, 'equipe'),
        data: {
          campeonato_equipe_id: participationId,
          titulo: `Escalação E2E recusar ${unique}`,
          limite_jogadores: 6,
        },
      })
      const secondLinkBody = await json(secondLinkResponse)
      expect(secondLinkResponse.ok(), `Falha ao regenerar escalação: ${secondLinkBody?.error || secondLinkResponse.status()}`).toBeTruthy()
      secondLinkId = String(secondLinkBody?.link?.id || '')
      expect(secondLinkId).not.toBe('')
      expect(secondLinkId).not.toBe(firstLinkId)

      const rejectNotification = await findNotification(
        request,
        origin,
        jogadorToken,
        'jogador',
        (item) => item?.tipo === 'convite_escalacao_jogador'
          && String(item?.payload?.link_id || '') === secondLinkId
          && item?.status === 'nao_lida',
      )
      expect(rejectNotification, 'O novo token deve gerar uma nova pendência para o jogador.').toBeTruthy()
      rejectNotificationId = String(rejectNotification?.id || '')

      const rejectResponse = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(rejectNotificationId)}/recusar`,
        { headers: headers(jogadorToken, 'jogador'), data: {} },
      )
      const rejectBody = await json(rejectResponse)
      expect(rejectResponse.ok(), `Falha ao recusar escalação: ${rejectBody?.error || rejectResponse.status()}`).toBeTruthy()
      expect(rejectBody?.ok).toBe(true)

      const rejectSenderResponse = await findNotification(
        request,
        origin,
        equipeToken,
        'equipe',
        (item) => item?.tipo === 'escalacao_jogador_resposta'
          && String(item?.payload?.link_id || '') === secondLinkId
          && item?.payload?.resposta === 'recusado',
      )
      expect(rejectSenderResponse, 'Quem gerou a escalação deve receber a recusa do jogador.').toBeTruthy()
      rejectResponseNotificationId = String(rejectSenderResponse?.id || '')
    } finally {
      if (acceptedPlayerId) {
        const removePlayerResponse = await request.patch(`${origin}/api/equipe/escalacoes`, {
          headers: headers(equipeToken, 'equipe'),
          data: { jogador_inscricao_id: acceptedPlayerId },
        })
        const removePlayerBody = await json(removePlayerResponse)
        expect(removePlayerResponse.ok(), `Falha ao remover confirmação E2E: ${removePlayerBody?.error || removePlayerResponse.status()}`).toBeTruthy()
      }

      if (secondLinkId) {
        await request.delete(`${origin}/api/equipe/escalacoes?link_id=${encodeURIComponent(secondLinkId)}`, {
          headers: headers(equipeToken, 'equipe'),
        }).catch(() => null)
      }
      if (firstLinkId) {
        await request.delete(`${origin}/api/equipe/escalacoes?link_id=${encodeURIComponent(firstLinkId)}`, {
          headers: headers(equipeToken, 'equipe'),
        }).catch(() => null)
      }

      await archiveNotification(request, origin, jogadorToken, 'jogador', acceptNotificationId)
      await archiveNotification(request, origin, jogadorToken, 'jogador', rejectNotificationId)
      await archiveNotification(request, origin, equipeToken, 'equipe', acceptResponseNotificationId)
      await archiveNotification(request, origin, equipeToken, 'equipe', rejectResponseNotificationId)

      if (rosterId && lineId) {
        await removePlayerFromLine(request, origin, equipeToken, equipeId, lineId, rosterId).catch(() => null)
      }
      if (slotId) await deleteEntity(request, origin, produtoraToken, 'group_slot', slotId)
      if (groupId) await deleteEntity(request, origin, produtoraToken, 'group', groupId)
      if (phaseId) await deleteEntity(request, origin, produtoraToken, 'phase', phaseId)
      if (championshipId) await deleteEntity(request, origin, produtoraToken, 'championship', championshipId)
      if (lineId) await removeLine(request, origin, equipeToken, equipeId, lineId).catch(() => null)
      await releaseFileLock(lockFile)
    }
  })
})
