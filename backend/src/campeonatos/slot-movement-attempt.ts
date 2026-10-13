import { participationUuid } from './participation-contract'
import { slotMovementIntent, type SlotMovementIntent } from './slot-movement-contract'
export type SlotMovementAttempt = { requestId: string; storageKey: string; body: SlotMovementIntent }
export function createSlotMovementAttempts(storage: {
  get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void>;
  hash: (value: string) => Promise<string>; uuid: () => string;
}) {
  const preparing = new Map<string, Promise<SlotMovementAttempt>>()
  const key = async (actor: string, championship: string) => 'dz.slot_movement.v1.' + await storage.hash(JSON.stringify([1, participationUuid(actor), participationUuid(championship)]))
  function parse(saved: string, storageKey: string): SlotMovementAttempt {
    const record = JSON.parse(saved)
    if (record.version !== 1) throw new Error('Invalid record')
    return { requestId: participationUuid(record.requestId), storageKey, body: slotMovementIntent(record.body) }
  }
  async function read(actor: string, championship: string) {
    try { const storageKey = await key(actor, championship), saved = await storage.get(storageKey); return saved ? parse(saved, storageKey) : null }
    catch { throw new Error('Não foi possível ler a movimentação pendente. Verifique o armazenamento.') }
  }
  async function prepare(actor: string, championship: string, body: unknown) {
    const intent = slotMovementIntent(body)
    let storageKey: string
    try { storageKey = await key(actor, championship) } catch { throw new Error('Não foi possível guardar a movimentação. Verifique o armazenamento.') }
    let operation = preparing.get(storageKey)
    if (!operation) {
      operation = (async () => {
        try {
          const saved = await storage.get(storageKey)
          if (saved) return parse(saved, storageKey)
          const requestId = participationUuid(storage.uuid()), record = JSON.stringify({ version: 1, requestId, body: intent })
          await storage.set(storageKey, record)
          if (await storage.get(storageKey) !== record) throw new Error('Not persisted')
          return { requestId, storageKey, body: intent }
        } catch { throw new Error('Não foi possível guardar a movimentação. Verifique o armazenamento.') }
      })()
      preparing.set(storageKey, operation)
    }
    try {
      const attempt = await operation
      if (JSON.stringify(attempt.body) !== JSON.stringify(intent)) throw new Error('Confirme a movimentação pendente antes de iniciar outra.')
      return attempt
    } finally { if (preparing.get(storageKey) === operation) preparing.delete(storageKey) }
  }
  async function discard(attempt: SlotMovementAttempt) {
    const saved = await storage.get(attempt.storageKey)
    if (saved && parse(saved, attempt.storageKey).requestId === attempt.requestId) {
      await storage.remove(attempt.storageKey)
      if (await storage.get(attempt.storageKey)) throw new Error('Não foi possível encerrar a movimentação. Verifique o armazenamento.')
    }
  }
  async function complete(attempt: SlotMovementAttempt) { try { await discard(attempt) } catch { /* Retained intent replays the receipt. */ } }
  return { read, prepare, discard, complete }
}
