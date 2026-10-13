import * as Crypto from 'expo-crypto'
import { secureStorage } from './secureStorage'

type Attempt = { requestId: string; storageKey: string }
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const pending = new Map<string, Promise<Attempt>>()

export async function prepareMobileEnrollmentAttempt(actorId: string, kind: 'team' | 'group', token: string, body: Record<string, unknown>): Promise<Attempt> {
  if (!actorId) throw new Error('Entre novamente para confirmar a inscrição.')
  try {
    const clean = (value: unknown) => typeof value === 'string' ? value.trim() || null : value ?? null
    const fingerprint = JSON.stringify([1, actorId, kind, token.trim(), clean(body.equipe_id), clean(body.line_id),
      body.line_id ? null : clean(body.nome_line), clean(body.slot_id), clean(body.vaga_index),
      clean(body.referencia_equipe || body.nome_lista)])
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint)
    const storageKey = `dz.enrollment.v1.${hash}`
    const existing = pending.get(storageKey)
    if (existing) return await existing
    const operation = (async () => {
      const saved = await secureStorage.getItem(storageKey)
      if (saved) {
        if (!uuidPattern.test(saved)) throw new Error('Invalid saved attempt')
        return { requestId: saved, storageKey }
      }
      const requestId = Crypto.randomUUID()
      await secureStorage.setItem(storageKey, requestId)
      if (await secureStorage.getItem(storageKey) !== requestId) throw new Error('Attempt not persisted')
      return { requestId, storageKey }
    })()
    pending.set(storageKey, operation)
    try { return await operation } finally { if (pending.get(storageKey) === operation) pending.delete(storageKey) }
  } catch {
    throw new Error('Não foi possível guardar esta tentativa no aparelho. Verifique o armazenamento e tente novamente.')
  }
}

export async function completeMobileEnrollmentAttempt(attempt: Attempt) {
  try {
    if (await secureStorage.getItem(attempt.storageKey) === attempt.requestId) await secureStorage.removeItem(attempt.storageKey)
  } catch { /* Retaining a completed key only replays its receipt. */ }
}
