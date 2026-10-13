import { supabase } from './supabase-browser'
import { participationAttempts } from './participation-write'
import { slotMovementAttempts } from './slot-movement-attempt'
import { runChampionshipOperation } from './championship-operation'
import { participationUuid } from '@backend/campeonatos/participation-contract'
import { assertSlotMovementConfirmed, slotMovementIntent, slotMovementMode, type SlotMovementReadContract } from '@backend/campeonatos/slot-movement-contract'
export { slotMovementAttempts }
export type { SlotMovementReadContract }
export async function slotMovementSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id || !data.session.access_token) throw new Error('Entre novamente para confirmar a movimentação.')
  return { actor: data.session.user.id, token: data.session.access_token }
}
export function notifySlotMovementAttempt() { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dz:slot-movement-attempt')) }
export async function writeSlotMovement(championship: string, contract: SlotMovementReadContract, body: Record<string, unknown>) {
  championship = participationUuid(championship)
  const mode = slotMovementMode(contract), { actor } = await slotMovementSession()
  if ((mode === 'atomic' || contract.slot_movement_actor_id != null) && contract.slot_movement_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
  const intent = mode === 'atomic' ? slotMovementIntent(body) : body
  return runChampionshipOperation(actor, championship, JSON.stringify(['movement', mode, intent]), mode === 'atomic', async () => {
    try {
      if (await participationAttempts.read(actor, championship)) throw new Error('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de movimentar equipes.')
      if (mode === 'legacy' && await slotMovementAttempts.read(actor, championship)) throw new Error('Confira a movimentação pendente antes de iniciar outra.')
      const attempt = mode === 'atomic' ? await slotMovementAttempts.prepare(actor, championship, intent) : null
      const current = await slotMovementSession()
      if (current.actor !== actor) throw new Error('A conta mudou. Abra novamente o campeonato antes de confirmar.')
      const response = await fetch(`/api/campeonatos/${encodeURIComponent(championship)}/equipes${attempt ? '/movimentacao-atomica' : ''}`, { method: 'PATCH', cache: 'no-store', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${current.token}`, ...(attempt ? { 'Idempotency-Key': attempt.requestId } : {}),
      }, body: JSON.stringify(attempt ? attempt.body : intent) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível concluir a movimentação.')
      if (attempt) { assertSlotMovementConfirmed(result, championship, attempt.body); await slotMovementAttempts.complete(attempt) }
      else if (result?.ok !== true) throw new Error('Não foi possível confirmar a movimentação. Confira o acompanhamento.')
      return result
    } finally { notifySlotMovementAttempt() }
  })
}
