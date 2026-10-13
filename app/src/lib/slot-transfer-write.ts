import { dropzoneFetch } from './api'
import { championshipSession } from './championship-session'
import { participationAttempts } from './participation-attempt'
import { prepareMobileSlotTransfer, readPendingMobileSlotTransfer, completeMobileSlotTransfer, slotTransferIntent } from './slot-transfer-attempt'
import { runChampionshipOperation } from '../../../backend/src/campeonatos/championship-operation'
import { participationUuid } from '../../../backend/src/campeonatos/participation-contract'
import { slotMovementMode, assertSlotMovementConfirmed, type SlotMovementReadContract } from '../../../backend/src/campeonatos/slot-movement-contract'
export async function writeMobileSlotTransfer(championship: string, contract: SlotMovementReadContract, body: Record<string, unknown>, token?: string | null, actor?: string) {
  championship = participationUuid(championship)
  if (!token || !actor) throw new Error('Entre novamente para confirmar a movimentação.')
  actor = participationUuid(actor)
  const mode = slotMovementMode(contract)
  if ((mode === 'atomic' || contract.slot_movement_actor_id != null) && contract.slot_movement_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
  await championshipSession(actor)
  const intent = slotTransferIntent(body)
  return runChampionshipOperation(actor, championship, JSON.stringify(['movement', mode, intent]), mode === 'atomic', async () => {
    if (await participationAttempts.read(actor!, championship)) throw new Error('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de movimentar equipes.')
    if (mode === 'legacy' && await readPendingMobileSlotTransfer(actor!, championship)) throw new Error('Confira a movimentação pendente antes de iniciar outra.')
    const attempt = mode === 'atomic' ? await prepareMobileSlotTransfer(actor!, championship, intent) : null
    const current = await championshipSession(actor!)
    const result = await dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(championship)}/equipes${attempt ? '/movimentacao-atomica' : ''}`, {
      method: 'PATCH', accessToken: current.token, cache: 'no-store',
      headers: attempt ? { 'Idempotency-Key': attempt.requestId } : {}, body: JSON.stringify(attempt ? attempt.body : intent),
    })
    if (attempt) { assertSlotMovementConfirmed(result, championship, attempt.body); await completeMobileSlotTransfer(attempt) }
    else if (result?.ok !== true) throw new Error('Não foi possível confirmar a movimentação. Confira o acompanhamento.')
    return result
  })
}
