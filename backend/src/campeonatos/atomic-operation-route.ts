import { participationWriteMode } from './participation-transport'
import { slotMovementMode, SlotTransferError } from './slot-transfer'

export type AtomicOperationFamily = 'participation' | 'movement'
export const atomicOperationHeader = 'X-DropZone-Atomic-Operation'

/** Called after bearer authentication, before body parsing or any legacy reads/writes. */
export function requireAtomicOperation(headers: Headers, method: string): AtomicOperationFamily | null {
  const family = headers.get(atomicOperationHeader)
  if (family === null) return null
  if (family !== 'participation' && family !== 'movement') throw new SlotTransferError('Contrato de operação inválido.')
  if (family === 'movement' ? method !== 'PATCH' : !['POST', 'PATCH', 'DELETE'].includes(method)) {
    throw new SlotTransferError('Método de operação inválido.')
  }
  const mode = family === 'participation' ? participationWriteMode() : slotMovementMode()
  if (mode !== 'atomic') throw new SlotTransferError('Esta operação aguarda a reativação do modo transacional. Confira o acompanhamento antes de repetir.', 503)
  return family
}

/** A family-specific endpoint must never dispatch into another family's legacy path. */
export function assertAtomicOperationBody(family: AtomicOperationFamily | null, method: string, body: unknown) {
  if (!family) return
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SlotTransferError('Dados de operação inválidos.')
  const mode = (body as Record<string, unknown>).mode
  if (method === 'POST' && family === 'participation' && mode != null && mode !== 'request') {
    throw new SlotTransferError('Operação incompatível com este contrato.')
  }
  if (method === 'PATCH' && (family === 'participation' ? mode !== 'review_request' : !['move', 'swap', 'shuffle_group', 'distribute_phase'].includes(String(mode)))) {
    throw new SlotTransferError('Operação incompatível com este contrato.')
  }
}
