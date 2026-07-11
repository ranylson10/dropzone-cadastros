import { supabase } from '@/lib/supabase-browser'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

export const campeonatoEquipesService = {
  listar: (campeonatoId: string) => request(`/api/campeonatos/${campeonatoId}/equipes`),
  buscarEquipes: (campeonatoId: string, termo: string) => request(`/api/campeonatos/${campeonatoId}/equipes/busca?q=${encodeURIComponent(termo)}`),
  adicionar: (campeonatoId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/equipes`, { method: 'POST', body: JSON.stringify(body) }),
  remover: (campeonatoId: string, participacaoId: string) => request(`/api/campeonatos/${campeonatoId}/equipes?participacao_id=${encodeURIComponent(participacaoId)}`, { method: 'DELETE' }),
  criarConvite: (campeonatoId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/convites-equipe`, { method: 'POST', body: JSON.stringify(body) }),
  renovarConvite: (campeonatoId: string, tokenId: string) => request(`/api/campeonatos/${campeonatoId}/convites-equipe/${tokenId}/renovar`, { method: 'POST' }),
  cancelarConvite: (campeonatoId: string, tokenId: string) => request(`/api/campeonatos/${campeonatoId}/convites-equipe/${tokenId}`, { method: 'DELETE' }),
}
