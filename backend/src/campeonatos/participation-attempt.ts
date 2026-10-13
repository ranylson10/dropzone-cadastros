import { participationIntent, participationUuid, type ParticipationIntent } from './participation-contract'

export type ParticipationAttempt = ParticipationIntent & { requestId: string; storageKey: string }
type StorageAdapter = {
  get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>; hash: (value: string) => Promise<string>; uuid: () => string;
}
/** One original intent per account/championship. Adapters never persist credentials. */
export function createParticipationAttempts(storage: StorageAdapter) {
  const preparing = new Map<string, Promise<ParticipationAttempt>>()
  async function key(actor: string, championship: string) {
    return 'dz.participation.v1.' + await storage.hash(JSON.stringify([1, participationUuid(actor), participationUuid(championship)]))
  }
  function parse(value: string, storageKey: string): ParticipationAttempt {
    const record = JSON.parse(value)
    if (record.version !== 1) throw new Error('Invalid record')
    return { ...participationIntent(record.method, record.body, record.participationId), requestId: participationUuid(record.requestId), storageKey }
  }
  async function read(actor: string, championship: string) {
    try { const storageKey = await key(actor, championship), saved = await storage.get(storageKey); return saved ? parse(saved, storageKey) : null }
    catch { throw new Error('Não foi possível ler a inscrição pendente. Verifique o armazenamento.') }
  }
  async function prepare(actor: string, championship: string, value: ParticipationIntent) {
    const intent = participationIntent(value.method, value.body, value.participationId)
    let storageKey: string
    try { storageKey = await key(actor, championship) } catch { throw new Error('Não foi possível guardar a inscrição. Verifique o armazenamento.') }
    let operation = preparing.get(storageKey)
    if (!operation) {
      operation = (async () => {
        try {
          const saved = await storage.get(storageKey)
          if (saved) return parse(saved, storageKey)
          const requestId = participationUuid(storage.uuid()), record = JSON.stringify({ version: 1, requestId, ...intent })
          await storage.set(storageKey, record)
          if (await storage.get(storageKey) !== record) throw new Error('Not persisted')
          return { ...intent, storageKey, requestId }
        } catch { throw new Error('Não foi possível guardar a inscrição. Verifique o armazenamento.') }
      })()
      preparing.set(storageKey, operation)
    }
    try {
      const attempt = await operation
      if (JSON.stringify({ method: attempt.method, participationId: attempt.participationId, body: attempt.body }) !== JSON.stringify(intent)) {
        throw new Error('Confirme o resultado da inscrição pendente antes de iniciar outra.')
      }
      return attempt
    } finally { if (preparing.get(storageKey) === operation) preparing.delete(storageKey) }
  }
  async function discard(attempt: ParticipationAttempt) {
    const saved = await storage.get(attempt.storageKey)
    if (saved && parse(saved, attempt.storageKey).requestId === attempt.requestId) {
      await storage.remove(attempt.storageKey)
      if (await storage.get(attempt.storageKey)) throw new Error('Não foi possível encerrar a tentativa. Verifique o armazenamento.')
    }
  }
  async function complete(attempt: ParticipationAttempt) {
    try { await discard(attempt) } catch { /* Retained original intent can replay the confirmed receipt. */ }
  }
  return { read, prepare, discard, complete }
}
