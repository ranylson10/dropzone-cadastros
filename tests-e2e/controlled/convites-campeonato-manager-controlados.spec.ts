import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { acquireFileLock, releaseFileLock } from '../support/file-lock'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')
const managerAuthFile = path.resolve('tests-e2e/.auth/manager.json')
const jogadorAuthFile = path.resolve('tests-e2e/.auth/jogador.json')
const lockFile = path.resolve('tests-e2e/.auth/convites-campeonato-manager.lock')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

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
      // Ignora chaves locais que não sejam uma sessão Supabase.
    }
  }
  throw new Error(`Sessão não encontrada em ${file}. Rode npm run testar:tudo.`)
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

async function accountId(
  request: APIRequestContext,
  origin: string,
  token: string,
  profileType: 'manager' | 'jogador',
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

async function removeSeller(
  request: APIRequestContext,
  origin: string,
  produtoraToken: string,
  campeonatoId: string,
  managerId: string,
) {
  if (!campeonatoId || !managerId) return
  await request.delete(`${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/vendedores`, {
    headers: headers(produtoraToken, 'produtora'),
    data: { manager_id: managerId },
  }).catch(() => null)
}

async function archiveChampionship(
  request: APIRequestContext,
  origin: string,
  produtoraToken: string,
  campeonatoId: string,
) {
  if (!campeonatoId) return
  await request.delete(`${origin}/api/dropzone`, {
    headers: headers(produtoraToken, 'produtora'),
    data: { entity_type: 'championship', id: campeonatoId },
  }).catch(() => null)
}

test.describe('Convites controlados — manager por campeonato', () => {
  test.setTimeout(480_000)

  test('convite, acesso limitado, remoção e pedido do manager funcionam de ponta a ponta', async ({ request, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, adminAuthFile, managerAuthFile, jogadorAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    await acquireFileLock(lockFile, 'convite de campeonato')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)
    const adminToken = accessTokenFromStorage(adminAuthFile, origin)
    const managerToken = accessTokenFromStorage(managerAuthFile, origin)
    const jogadorToken = accessTokenFromStorage(jogadorAuthFile, origin)
    const managerId = await accountId(request, origin, managerToken, 'manager')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Convites manager ${unique}`

    let campeonatoId = ''
    let conviteId = ''
    let conviteNotificacaoId = ''
    let pedidoId = ''
    let pedidoNotificacaoId = ''
    let sellerAtivo = false

    try {
      const createResponse = await request.post(`${origin}/api/dropzone`, {
        headers: headers(produtoraToken, 'produtora'),
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
      const createBody = await json(createResponse)
      expect(createResponse.ok(), `Falha ao criar campeonato: ${createBody?.error || createResponse.status()}`).toBeTruthy()
      campeonatoId = String(createBody?.row?.id || '')
      expect(campeonatoId).not.toBe('')

      const approvalResponse = await request.patch(`${origin}/api/admin/aprovacoes`, {
        headers: headers(adminToken),
        data: {
          alvo: 'campeonato',
          id: campeonatoId,
          status: 'aprovado',
          motivo: 'Aprovação automática para teste de convite de manager',
          cobranca_status: 'cortesia',
          cobranca_obs: 'Dado temporário removido pelo E2E.',
        },
      })
      const approvalBody = await json(approvalResponse)
      expect(approvalResponse.ok(), `Falha ao aprovar campeonato: ${approvalBody?.error || approvalResponse.status()}`).toBeTruthy()

      // Fluxo A: produtora convida manager para um campeonato específico.
      const inviteResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/managers/convites`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            manager_id: managerId,
            mensagem: `[E2E] Convite por campeonato ${unique}`,
            validade_dias: 1,
            limite_vagas: 3,
            permissoes: {
              vendedor_vagas: true,
              adicionar_equipes: false,
              remover_proprias_equipes: true,
              gerar_convites_equipe: true,
              ver_estrutura: true,
              organizar_grupos: false,
              pontuar_tabela: false,
            },
          },
        },
      )
      const inviteBody = await json(inviteResponse)
      expect(inviteResponse.ok(), `Falha ao criar convite: ${inviteBody?.error || inviteResponse.status()}`).toBeTruthy()
      conviteId = String(inviteBody?.convite?.id || '')
      conviteNotificacaoId = String(inviteBody?.convite?.notificacao_id || '')
      expect(conviteId).not.toBe('')
      expect(conviteNotificacaoId).not.toBe('')

      const duplicateInvite = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/managers/convites`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: { manager_id: managerId, validade_dias: 1 },
        },
      )
      expect(duplicateInvite.ok(), 'Convite pendente duplicado deve ser bloqueado.').toBe(false)

      const forbiddenAccept = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(conviteNotificacaoId)}/aceitar`,
        { headers: headers(jogadorToken, 'jogador'), data: {} },
      )
      expect(forbiddenAccept.ok(), 'Jogador não pode aceitar convite destinado ao manager.').toBe(false)

      const acceptInvite = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(conviteNotificacaoId)}/aceitar`,
        { headers: headers(managerToken, 'manager'), data: {} },
      )
      const acceptInviteBody = await json(acceptInvite)
      expect(acceptInvite.ok(), `Falha ao aceitar convite: ${acceptInviteBody?.error || acceptInvite.status()}`).toBeTruthy()
      expect(acceptInviteBody?.campeonato_id).toBe(campeonatoId)
      sellerAtivo = true

      const listResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/managers/convites`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const listBody = await json(listResponse)
      expect(listResponse.ok(), `Falha ao listar vendedores: ${listBody?.error || listResponse.status()}`).toBeTruthy()
      const seller = (Array.isArray(listBody?.vendedores) ? listBody.vendedores : [])
        .find((item: any) => String(item?.manager_id || '') === managerId)
      expect(seller, 'O manager aceito deve aparecer como vendedor ativo do campeonato.').toBeTruthy()
      expect(Number(seller?.limite_vagas || 0)).toBe(3)
      expect(seller?.permissoes?.adicionar_equipes).toBe(false)
      expect(seller?.permissoes?.ver_estrutura).toBe(true)
      expect(seller?.permissoes?.pontuar_tabela).toBe(false)

      const managerChampionships = await request.get(
        `${origin}/api/vendedores/${encodeURIComponent(managerId)}/campeonatos`,
        { headers: headers(managerToken, 'manager') },
      )
      const managerChampionshipsBody = await json(managerChampionships)
      expect(managerChampionships.ok(), `Falha ao listar campeonatos do manager: ${managerChampionshipsBody?.error || managerChampionships.status()}`).toBeTruthy()
      const managerLink = (Array.isArray(managerChampionshipsBody?.campeonatos) ? managerChampionshipsBody.campeonatos : [])
        .find((item: any) => String(item?.campeonato_id || '') === campeonatoId)
      expect(managerLink, 'O campeonato deve aparecer no painel do manager após o aceite.').toBeTruthy()
      expect(managerLink?.status).toBe('ativo')
      expect(Number(managerLink?.limite_vagas || 0)).toBe(3)

      const duplicateRequestWhileActive = await request.post(
        `${origin}/api/managers/${encodeURIComponent(managerId)}/campeonatos/pedidos`,
        {
          headers: headers(managerToken, 'manager'),
          data: { campeonato_id: campeonatoId, mensagem: '[E2E] Pedido duplicado' },
        },
      )
      expect(duplicateRequestWhileActive.ok(), 'Manager ativo não pode pedir acesso novamente.').toBe(false)

      await removeSeller(request, origin, produtoraToken, campeonatoId, managerId)
      sellerAtivo = false

      // Fluxo B: manager pede acesso e a produtora aprova pelo correio.
      const requestAccess = await request.post(
        `${origin}/api/managers/${encodeURIComponent(managerId)}/campeonatos/pedidos`,
        {
          headers: headers(managerToken, 'manager'),
          data: {
            campeonato_id: campeonatoId,
            mensagem: `[E2E] Pedido de acesso ${unique}`,
            validade_dias: 1,
          },
        },
      )
      const requestAccessBody = await json(requestAccess)
      expect(requestAccess.ok(), `Falha ao pedir acesso: ${requestAccessBody?.error || requestAccess.status()}`).toBeTruthy()
      pedidoId = String(requestAccessBody?.pedido?.id || '')
      pedidoNotificacaoId = String(requestAccessBody?.pedido?.notificacao_id || '')
      expect(pedidoId).not.toBe('')
      expect(pedidoNotificacaoId).not.toBe('')

      const managerCannotApprove = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(pedidoNotificacaoId)}/aceitar`,
        { headers: headers(managerToken, 'manager'), data: {} },
      )
      expect(managerCannotApprove.ok(), 'Manager não pode aprovar o próprio pedido.').toBe(false)

      const ownerAccepts = await request.post(
        `${origin}/api/notificacoes/${encodeURIComponent(pedidoNotificacaoId)}/aceitar`,
        { headers: headers(produtoraToken, 'produtora'), data: {} },
      )
      const ownerAcceptsBody = await json(ownerAccepts)
      expect(ownerAccepts.ok(), `Falha ao aprovar pedido: ${ownerAcceptsBody?.error || ownerAccepts.status()}`).toBeTruthy()
      expect(ownerAcceptsBody?.campeonato_id).toBe(campeonatoId)
      sellerAtivo = true

      const finalList = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/managers/convites`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const finalListBody = await json(finalList)
      expect(finalList.ok()).toBeTruthy()
      const finalSeller = (Array.isArray(finalListBody?.vendedores) ? finalListBody.vendedores : [])
        .find((item: any) => String(item?.manager_id || '') === managerId)
      expect(finalSeller, 'Pedido aprovado deve recriar o vínculo ativo do manager.').toBeTruthy()

      await removeSeller(request, origin, produtoraToken, campeonatoId, managerId)
      sellerAtivo = false
    } finally {
      if (sellerAtivo) {
        await removeSeller(request, origin, produtoraToken, campeonatoId, managerId)
      }

      if (conviteId && !conviteNotificacaoId) {
        await request.delete(
          `${origin}/api/campeonatos/${encodeURIComponent(campeonatoId)}/managers/convites`,
          {
            headers: headers(produtoraToken, 'produtora'),
            data: { convite_id: conviteId },
          },
        ).catch(() => null)
      }

      await archiveNotification(request, origin, managerToken, 'manager', conviteNotificacaoId)
      await archiveNotification(request, origin, produtoraToken, 'produtora', pedidoNotificacaoId)
      await archiveChampionship(request, origin, produtoraToken, campeonatoId)
      releaseFileLock(lockFile)
    }
  })
})
