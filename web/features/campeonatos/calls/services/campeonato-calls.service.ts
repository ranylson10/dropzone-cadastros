import { supabase } from '@/lib/supabase-browser'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

export const campeonatoCallsService = {
  listar: (id: string) => request<any>(`/api/campeonatos/${id}/calls`),
  criarCall: (id: string, body: unknown) => request(`/api/campeonatos/${id}/calls`, { method: 'POST', body: JSON.stringify({ action: 'create_call', ...(body as object) }) }),
  vincular: (id: string, body: unknown) => request(`/api/campeonatos/${id}/calls`, { method: 'POST', body: JSON.stringify({ action: 'assign', ...(body as object) }) }),
  editarCall: (id: string, body: unknown) => request(`/api/campeonatos/${id}/calls`, { method: 'PATCH', body: JSON.stringify(body) }),
  excluirCall: (id: string, callId: string) => request(`/api/campeonatos/${id}/calls?call_id=${encodeURIComponent(callId)}`, { method: 'DELETE' }),
  removerVinculo: (id: string, vinculoId: string) => request(`/api/campeonatos/${id}/calls?vinculo_id=${encodeURIComponent(vinculoId)}`, { method: 'DELETE' }),
}
