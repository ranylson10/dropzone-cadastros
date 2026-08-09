import { apiUrl } from '@/config/env'

type RequestOptions = RequestInit & {
  accessToken?: string | null
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 25000

export async function dropzoneFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      signal: options.signal || controller.signal,
      headers,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao conectar com o DropZone. Verifique sua internet e tente novamente.')
    throw new Error(error?.message || 'Não foi possível conectar com o DropZone.')
  } finally {
    clearTimeout(timeout)
  }
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Não foi possível concluir a ação.')
  }
  return json as T
}

export const mobileApi = {
  updateProfile: (body: Record<string, unknown>, accessToken?: string | null) =>
    dropzoneFetch<{ ok: boolean; profile: any; warning?: string }>('/api/me/perfil', { method: 'PATCH', accessToken, body: JSON.stringify(body) }),
  uploadProfileImage: (body: { bucket: string; entity_id: string; file_name: string; data_url: string }, accessToken?: string | null) =>
    dropzoneFetch<{ url: string; path: string }>('/api/upload', { method: 'POST', accessToken, timeoutMs: 60000, body: JSON.stringify(body) }),
  championshipsPublic: () =>
    dropzoneFetch<{ announcements: unknown[] }>('/api/vagas?diretorio=1', {
      cache: 'no-store',
    }),
  championshipStructure: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/estrutura`, {
      cache: 'no-store',
    }),
  championshipTeams: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/equipes`, {
      cache: 'no-store',
    }),
  championshipPlayers: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/jogadores`, {
      cache: 'no-store',
    }),
  championshipTeamStats: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/estatisticas/equipes`, {
      cache: 'no-store',
    }),
  championshipMvpStats: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/estatisticas/mvp`, {
      cache: 'no-store',
    }),
  publicTeam: (teamId: string) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/lines`, {
      cache: 'no-store',
    }),
  publicPlayers: (query = '') =>
    dropzoneFetch<{ items: unknown[] }>(`/api/jogadores/busca-publica?q=${encodeURIComponent(query)}`, { cache: 'no-store' }),
  publicPlayer: (playerId: string) =>
    dropzoneFetch<any>(`/api/jogadores/${encodeURIComponent(playerId)}/public`, { cache: 'no-store' }),
  vacancies: () => dropzoneFetch<{ announcements: unknown[]; authenticated: boolean; hasTeam: boolean }>('/api/vagas'),
  commerceCart: (accessToken?: string | null) =>
    dropzoneFetch<{ cart?: unknown; items: unknown[]; needs_migration?: boolean }>('/api/me/commerce/cart', {
      accessToken,
      cache: 'no-store',
    }),
  addCommerceCart: (campeonatoId: string, quantidade = 1, accessToken?: string | null) =>
    dropzoneFetch<{ cart?: unknown; items: unknown[]; needs_migration?: boolean }>('/api/me/commerce/cart', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ campeonato_id: campeonatoId, quantidade, origem: 'app' }),
    }),
  checkoutCommerceCartItem: (body: { item_id: string; method: 'pix' | 'cartao' | 'paypal'; cpf_cnpj?: string | null }, accessToken?: string | null) =>
    dropzoneFetch<{
      item_id: string
      quantity: number
      compra: { id: string; token: string; status: string; valor_centavos: number; campeonato_id: string; quantidade_vagas: number; valor_unitario_centavos: number }
      payment: null | {
        id: string
        status: string
        valor_centavos: number
        invoice_url?: string | null
        pix_qrcode?: string | null
        pix_payload?: string | null
        provider?: string | null
        metodo?: string | null
        billing_type?: string | null
        paypal_approval_url?: string | null
      }
      claim_url: string
    }>('/api/me/commerce/cart/checkout', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
    }),
  removeCommerceCartItem: (itemId: string, accessToken?: string | null) =>
    dropzoneFetch<{ cart?: unknown; items: unknown[]; needs_migration?: boolean }>(`/api/me/commerce/cart?item_id=${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      accessToken,
    }),
  updateCommerceCartItem: (itemId: string, quantidade: number, accessToken?: string | null) =>
    dropzoneFetch<{ cart?: unknown; items: unknown[]; needs_migration?: boolean }>('/api/me/commerce/cart', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ item_id: itemId, quantidade }),
    }),
  commerceWishlist: (accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[]; needs_migration?: boolean }>('/api/me/commerce/wishlist', {
      accessToken,
      cache: 'no-store',
    }),
  toggleCommerceWishlist: (campeonatoId: string, accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[]; needs_migration?: boolean }>('/api/me/commerce/wishlist', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ campeonato_id: campeonatoId, origem: 'app' }),
    }),
  createVacancyPayment: (body: { campeonato_id: string; method: 'pix' | 'cartao' | 'paypal'; vendedor_manager_id?: string | null; cpf_cnpj?: string | null }, accessToken?: string | null) =>
    dropzoneFetch<{
      reused: boolean
      compra: { id: string; token: string; status: string; valor_centavos: number; campeonato_id: string; grupo_id?: string | null }
      payment: null | {
        id: string
        status: string
        valor_centavos: number
        invoice_url?: string | null
        pix_qrcode?: string | null
        pix_payload?: string | null
        provider?: string | null
        metodo?: string | null
        billing_type?: string | null
        paypal_approval_url?: string | null
      }
      claim_url: string
      asaas_configured: boolean
    }>('/api/pagamentos/vaga', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
    }),
  agenda: (accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[]; setup_required?: boolean }>('/api/agenda?scope=me', {
      accessToken,
      cache: 'no-store',
    }),
  lineups: (accessToken?: string | null) =>
    dropzoneFetch<{ escalacoes: unknown[] }>('/api/equipe/escalacoes', {
      accessToken,
      cache: 'no-store',
    }),
  playerDashboard: (playerId: string, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/lili/jogadores?id=${encodeURIComponent(playerId)}`, { accessToken, cache: 'no-store' }),
  teams: (accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[] }>('/api/lili/equipes', {
      accessToken,
      cache: 'no-store',
    }),
  publicTeams: (query = '', accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[] }>(`/api/equipes/busca-publica?q=${encodeURIComponent(query)}`, {
      accessToken,
      cache: 'no-store',
    }),
  publicTeamsFallback: (accessToken?: string | null) =>
    dropzoneFetch<{ rows: unknown[] }>('/api/dropzone?entity_type=team', {
      accessToken,
      cache: 'no-store',
    }),
  team: (teamId: string, accessToken?: string | null) =>
    dropzoneFetch<{ team: unknown; overview: unknown }>(`/api/lili/equipes?id=${encodeURIComponent(teamId)}`, {
      accessToken,
      cache: 'no-store',
    }),
  createTeamLine: (teamId: string, name: string, accessToken?: string | null) =>
    dropzoneFetch<{ line?: unknown }>(`/api/equipes/${encodeURIComponent(teamId)}/lines`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ nome: name }),
    }),
  teamLine: (teamId: string, lineId: string, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/lines/${encodeURIComponent(lineId)}`, { accessToken, cache: 'no-store' }),
  updateTeamLine: (teamId: string, body: Record<string, unknown>, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/lines`, { method: 'PATCH', accessToken, body: JSON.stringify(body) }),
  deleteTeamLine: (teamId: string, lineId: string, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/lines?line_id=${encodeURIComponent(lineId)}`, { method: 'DELETE', accessToken }),
  performTeamLineAction: (teamId: string, lineId: string, body: Record<string, unknown>, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/lines/${encodeURIComponent(lineId)}`, { method: 'POST', accessToken, body: JSON.stringify(body) }),
  createLineupInvite: (campeonatoEquipeId: string, accessToken?: string | null) =>
    dropzoneFetch<{ token: string; public_url: string; texto: string }>('/api/equipe/escalacoes', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ campeonato_equipe_id: campeonatoEquipeId }),
    }),
  wallet: (accessToken?: string | null, profileType?: string | null) =>
    dropzoneFetch<{ carteira?: unknown; lancamentos?: unknown[]; pagamentos?: unknown[]; saques?: unknown[]; perfil?: unknown }>('/api/me/carteira', {
      accessToken,
      headers: profileType ? { 'X-Profile-Type': profileType } : undefined,
      cache: 'no-store',
    }),
  receipt: (id: string, tipo: 'pagamento' | 'saque' | 'lancamento', accessToken?: string | null) =>
    dropzoneFetch<{ comprovante: unknown }>(`/api/me/carteira/comprovante/${encodeURIComponent(id)}?tipo=${tipo}`, {
      accessToken,
      cache: 'no-store',
    }),
  notifications: (accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[]; nao_lidas: number; setup_required?: boolean }>('/api/notificacoes?limit=30', {
      accessToken,
      cache: 'no-store',
    }),
  centralChampionships: (accessToken?: string | null) =>
    dropzoneFetch<{ campeonatos?: unknown[]; authorized?: unknown[]; participant?: unknown[]; items?: unknown[] }>('/api/central-campeonato', {
      accessToken,
      cache: 'no-store',
    }),
  championshipAdminList: (accessToken?: string | null) => dropzoneFetch<any>('/api/central-campeonato', { accessToken, cache: 'no-store' }),
  championshipAdminSummary: (id: string, accessToken?: string | null) => dropzoneFetch<any>(`/api/central-campeonato?campeonato_id=${encodeURIComponent(id)}`, { accessToken, cache: 'no-store' }),
  createChampionship: (data: Record<string, unknown>, accessToken?: string | null) => dropzoneFetch<any>('/api/dropzone', { method:'POST', accessToken, headers:{'X-Profile-Type':'produtora'}, body:JSON.stringify({entity_type:'championship',name:data.nome,data}) }),
  championshipStructureAction: (id:string, method:'POST'|'PATCH'|'DELETE', body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estrutura`, {method,accessToken,body:JSON.stringify(body)}),
  createChampionshipGame: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  updateChampionshipGame: (id:string, gameId:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  deleteChampionshipGame: (id:string, gameId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}`, {method:'DELETE',accessToken}),
  uploadChampionshipImage: (body:{file_name:string;data_url:string},accessToken?:string|null) => dropzoneFetch<{url:string}>('/api/upload',{method:'POST',accessToken,timeoutMs:60000,body:JSON.stringify({bucket:'campeonato',upload_intent:'create_campeonato',...body})}),
  sellerSales: (managerId: string, accessToken?: string | null) =>
    dropzoneFetch<{ sales: unknown[]; asaas_configured?: boolean; paypal_configured?: boolean }>(`/api/vendedores/${encodeURIComponent(managerId)}/vendas`, {
      accessToken,
      cache: 'no-store',
    }),
  managerChampionships: (managerId:string,accessToken?:string|null) => dropzoneFetch<any>(`/api/vendedores/${encodeURIComponent(managerId)}/campeonatos`,{accessToken,cache:'no-store'}),
  updateManagerChampionship: (managerId:string,body:Record<string,unknown>,accessToken?:string|null) => dropzoneFetch<any>(`/api/vendedores/${encodeURIComponent(managerId)}/campeonatos`,{method:'PATCH',accessToken,body:JSON.stringify(body)}),
  managerLinks: (managerId:string,accessToken?:string|null) => dropzoneFetch<any>(`/api/managers/${encodeURIComponent(managerId)}/vinculos`,{accessToken,cache:'no-store'}),
  createSellerSale: (managerId:string,body:Record<string,unknown>,accessToken?:string|null) => dropzoneFetch<any>(`/api/vendedores/${encodeURIComponent(managerId)}/vendas`,{method:'POST',accessToken,timeoutMs:60000,body:JSON.stringify(body)}),
  producerSellers: (accessToken?: string | null) =>
    dropzoneFetch<{ vendedores?: unknown[]; produtora?: unknown; campeonatos?: unknown[]; convites_pendentes?: unknown[] }>('/api/produtora/vendedores', {
      accessToken,
      cache: 'no-store',
    }),
  createProducerSellerInvite: (body: Record<string, unknown>, accessToken?: string | null) => dropzoneFetch<any>('/api/produtora/vendedores',{method:'POST',accessToken,body:JSON.stringify({action:'invite',...body})}),
  updateProducerSeller: (managerId:string,body:Record<string,unknown>,accessToken?:string|null) => dropzoneFetch<any>('/api/produtora/vendedores',{method:'PATCH',accessToken,body:JSON.stringify({manager_id:managerId,...body})}),
  removeProducerSeller: (managerId:string,accessToken?:string|null) => dropzoneFetch<any>('/api/produtora/vendedores',{method:'DELETE',accessToken,body:JSON.stringify({manager_id:managerId})}),
  rank: () =>
    dropzoneFetch<{ teams: unknown[]; players: unknown[] }>('/api/rank', {
      cache: 'no-store',
    }),
  updateNotification: (id: string, status: 'lida' | 'nao_lida' | 'arquivada', accessToken?: string | null) =>
    dropzoneFetch<{ ok: boolean }>(
      '/api/notificacoes',
      {
        method: 'PATCH',
        accessToken,
        body: JSON.stringify({ id, status }),
      },
    ),
  respondNotification: (id: string, action: 'aceitar' | 'recusar', accessToken?: string | null) =>
    dropzoneFetch<{ ok: boolean; mensagem?: string }>(`/api/notificacoes/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      accessToken,
    }),
  lili: (message: string, accessToken?: string | null) =>
    dropzoneFetch('/api/lili/chat', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ message }),
    }),
}

export type QuickTokenKind =
  | 'team_championship_invite'
  | 'group_registration'
  | 'lineup'
  | 'player_registration'
  | 'team_roster_invite'
  | 'seller_invite'

export type QuickTokenResult = {
  kind: QuickTokenKind
  token: string
  title: string
  description: string
  openPath: string
  actionLabel: string
  payload: any
}

function normalizeQuickToken(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts.at(-1) || '').trim().toUpperCase()
  } catch {
    const clean = raw.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) || raw
    return decodeURIComponent(clean).trim().toUpperCase()
  }
}

export async function resolveQuickToken(value: string, accessToken?: string | null): Promise<QuickTokenResult> {
  const token = normalizeQuickToken(value)
  if (!token || token.length < 3) throw new Error('Digite um token válido ou cole o link completo.')
  const encoded = encodeURIComponent(token)

  const probes: Array<{
    kind: QuickTokenKind
    path: string
    openPath: string
    title: string
    actionLabel: string
    describe: (payload: any) => string
  }> = [
    {
      kind: 'team_championship_invite',
      path: `/api/convites/equipe/${encoded}`,
      openPath: `/convite/equipe/${encoded}`,
      title: 'Convite para campeonato',
      actionLabel: 'Abrir inscrição',
      describe: (p) => [p?.campeonato?.nome, p?.grupo?.nome].filter(Boolean).join(' · ') || 'Convite de equipe para campeonato.',
    },
    {
      kind: 'group_registration',
      path: `/api/convites/grupo/${encoded}`,
      openPath: `/convite/grupo/${encoded}`,
      title: 'Inscrição de equipe',
      actionLabel: 'Abrir grupo',
      describe: (p) => [p?.campeonato?.nome, p?.grupo?.nome].filter(Boolean).join(' · ') || 'Entrada de equipe por grupo.',
    },
    {
      kind: 'lineup',
      path: `/api/escalacoes/${encoded}`,
      openPath: `/escala/${encoded}`,
      title: 'Escalação de jogadores',
      actionLabel: 'Abrir escalação',
      describe: (p) => [p?.campeonato_nome, p?.equipe_nome, p?.line_nome].filter(Boolean).join(' · ') || p?.link?.titulo || 'Token de escalação.',
    },
    {
      kind: 'player_registration',
      path: `/api/dropzone/public/inscricao/${encoded}`,
      openPath: `/i/${encoded}`,
      title: 'Inscrição de jogador',
      actionLabel: 'Abrir inscrição',
      describe: (p) => [p?.campeonato?.nome, p?.grupo?.nome].filter(Boolean).join(' · ') || p?.link?.titulo || 'Inscrição de jogador em campeonato.',
    },
    {
      kind: 'team_roster_invite',
      path: `/api/equipes/convites-elenco/${encoded}`,
      openPath: `/equipe/entrar/${encoded}`,
      title: 'Convite para equipe',
      actionLabel: 'Abrir convite',
      describe: (p) => [p?.equipe?.nome, p?.line?.nome].filter(Boolean).join(' · ') || 'Convite para entrar em uma equipe.',
    },
    {
      kind: 'seller_invite',
      path: `/api/vendedores/convite/${encoded}`,
      openPath: `/vendedor/${encoded}`,
      title: 'Convite de vendedor',
      actionLabel: 'Abrir convite',
      describe: (p) => p?.convite?.titulo || p?.convite?.produtora_nome || 'Convite para atuar como vendedor.',
    },
  ]

  const results = await Promise.allSettled(
    probes.map((probe) => dropzoneFetch<any>(probe.path, { accessToken, cache: 'no-store', timeoutMs: 9000 })),
  )

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]
    if (result.status !== 'fulfilled') continue
    const probe = probes[index]
    return {
      kind: probe.kind,
      token,
      title: probe.title,
      description: probe.describe(result.value),
      openPath: probe.openPath,
      actionLabel: probe.actionLabel,
      payload: result.value,
    }
  }

  throw new Error('Não reconheci esse token. Confira os caracteres ou cole o link completo.')
}
