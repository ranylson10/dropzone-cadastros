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
  createLineupInvite: (campeonatoEquipeId: string, accessToken?: string | null) =>
    dropzoneFetch<{ token: string; public_url: string; texto: string }>('/api/equipe/escalacoes', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ campeonato_equipe_id: campeonatoEquipeId }),
    }),
  wallet: (accessToken?: string | null) =>
    dropzoneFetch<{ carteira?: unknown; lancamentos?: unknown[]; pagamentos?: unknown[]; saques?: unknown[]; perfil?: unknown }>('/api/me/carteira', {
      accessToken,
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
  sellerSales: (managerId: string, accessToken?: string | null) =>
    dropzoneFetch<{ sales: unknown[]; asaas_configured?: boolean; paypal_configured?: boolean }>(`/api/vendedores/${encodeURIComponent(managerId)}/vendas`, {
      accessToken,
      cache: 'no-store',
    }),
  producerSellers: (accessToken?: string | null) =>
    dropzoneFetch<{ vendedores?: unknown[]; produtora?: unknown }>('/api/produtora/vendedores', {
      accessToken,
      cache: 'no-store',
    }),
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
