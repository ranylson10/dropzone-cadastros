import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { acquireFileLock, releaseFileLock } from '../support/file-lock'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const adminAuthFile = path.resolve('tests-e2e/.auth/admin.json')
const managerAuthFile = path.resolve('tests-e2e/.auth/manager.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')
const lockFile = path.resolve('tests-e2e/.auth/vendedor-catalogo.lock')

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
      // Ignora chaves locais que não sejam sessão Supabase.
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
  expect(id).not.toBe('')
  return id
}


async function createEntity(
  request: APIRequestContext,
  origin: string,
  token: string,
  data: Record<string, unknown>,
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request.post(`${origin}/api/dropzone`, {
        headers: headers(token, 'produtora'),
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
  if (!id) return
  await request.delete(`${origin}/api/dropzone`, {
    headers: headers(token, 'produtora'),
    data: { entity_type: entityType, id },
  }).catch(() => null)
}

async function removeSeller(
  request: APIRequestContext,
  origin: string,
  token: string,
  championshipId: string,
  managerId: string,
) {
  if (!championshipId || !managerId) return
  await request.delete(`${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`, {
    headers: headers(token, 'produtora'),
    data: { manager_id: managerId },
  }).catch(() => null)
}

async function cancelInvite(
  request: APIRequestContext,
  origin: string,
  token: string,
  championshipId: string,
  tokenId: string,
) {
  if (!championshipId || !tokenId) return
  await request.delete(`${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`, {
    headers: headers(token, 'produtora'),
    data: { token_id: tokenId },
  }).catch(() => null)
}

test.describe('Vendedor controlado — convite, catálogo público e limites', () => {
  test.setTimeout(480_000)

  test('produtora vincula vendedor, publica catálogo, altera limite e remove acesso', async ({ request, page, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, adminAuthFile, managerAuthFile, equipeAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    await acquireFileLock(lockFile, 'vendedor')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)
    const adminToken = accessTokenFromStorage(adminAuthFile, origin)
    const managerToken = accessTokenFromStorage(managerAuthFile, origin)
    const equipeToken = accessTokenFromStorage(equipeAuthFile, origin)
    const managerId = await accountId(request, origin, managerToken, 'manager')
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const championshipName = `[E2E] Catálogo vendedor ${unique}`

    let championshipId = ''
    let phaseId = ''
    let groupId = ''
    let inviteId = ''
    let sellerActive = false

    try {
      const championship = await createEntity(request, origin, produtoraToken, {
        entity_type: 'championship',
        name: championshipName,
        data: {
          nome: championshipName,
          tipo: 'copa',
          logo_url: `${origin}/favicon.ico`,
          banner_url: `${origin}/favicon.ico`,
          numero_vagas: 4,
          formato: 'Mata-mata',
          plataforma: 'mobile',
          servidor: 'BR',
          valor_inscricao: 10,
          aceita_novas_inscricoes_equipes: true,
          recurso_export: false,
          recurso_stream: false,
          recurso_rulebook: false,
          recurso_stats: false,
          recurso_broadcast: false,
        },
      })
      championshipId = String(championship?.id || '')
      expect(championshipId).not.toBe('')

      const approval = await request.patch(`${origin}/api/admin/aprovacoes`, {
        headers: headers(adminToken),
        data: {
          alvo: 'campeonato',
          id: championshipId,
          status: 'aprovado',
          motivo: 'Aprovação automática para teste de vendedor.',
          cobranca_status: 'cortesia',
          cobranca_obs: 'Registro E2E temporário.',
        },
      })
      const approvalBody = await json(approval)
      expect(approval.ok(), `Falha ao aprovar campeonato: ${approvalBody?.error || approval.status()}`).toBeTruthy()

      // Garante explicitamente a configuração comercial usada pelo catálogo.
      // A criação do campeonato já deveria persistir essa linha, mas o teste
      // não pode seguir com uma fixture incompleta e produzir falso negativo.
      const configurationResponse = await request.patch(`${origin}/api/dropzone`, {
        headers: headers(produtoraToken, 'produtora'),
        data: {
          entity_type: 'championship',
          id: championshipId,
          data: {
            nome: championshipName,
            tipo: 'copa',
            logo_url: `${origin}/favicon.ico`,
            banner_url: `${origin}/favicon.ico`,
            numero_vagas: 4,
            formato: 'Mata-mata',
            plataforma: 'mobile',
            servidor: 'BR',
            valor_inscricao: 10,
            aceita_novas_inscricoes_equipes: true,
            recurso_export: false,
            recurso_stream: false,
            recurso_rulebook: false,
            recurso_stats: false,
            recurso_broadcast: false,
          },
        },
      })
      const configurationBody = await json(configurationResponse)
      expect(
        configurationResponse.ok(),
        `Falha ao consolidar configuração comercial: ${configurationBody?.error || configurationResponse.status()}`,
      ).toBeTruthy()
      expect(configurationBody?.row?.data?.aceita_novas_inscricoes_equipes).toBe(true)
      expect(Number(configurationBody?.row?.data?.numero_vagas || 0)).toBe(4)

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

      const inviteResponse = await request.post(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: { limite_vagas: 2, nome_publico: `[E2E] Vendedor ${unique}` },
        },
      )
      const inviteBody = await json(inviteResponse)
      expect(inviteResponse.ok(), `Falha ao gerar convite de vendedor: ${inviteBody?.error || inviteResponse.status()}`).toBeTruthy()
      inviteId = String(inviteBody?.convite?.id || '')
      const inviteToken = String(inviteBody?.convite?.token || '')
      expect(inviteId).not.toBe('')
      expect(inviteToken).not.toBe('')
      expect(String(inviteBody?.link || '')).toContain(`/vendedor/${inviteToken}`)

      const guestInvite = await request.get(`${origin}/api/vendedores/convite/${encodeURIComponent(inviteToken)}`)
      const guestInviteBody = await json(guestInvite)
      expect(guestInvite.ok(), `Convite público deve abrir: ${guestInviteBody?.error || guestInvite.status()}`).toBeTruthy()
      expect(guestInviteBody?.valido).toBe(true)
      expect(guestInviteBody?.modo).toBe('campeonato')

      const wrongProfile = await request.post(`${origin}/api/vendedores/convite/${encodeURIComponent(inviteToken)}`, {
        headers: headers(equipeToken, 'equipe'),
        data: { nome_publico: '[E2E] Conta sem manager' },
      })
      expect(wrongProfile.ok(), 'Uma conta sem perfil manager não pode aceitar convite de vendedor.').toBe(false)

      const acceptResponse = await request.post(`${origin}/api/vendedores/convite/${encodeURIComponent(inviteToken)}`, {
        headers: headers(managerToken, 'manager'),
        data: { nome_publico: `[E2E] Vendedor ${unique}` },
      })
      const acceptBody = await json(acceptResponse)
      expect(acceptResponse.ok(), `Falha ao aceitar convite: ${acceptBody?.error || acceptResponse.status()}`).toBeTruthy()
      expect(acceptBody?.ok).toBe(true)
      sellerActive = true

      const sellersResponse = await request.get(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`,
        { headers: headers(produtoraToken, 'produtora') },
      )
      const sellersBody = await json(sellersResponse)
      expect(sellersResponse.ok(), `Falha ao listar vendedores: ${sellersBody?.error || sellersResponse.status()}`).toBeTruthy()
      const seller = (Array.isArray(sellersBody?.vendedores) ? sellersBody.vendedores : [])
        .find((item: any) => String(item?.manager_id || '') === managerId)
      expect(seller, 'O manager deve aparecer como vendedor ativo.').toBeTruthy()
      expect(Number(seller?.limite_vagas || 0)).toBe(2)

      let announcement: any
      let catalogDiagnostic: any = null
      const deadline = Date.now() + 8_000
      while (!announcement && Date.now() < deadline) {
        const catalogResponse = await request.get(
          `${origin}/api/vagas?vendedor=${encodeURIComponent(managerId)}&debug_campeonato=${encodeURIComponent(championshipId)}`,
          { headers: headers(adminToken) },
        )
        const catalogBody = await json(catalogResponse)
        catalogDiagnostic = catalogBody?.diagnostics?.[0] || {
          status_http: catalogResponse.status(),
          erro: catalogBody?.error || null,
          scope: catalogBody?.scope || null,
        }
        if (catalogResponse.ok() && catalogBody?.scope?.tipo === 'vendedor') {
          announcement = (Array.isArray(catalogBody?.announcements) ? catalogBody.announcements : [])
            .find((item: any) => String(item?.id || '') === championshipId)
        }
        if (!announcement) await new Promise((resolve) => setTimeout(resolve, 500))
      }
      expect(
        announcement,
        `O campeonato deve aparecer no catálogo público do vendedor. Diagnóstico: ${JSON.stringify(catalogDiagnostic)}`,
      ).toBeTruthy()
      expect(Number(announcement?.vagas_livres || 0)).toBeGreaterThanOrEqual(1)

      const publicSellerApi = await request.get(`${origin}/api/vendedores/${encodeURIComponent(managerId)}/vagas`)
      const publicSellerBody = await json(publicSellerApi)
      expect(publicSellerApi.ok(), `Falha na página pública do vendedor: ${publicSellerBody?.error || publicSellerApi.status()}`).toBeTruthy()
      const sellerAnnouncement = (Array.isArray(publicSellerBody?.announcements) ? publicSellerBody.announcements : [])
        .find((item: any) => String(item?.id || '') === championshipId)
      expect(sellerAnnouncement).toBeTruthy()

      await page.goto(`/vendedores/${encodeURIComponent(managerId)}`)
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|This page couldn.t load/i)
      await expect(page.locator('body')).toContainText(championshipName, { timeout: 15_000 })

      const updateResponse = await request.patch(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`,
        {
          headers: headers(produtoraToken, 'produtora'),
          data: {
            manager_id: managerId,
            limite_vagas: 1,
            permissoes: {
              vendedor_vagas: true,
              adicionar_equipes: false,
              remover_proprias_equipes: false,
              gerar_convites_equipe: false,
              ver_estrutura: true,
              organizar_grupos: false,
              pontuar_tabela: false,
            },
          },
        },
      )
      const updateBody = await json(updateResponse)
      expect(updateResponse.ok(), `Falha ao atualizar limite: ${updateBody?.error || updateResponse.status()}`).toBeTruthy()
      expect(Number(updateBody?.vendedor?.limite_vagas || 0)).toBe(1)
      expect(updateBody?.vendedor?.permissoes?.gerar_convites_equipe).toBe(false)

      const forbiddenUpdate = await request.patch(
        `${origin}/api/campeonatos/${encodeURIComponent(championshipId)}/vendedores`,
        {
          headers: headers(managerToken, 'manager'),
          data: { manager_id: managerId, limite_vagas: 99 },
        },
      )
      expect(forbiddenUpdate.ok(), 'Vendedor não pode aumentar o próprio limite.').toBe(false)

      await removeSeller(request, origin, produtoraToken, championshipId, managerId)
      sellerActive = false

      const catalogAfterRemoval = await request.get(`${origin}/api/vagas?vendedor=${encodeURIComponent(managerId)}`)
      const catalogAfterRemovalBody = await json(catalogAfterRemoval)
      expect(catalogAfterRemoval.ok()).toBeTruthy()
      const removedAnnouncement = (Array.isArray(catalogAfterRemovalBody?.announcements) ? catalogAfterRemovalBody.announcements : [])
        .find((item: any) => String(item?.id || '') === championshipId)
      expect(removedAnnouncement, 'Campeonato removido não pode continuar no catálogo do vendedor.').toBeFalsy()
    } finally {
      if (sellerActive) await removeSeller(request, origin, produtoraToken, championshipId, managerId)
      await cancelInvite(request, origin, produtoraToken, championshipId, inviteId)
      await deleteEntity(request, origin, produtoraToken, 'group', groupId)
      await deleteEntity(request, origin, produtoraToken, 'phase', phaseId)
      await deleteEntity(request, origin, produtoraToken, 'championship', championshipId)
      releaseFileLock(lockFile)
    }
  })
})
