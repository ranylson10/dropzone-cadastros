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
  publicChampionshipRulebook: (championshipId: string) =>
    dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championshipId)}/rulebook?public=1`, {
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
  vacancyClaimContext: (token: string, equipeId?: string | null, accessToken?: string | null) =>
    dropzoneFetch<any>(
      `/api/pagamentos/vaga/claim?token=${encodeURIComponent(token)}${equipeId ? `&equipe_id=${encodeURIComponent(equipeId)}` : ''}`,
      { accessToken, cache: 'no-store' },
    ),
  claimVacancyPurchase: (
    body: { token: string; equipe_id: string; slot_id: string; line_id?: string | null; nome_line?: string | null },
    accessToken?: string | null,
  ) =>
    dropzoneFetch<any>('/api/pagamentos/vaga/claim', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
    }),
  agenda: (accessToken?: string | null) =>
    dropzoneFetch<{ items: unknown[]; setup_required?: boolean; range?: any }>('/api/agenda?scope=me', {
      accessToken,
      cache: 'no-store',
    }),
  agendaScoped: (params:{scope:'me'|'campeonato'|'equipe';scopeId?:string|null;year?:number;month?:number;from?:string;to?:string}, accessToken?:string|null) => {
    const query = new URLSearchParams()
    query.set('scope', params.scope)
    if (params.scopeId) query.set('id', params.scopeId)
    if (params.year) query.set('year', String(params.year))
    if (params.month) query.set('month', String(params.month))
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    return dropzoneFetch<{items:unknown[];setup_required?:boolean;range?:any;scope:string;scope_id?:string|null}>(`/api/agenda?${query.toString()}`, {accessToken,cache:'no-store'})
  },
  createAgendaEvent: (body:Record<string,unknown>, accessToken?:string|null) =>
    dropzoneFetch<any>('/api/agenda', {method:'POST',accessToken,body:JSON.stringify(body)}),
  updateAgendaEvent: (id:string, body:Record<string,unknown>, accessToken?:string|null) =>
    dropzoneFetch<any>('/api/agenda', {method:'PATCH',accessToken,body:JSON.stringify({id,...body})}),
  deleteAgendaEvent: (id:string, accessToken?:string|null) =>
    dropzoneFetch<any>(`/api/agenda?id=${encodeURIComponent(id)}`, {method:'DELETE',accessToken}),
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
  teamRosterInvites: (teamId: string, lineId?: string | null, accessToken?: string | null) =>
    dropzoneFetch<{ invites: any[] }>(
      `/api/equipes/convites-elenco?equipe_id=${encodeURIComponent(teamId)}${lineId ? `&line_id=${encodeURIComponent(lineId)}` : ''}`,
      { accessToken, cache: 'no-store' },
    ),
  createTeamRosterInvite: (
    body: { equipe_id: string; line_id?: string | null; campeonato_equipe_id?: string | null },
    accessToken?: string | null,
  ) =>
    dropzoneFetch<{ token: string; url: string; texto: string; expires_at: string }>('/api/equipes/convites-elenco', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
    }),
  renewTeamRosterInvite: (equipeId: string, tokenId: string, accessToken?: string | null) =>
    dropzoneFetch<{ success: boolean; expires_at: string }>('/api/equipes/convites-elenco', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ equipe_id: equipeId, token_id: tokenId }),
    }),
  cancelTeamRosterInvite: (equipeId: string, tokenId: string, accessToken?: string | null) =>
    dropzoneFetch<{ success: boolean }>('/api/equipes/convites-elenco', {
      method: 'DELETE',
      accessToken,
      body: JSON.stringify({ equipe_id: equipeId, token_id: tokenId }),
    }),
  teamStaff: (teamId: string, accessToken?: string | null) =>
    dropzoneFetch<{ staff: any[]; convites: any[] }>(`/api/equipes/${encodeURIComponent(teamId)}/staff`, {
      accessToken,
      cache: 'no-store',
    }),
  inviteTeamStaff: (teamId: string, body: Record<string, unknown>, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/staff/convites`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
    }),
  updateTeamStaff: (teamId: string, body: Record<string, unknown>, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/staff`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(body),
    }),
  removeTeamStaff: (teamId: string, managerId: string, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/staff`, {
      method: 'DELETE',
      accessToken,
      body: JSON.stringify({ manager_id: managerId }),
    }),
  cancelTeamStaffInvite: (teamId: string, inviteId: string, accessToken?: string | null) =>
    dropzoneFetch<any>(`/api/equipes/${encodeURIComponent(teamId)}/staff/convites`, {
      method: 'DELETE',
      accessToken,
      body: JSON.stringify({ convite_id: inviteId }),
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
  removeLineupPlayer: (jogadorInscricaoId: string, accessToken?: string | null) =>
    dropzoneFetch<{ success: boolean; id: string }>('/api/equipe/escalacoes', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ jogador_inscricao_id: jogadorInscricaoId }),
    }),
  revokeLineupInvite: (linkId: string, accessToken?: string | null) =>
    dropzoneFetch<{ success: boolean; id: string }>(`/api/equipe/escalacoes?link_id=${encodeURIComponent(linkId)}`, {
      method: 'DELETE',
      accessToken,
    }),
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
  championshipAdminRecord: (id: string, accessToken?: string | null) => dropzoneFetch<{ rows: any[] }>(`/api/dropzone?entity_type=championship&championship_id=${encodeURIComponent(id)}`, { accessToken, cache: 'no-store', headers: { 'X-Profile-Type': 'produtora' } }),
  updateChampionship: (id: string, data: Record<string, unknown>, accessToken?: string | null) => dropzoneFetch<any>('/api/dropzone', { method: 'PATCH', accessToken, headers: { 'X-Profile-Type': 'produtora' }, body: JSON.stringify({ entity_type: 'championship', id, data }) }),
  championshipRulebook: (id: string, accessToken?: string | null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rulebook`, { accessToken, cache: 'no-store' }),
  saveChampionshipRulebook: (id: string, body: Record<string, unknown>, accessToken?: string | null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rulebook`, { method: 'PUT', accessToken, body: JSON.stringify(body) }),
  publishChampionshipRulebook: (id: string, confirmacoes_alertas: Record<string, boolean>, accessToken?: string | null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rulebook/publish`, { method: 'POST', accessToken, body: JSON.stringify({ confirmacoes_alertas }) }),
  resetChampionshipRulebook: (id: string, accessToken?: string | null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rulebook`, { method: 'DELETE', accessToken }),
  createChampionship: (data: Record<string, unknown>, accessToken?: string | null) => dropzoneFetch<any>('/api/dropzone', { method:'POST', accessToken, headers:{'X-Profile-Type':'produtora'}, body:JSON.stringify({entity_type:'championship',name:data.nome,data}) }),
  championshipStructureAction: (id:string, method:'POST'|'PATCH'|'DELETE', body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estrutura`, {method,accessToken,body:JSON.stringify(body)}),
  championshipAdminTeams: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes`, {accessToken,cache:'no-store'}),
  searchChampionshipTeams: (id:string, query:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes/busca?q=${encodeURIComponent(query)}`, {accessToken,cache:'no-store'}),
  addChampionshipTeamToSlot: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  moveChampionshipSlot: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  removeChampionshipParticipation: (id:string, participationId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes?participacao_id=${encodeURIComponent(participationId)}`, {method:'DELETE',accessToken}),
  requestChampionshipEntry: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes`, {method:'POST',accessToken,headers:{'X-Profile-Type':'equipe'},body:JSON.stringify({...body,mode:'request'})}),
  reviewChampionshipEntry: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/equipes`, {method:'PATCH',accessToken,body:JSON.stringify({...body,mode:'review_request'})}),
  createChampionshipGame: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  updateChampionshipGame: (id:string, gameId:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  deleteChampionshipGame: (id:string, gameId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}`, {method:'DELETE',accessToken}),
  championshipRounds: (id:string, phaseId?:string|null, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rodadas${phaseId ? `?fase_id=${encodeURIComponent(phaseId)}` : ''}`, {accessToken,cache:'no-store'}),
  createChampionshipRound: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rodadas`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  updateChampionshipRound: (id:string, roundId:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rodadas/${encodeURIComponent(roundId)}`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  deleteChampionshipRound: (id:string, roundId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/rodadas/${encodeURIComponent(roundId)}`, {method:'DELETE',accessToken}),
  championshipGames: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos`, {accessToken,cache:'no-store'}),
  championshipGameFalls: (id:string, gameId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}/quedas`, {accessToken,cache:'no-store'}),
  updateChampionshipFallMap: (id:string, gameId:string, fallId:string, mapCode:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/jogos/${encodeURIComponent(gameId)}/quedas/${encodeURIComponent(fallId)}/mapa`, {method:'PATCH',accessToken,body:JSON.stringify({mapa_codigo:mapCode})}),
  mapCatalog: () => dropzoneFetch<any>('/api/mapas', {cache:'no-store'}),
  championshipScorerGames: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/pontuador/jogos`, {accessToken,cache:'no-store'}),
  championshipScorerGame: (id:string, gameId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/pontuador/${encodeURIComponent(gameId)}`, {accessToken,cache:'no-store'}),
  saveChampionshipManualScore: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/sumula/manual`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  setChampionshipCurrentFall: (id:string, gameId:string, fallId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/pontuador/${encodeURIComponent(gameId)}/quedas/${encodeURIComponent(fallId)}/atual`, {method:'POST',accessToken}),
  markChampionshipFallAbsence: (id:string, gameId:string, fallId:string, championshipTeamId:string, observacoes:string|null, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/pontuador/${encodeURIComponent(gameId)}/quedas/${encodeURIComponent(fallId)}/falta`, {method:'POST',accessToken,body:JSON.stringify({campeonato_equipe_id:championshipTeamId,observacoes})}),
  finalizeChampionshipFall: (id:string, fallId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/quedas/${encodeURIComponent(fallId)}/finalizar`, {method:'POST',accessToken}),
  reopenChampionshipFall: (id:string, fallId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/quedas/${encodeURIComponent(fallId)}/reabrir`, {method:'POST',accessToken}),
  championshipAdvancedStructure: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estrutura-avancada`, {accessToken,cache:'no-store'}),
  championshipAdvancedAction: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estrutura-avancada`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  championshipFinalTeams: (id:string) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estatisticas/equipes`, {cache:'no-store'}),
  championshipFinalMvp: (id:string) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/estatisticas/mvp`, {cache:'no-store'}),
  championshipStreamKey: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/key`, {accessToken,cache:'no-store'}),
  ensureChampionshipStreamKey: (id:string, body:Record<string,unknown>={}, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/key`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  renameChampionshipStreamKey: (id:string, label:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/key`, {method:'PATCH',accessToken,body:JSON.stringify({label})}),
  revokeChampionshipStreamKey: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/key`, {method:'DELETE',accessToken}),
  championshipStreamPack: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/pack`, {accessToken,cache:'no-store'}),
  saveChampionshipStreamPack: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/pack`, {method:'PUT',accessToken,body:JSON.stringify(body)}),
  championshipStreamOverlays: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/overlays`, {accessToken,cache:'no-store'}),
  createChampionshipStreamOverlay: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/overlays`, {method:'POST',accessToken,body:JSON.stringify(body)}),
  updateChampionshipStreamOverlay: (id:string, overlayId:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/overlays/${encodeURIComponent(overlayId)}`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  deleteChampionshipStreamOverlay: (id:string, overlayId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/overlays/${encodeURIComponent(overlayId)}`, {method:'DELETE',accessToken}),
  championshipStreamData: (id:string, sheet:string='context', accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/stream/data?sheet=${encodeURIComponent(sheet)}`, {accessToken,cache:'no-store'}),
  broadcastMe: (accessToken?:string|null) => dropzoneFetch<any>('/api/broadcast/me', {accessToken,cache:'no-store'}),
  championshipCalls: (id:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls`, {accessToken,cache:'no-store'}),
  createChampionshipCall: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls`, {method:'POST',accessToken,body:JSON.stringify({action:'create_call',...body})}),
  assignChampionshipCall: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls`, {method:'POST',accessToken,body:JSON.stringify({action:'assign',...body})}),
  updateChampionshipCall: (id:string, body:Record<string,unknown>, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls`, {method:'PATCH',accessToken,body:JSON.stringify(body)}),
  deleteChampionshipCall: (id:string, callId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls?call_id=${encodeURIComponent(callId)}`, {method:'DELETE',accessToken}),
  deleteChampionshipCallAssignment: (id:string, vinculoId:string, accessToken?:string|null) => dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(id)}/calls?vinculo_id=${encodeURIComponent(vinculoId)}`, {method:'DELETE',accessToken}),
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
  markAllNotificationsRead: (includeActionable=false, accessToken?:string|null) =>
    dropzoneFetch<{ok:boolean;setup_required?:boolean}>('/api/notificacoes', {
      method:'PATCH',
      body:JSON.stringify({mark_all_read:true,include_actionable:includeActionable}),
      accessToken,
    }),
  archiveNotification: (id:string, accessToken?:string|null) =>
    dropzoneFetch<{ok:boolean}>(`/api/notificacoes?id=${encodeURIComponent(id)}`, {
      method:'DELETE',
      accessToken,
    }),
  archiveAllReadNotifications: (accessToken?:string|null) =>
    dropzoneFetch<{ok:boolean;setup_required?:boolean}>('/api/notificacoes?all_read=1', {
      method:'DELETE',
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


export async function executeQuickTokenAction(result:QuickTokenResult, accessToken:string){
  const token=encodeURIComponent(result.token)
  if(result.kind==='lineup'){
    return dropzoneFetch<any>(`/api/escalacoes/${token}`, {method:'POST',accessToken,body:JSON.stringify({})})
  }
  if(result.kind==='team_roster_invite'){
    return dropzoneFetch<any>(`/api/equipes/convites-elenco/${token}`, {method:'POST',accessToken,body:JSON.stringify({})})
  }
  if(result.kind==='seller_invite'){
    return dropzoneFetch<any>(`/api/vendedores/convite/${token}`, {method:'POST',accessToken,body:JSON.stringify({})})
  }
  throw new Error('Este token exige informações adicionais e ainda precisa do fluxo detalhado.')
}

export function supportsNativeQuickTokenAction(kind:QuickTokenKind){
  return kind==='lineup'||kind==='team_roster_invite'||kind==='seller_invite'
}


export function supportsDetailedQuickTokenAction(kind:QuickTokenKind){
  return kind==='team_championship_invite'||kind==='group_registration'||kind==='player_registration'
}

function quickTokenApiPath(result:QuickTokenResult){
  const token=encodeURIComponent(result.token)
  if(result.kind==='team_championship_invite') return `/api/convites/equipe/${token}`
  if(result.kind==='group_registration') return `/api/convites/grupo/${token}`
  if(result.kind==='player_registration') return `/api/dropzone/public/inscricao/${token}`
  if(result.kind==='lineup') return `/api/escalacoes/${token}`
  if(result.kind==='team_roster_invite') return `/api/equipes/convites-elenco/${token}`
  return `/api/vendedores/convite/${token}`
}

export async function reloadQuickTokenPayload(result:QuickTokenResult, accessToken?:string|null, equipeId?:string|null){
  const base=quickTokenApiPath(result)
  const suffix=equipeId?`${base}?equipe_id=${encodeURIComponent(equipeId)}`:base
  return dropzoneFetch<any>(suffix,{accessToken,cache:'no-store'})
}

export async function executeDetailedQuickTokenAction(
  result:QuickTokenResult,
  body:Record<string,unknown>,
  accessToken:string,
){
  if(!supportsDetailedQuickTokenAction(result.kind)) throw new Error('Este token não usa o formulário detalhado.')
  return dropzoneFetch<any>(quickTokenApiPath(result),{
    method:'POST',
    accessToken,
    body:JSON.stringify(body),
  })
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
