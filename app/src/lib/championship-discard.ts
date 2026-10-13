import { championshipSession } from './championship-session'
import { participationAttempts } from './participation-attempt'
import { readPendingMobileSlotTransfer, forgetPendingMobileSlotTransfer, type SlotTransferAttempt } from './slot-transfer-attempt'
import type { ParticipationAttempt } from '../../../backend/src/campeonatos/participation-attempt'
import { runChampionshipOperation } from '../../../backend/src/campeonatos/championship-operation'
import { participationUuid } from '../../../backend/src/campeonatos/participation-contract'
/** Explicit local discard after board review. It never writes to the server. */
export async function discardMobileChampionshipAttempt(championship: string, actor: string, family: 'participation' | 'movement', attempt: ParticipationAttempt | SlotTransferAttempt) {
  championship = participationUuid(championship);actor = participationUuid(actor)
  await championshipSession(actor)
  return runChampionshipOperation(actor, championship, JSON.stringify(['discard', family, attempt.requestId]), false, async () => {
    const saved = family === 'participation' ? await participationAttempts.read(actor, championship) : await readPendingMobileSlotTransfer(actor, championship)
    if (!saved || saved.requestId !== attempt.requestId || saved.storageKey !== attempt.storageKey) throw new Error('A tentativa mudou. Confira novamente o acompanhamento.')
    await championshipSession(actor)
    if (family === 'participation') await participationAttempts.discard(attempt as ParticipationAttempt)
    else await forgetPendingMobileSlotTransfer(attempt as SlotTransferAttempt)
  })
}
