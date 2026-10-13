import * as Crypto from 'expo-crypto'
import { secureStorage } from './secureStorage'

export type SlotTransferIntent = {
  mode: 'move' | 'swap'; source_slot_id: string; target_slot_id: string;
  source_participation_id: string; target_participation_id: string | null;
}
export type SlotTransferAttempt = { requestId: string; storageKey: string; body: SlotTransferIntent }
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const pending = new Map<string, Promise<SlotTransferAttempt>>()
function uuid(value: unknown) {
  if (typeof value !== 'string' || !uuidPattern.test(value.trim())) throw new Error('Atualize os slots antes de confirmar a movimentação.')
  return value.trim().toLowerCase()
}
export function slotTransferIntent(body: Record<string, unknown>): SlotTransferIntent {
  if (!body || !['move', 'swap'].includes(String(body.mode))) throw new Error('Movimentação inválida.')
  const result = {
    mode: body.mode as 'move' | 'swap', source_slot_id: uuid(body.source_slot_id), target_slot_id: uuid(body.target_slot_id),
    source_participation_id: uuid(body.source_participation_id),
    target_participation_id: body.target_participation_id == null || body.target_participation_id === '' ? null : uuid(body.target_participation_id),
  }
  if (result.source_slot_id === result.target_slot_id || (result.mode === 'move' && result.target_participation_id)
    || (result.mode === 'swap' && (!result.target_participation_id || result.target_participation_id === result.source_participation_id))) {
    throw new Error('Movimentação inválida.')
  }
  return result
}
async function storageKey(actorId: string, championshipId: string) {
  const actor = uuid(actorId), championship = uuid(championshipId)
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify([1,actor,championship]))
  return `dz.slot_transfer.v1.${hash}`
}
function parse(saved: string, key: string): SlotTransferAttempt {
  const value = JSON.parse(saved)
  return { requestId: uuid(value.requestId), storageKey: key, body: slotTransferIntent(value.body) }
}
/** Stores only UUIDs and the original intent; never session tokens, names or payment data. */
export async function readPendingMobileSlotTransfer(actorId: string, championshipId: string): Promise<SlotTransferAttempt | null> {
  try {
    const key = await storageKey(actorId, championshipId), saved = await secureStorage.getItem(key)
    return saved ? parse(saved,key) : null
  } catch { throw new Error('Não foi possível ler a movimentação pendente. Verifique o armazenamento do aparelho.') }
}
export async function prepareMobileSlotTransfer(actorId: string, championshipId: string, body: Record<string, unknown>) {
  if (!actorId) throw new Error('Entre novamente para confirmar a movimentação.')
  const intent = slotTransferIntent(body)
  let key: string
  try { key = await storageKey(actorId, championshipId) }
  catch { throw new Error('Não foi possível guardar esta movimentação no aparelho.') }
  const previous = pending.get(key)
  if (previous) {
    const attempt = await previous
    if (JSON.stringify(attempt.body) !== JSON.stringify(intent)) throw new Error('Confirme o resultado da movimentação pendente antes de iniciar outra.')
    return attempt
  }
  const operation = (async () => {
    let attempt: SlotTransferAttempt
    try {
      const saved = await secureStorage.getItem(key)
      attempt = saved ? parse(saved,key) : { requestId: Crypto.randomUUID(), storageKey: key, body: intent }
      if (!saved) {
        const record = JSON.stringify({ requestId: attempt.requestId, body: intent })
        await secureStorage.setItem(key,record)
        if (await secureStorage.getItem(key) !== record) throw new Error('Not persisted')
      }
    } catch { throw new Error('Não foi possível guardar esta movimentação no aparelho. Verifique o armazenamento.') }
    if (JSON.stringify(attempt.body) !== JSON.stringify(intent)) throw new Error('Confirme o resultado da movimentação pendente antes de iniciar outra.')
    return attempt
  })()
  pending.set(key,operation)
  try { return await operation } finally { if (pending.get(key) === operation) pending.delete(key) }
}
export async function completeMobileSlotTransfer(attempt: SlotTransferAttempt) {
  try {
    await forgetPendingMobileSlotTransfer(attempt)
  } catch { /* The retained intent can safely replay its receipt. */ }
}

/** Explicit local discard after reviewing the board; never undoes the server operation. */
export async function forgetPendingMobileSlotTransfer(attempt: SlotTransferAttempt) {
  const saved = await secureStorage.getItem(attempt.storageKey)
  if (saved && parse(saved,attempt.storageKey).requestId === attempt.requestId) {
    await secureStorage.removeItem(attempt.storageKey)
    if (await secureStorage.getItem(attempt.storageKey)) throw new Error('Não foi possível encerrar a movimentação. Verifique o armazenamento do aparelho.')
  }
}
