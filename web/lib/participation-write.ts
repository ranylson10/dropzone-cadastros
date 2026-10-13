import { supabase } from './supabase-browser'
import { slotMovementAttempts } from './slot-movement-attempt'
import { runChampionshipOperation } from './championship-operation'
import { createParticipationAttempts, type ParticipationAttempt } from '@backend/campeonatos/participation-attempt'
import { assertParticipationConfirmed, participationIntent, participationMode, participationUuid,
  type ParticipationIntent, type ParticipationReadContract } from '@backend/campeonatos/participation-contract'
export type { ParticipationAttempt, ParticipationReadContract, ParticipationIntent }

export const participationAttempts = createParticipationAttempts({
  get: async key => sessionStorage.getItem(key), set: async (key, value) => { sessionStorage.setItem(key, value) },
  remove: async key => { sessionStorage.removeItem(key) }, uuid: () => crypto.randomUUID(),
  hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join(''),
})
export async function participationSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id || !data.session.access_token) throw new Error('Entre novamente para confirmar a inscrição.')
  return { actor: data.session.user.id, token: data.session.access_token }
}
export function notifyParticipationAttempt(actor: string, championship: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dz:participation-attempt', { detail: { actor, championship } }))
}
export async function writeParticipation(championship: string, contract: ParticipationReadContract,
  method: ParticipationIntent['method'], body: Record<string, unknown>, removalId?: string) {
  championship = participationUuid(championship)
  const mode = participationMode(contract), { actor } = await participationSession()
  if ((mode === 'atomic' || contract.participation_actor_id != null) && contract.participation_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
  const intent = mode === 'atomic' ? participationIntent(method, body, removalId) : { method, body, participationId: removalId || null }
  return runChampionshipOperation(actor, championship, JSON.stringify(['participation', mode, intent]), mode === 'atomic', async () => {
    try {
      if (await slotMovementAttempts.read(actor, championship)) throw new Error('Há uma movimentação aguardando confirmação. Confira o acompanhamento antes de alterar inscrições.')
      const pending = await participationAttempts.read(actor, championship)
      if (mode === 'legacy' && pending) throw new Error('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de encerrar a tentativa anterior.')
      const attempt = mode === 'atomic' ? await participationAttempts.prepare(actor, championship, intent) : null
      const current = await participationSession()
      if (current.actor !== actor) throw new Error('A conta mudou. Abra novamente o campeonato antes de confirmar.')
      const url = `/api/campeonatos/${encodeURIComponent(championship)}/equipes`
        + (attempt ? '/participacao-atomica' : '')
        + (method === 'DELETE' ? `?participacao_id=${encodeURIComponent(intent.participationId!)}` : '')
      const response = await fetch(url, { method, cache: 'no-store', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${current.token}`,
        ...(attempt ? { 'Idempotency-Key': attempt.requestId } : {}),
      }, body: JSON.stringify(intent.body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível concluir a inscrição.')
      if (attempt) { assertParticipationConfirmed(result, championship, intent); await participationAttempts.complete(attempt) }
      else if (result?.ok !== true) throw new Error('Não foi possível confirmar a inscrição. Confira o acompanhamento.')
      return result
    } finally { notifyParticipationAttempt(actor, championship) }
  })
}
