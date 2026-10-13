import { dropzoneFetch } from './api'
import { participationAttempts } from './participation-attempt'
import { readPendingMobileSlotTransfer } from './slot-transfer-attempt'
import { championshipSession } from './championship-session'
import { runChampionshipOperation } from '../../../backend/src/campeonatos/championship-operation'
import { participationMode, participationIntent, assertParticipationConfirmed, participationUuid,
  type ParticipationIntent, type ParticipationReadContract } from '../../../backend/src/campeonatos/participation-contract'
export type { ParticipationAttempt } from '../../../backend/src/campeonatos/participation-attempt'
export type { ParticipationReadContract, ParticipationIntent } from '../../../backend/src/campeonatos/participation-contract'
export { participationAttempts }
export async function writeMobileParticipation(championship: string, contract: ParticipationReadContract,
  method: ParticipationIntent['method'], body: Record<string, unknown>, token: string | null | undefined, actor: string | undefined, removalId?: string) {
  championship = participationUuid(championship)
  const mode = participationMode(contract)
  if (!token || !actor) throw new Error('Entre novamente para confirmar a inscrição.')
  actor = participationUuid(actor)
  if ((mode === 'atomic' || contract.participation_actor_id != null) && contract.participation_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
  await championshipSession(actor)
  const intent = mode === 'atomic' ? participationIntent(method, body, removalId) : { method, body, participationId: removalId || null }
  return runChampionshipOperation(actor, championship, JSON.stringify(['participation', mode, intent]), mode === 'atomic', async () => {
    if (await readPendingMobileSlotTransfer(actor!, championship)) throw new Error('Há uma movimentação aguardando confirmação. Confira o acompanhamento antes de alterar inscrições.')
    const pending = await participationAttempts.read(actor!, championship)
    if (mode === 'legacy' && pending) throw new Error('Há uma inscrição aguardando confirmação. Confira o acompanhamento antes de encerrar a tentativa anterior.')
    const attempt = mode === 'atomic' ? await participationAttempts.prepare(actor!, championship, intent) : null
    const current = await championshipSession(actor!)
    const url = `/api/campeonatos/${encodeURIComponent(championship)}/equipes`
      + (attempt ? '/participacao-atomica' : '')
      + (method === 'DELETE' ? `?participacao_id=${encodeURIComponent(intent.participationId!)}` : '')
    const result = await dropzoneFetch<any>(url, { method, accessToken: current.token, cache: 'no-store',
      headers: attempt ? { 'Idempotency-Key': attempt.requestId } : {}, body: JSON.stringify(intent.body) })
    if (attempt) { assertParticipationConfirmed(result, championship, intent); await participationAttempts.complete(attempt) }
    else if (result?.ok !== true) throw new Error('Não foi possível confirmar a inscrição. Confira o acompanhamento.')
    return result
  })
}
