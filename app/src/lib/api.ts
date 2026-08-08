import { apiUrl } from '@/config/env'

type RequestOptions = RequestInit & {
  accessToken?: string | null
}

export async function dropzoneFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Não foi possível concluir a ação.')
  }
  return json as T
}

export const mobileApi = {
  vacancies: () => dropzoneFetch<{ announcements: unknown[]; authenticated: boolean; hasTeam: boolean }>('/api/vagas'),
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
