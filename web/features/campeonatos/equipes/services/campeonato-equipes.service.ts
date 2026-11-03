import { supabase } from '@/lib/supabase-browser'
import { writeParticipation, type ParticipationReadContract } from '@/lib/participation-write'

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

// Mesma chave na repetição de uma operação incerta. NÃO gerar outra UUID
// só porque o POST concluiu mas o refresh da interface falhou.
const inviteOperationKeys = new Map<string, string>()
function inviteOperationKey(campeonatoId: string, tokenId: string, action: 'renew' | 'cancel') {
  const key = JSON.stringify([campeonatoId, tokenId, action])
  const existing = inviteOperationKeys.get(key)
  if (existing) return existing
  if (!globalThis.crypto?.randomUUID) throw new Error('Navegador sem suporte a chave de repetição.')
  const generated = globalThis.crypto.randomUUID()
  // Bounded memory: the old invite IDs cannot be modified again after success.
  if (inviteOperationKeys.size >= 200) inviteOperationKeys.delete(inviteOperationKeys.keys().next().value!)
  inviteOperationKeys.set(key, generated)
  return generated
}
async function mutateInvite(campeonatoId: string, tokenId: string, action: 'renew' | 'cancel') {
  const url = `/api/campeonatos/${campeonatoId}/convites-equipe/${tokenId}`
  const key = inviteOperationKey(campeonatoId, tokenId, action)
  return request(action === 'renew' ? `${url}/renovar` : url, {
    method: action === 'renew' ? 'POST' : 'DELETE',
    headers: { 'Idempotency-Key': key },
  })
}

export const campeonatoEquipesService = {
  listar: (campeonatoId: string) => request(`/api/campeonatos/${campeonatoId}/equipes`),
  buscarEquipes: (campeonatoId: string, termo: string) => request(`/api/campeonatos/${campeonatoId}/equipes/busca?q=${encodeURIComponent(termo)}`),
  adicionar: (campeonatoId: string, body: Record<string, unknown>, contract: ParticipationReadContract) => writeParticipation(campeonatoId, contract, 'POST', body),
  listarHistoricas: (campeonatoId: string) => request(`/api/campeonatos/${campeonatoId}/equipes/historicas`),
  criarHistoricasEmBloco: (campeonatoId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/equipes/historicas`, { method: 'POST', body: JSON.stringify(body) }),
  prepararLiga: (campeonatoId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/estrutura`, { method: 'POST', body: JSON.stringify(body) }),
  remover: (campeonatoId: string, participacaoId: string, contract: ParticipationReadContract, expected?: unknown) => writeParticipation(campeonatoId, contract, 'DELETE', { expected }, participacaoId),
  criarConvite: (campeonatoId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/convites-equipe`, { method: 'POST', body: JSON.stringify(body) }),
  renovarConvite: (campeonatoId: string, tokenId: string) => mutateInvite(campeonatoId, tokenId, 'renew'),
  editarConvite: (campeonatoId: string, tokenId: string, body: unknown) => request(`/api/campeonatos/${campeonatoId}/convites-equipe/${tokenId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancelarConvite: (campeonatoId: string, tokenId: string) => mutateInvite(campeonatoId, tokenId, 'cancel'),
}
