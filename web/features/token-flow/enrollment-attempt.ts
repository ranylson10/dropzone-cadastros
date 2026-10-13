type Attempt = { requestId: string; storageKey: string }
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export class EnrollmentAttemptError extends Error {}

/** Persist before sending. Reloading this tab or retrying the same intent keeps the UUID. */
export async function prepareEnrollmentAttempt(actorId: string, kind: 'team' | 'group', token: string, body: Record<string, unknown>): Promise<Attempt> {
  if (!actorId) throw new EnrollmentAttemptError('Entre novamente para confirmar a inscrição.')
  try {
    // Store only a digest and UUID: no access token, invite token, names or enrollment data.
    const clean = (value: unknown) => typeof value === 'string' ? value.trim() || null : value ?? null
    const fingerprint = JSON.stringify([1, actorId, kind, token.trim(), clean(body.equipe_id), clean(body.line_id),
      body.line_id ? null : clean(body.nome_line), clean(body.slot_id), clean(body.vaga_index),
      clean(body.referencia_equipe || body.nome_lista)])
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const storageKey = `dz_enrollment_attempt_v1:${hash}`
    const saved = sessionStorage.getItem(storageKey)
    if (saved) {
      if (!uuidPattern.test(saved)) throw new Error('Invalid saved attempt')
      return { requestId: saved, storageKey }
    }
    const requestId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, requestId)
    if (sessionStorage.getItem(storageKey) !== requestId) throw new Error('Attempt not persisted')
    return { requestId, storageKey }
  } catch {
    // An in-memory fallback would lose the key after a response timeout followed by a reload.
    throw new EnrollmentAttemptError('Seu navegador não conseguiu guardar esta tentativa. Permita armazenamento nesta aba e tente novamente.')
  }
}

/** Only a confirmed success retires the attempt. Errors/aborts/unknown responses keep it. */
export function completeEnrollmentAttempt(attempt: Attempt) {
  try {
    if (sessionStorage.getItem(attempt.storageKey) === attempt.requestId) sessionStorage.removeItem(attempt.storageKey)
  } catch { /* Keeping a completed key is safe: the RPC returns its receipt on replay. */ }
}
