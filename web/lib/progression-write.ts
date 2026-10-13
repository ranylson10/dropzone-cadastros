import { supabase } from './supabase-browser'
import { runChampionshipOperation } from './championship-operation'
import { createProgressionAttempts } from '@backend/campeonatos/progression-attempt'
import { progressionIntent, progressionJson, progressionMode, progressionUuid, assertProgressionResponse, type ProgressionReadContract } from '@backend/campeonatos/progression-contract'
export const progressionAttempts = createProgressionAttempts({
  get: async key => sessionStorage.getItem(key), set: async (key, value) => { sessionStorage.setItem(key, value) },
  remove: async key => { sessionStorage.removeItem(key) }, uuid: () => crypto.randomUUID(),
  hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join(''),
})
async function session() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id || !data.session.access_token) throw new Error('Entre novamente para confirmar a progressão.')
  return { actor: data.session.user.id, token: data.session.access_token }
}
export function notifyProgressionAttempt(actor: string, championship: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dz:progression-attempt', { detail: { actor, championship } }))
}
export async function writeProgression(championship: string, contract: ProgressionReadContract, value: Record<string, any>, assertCurrent: () => void = () => {}) {
  championship = progressionUuid(championship)
  const { actor } = await session(), mode = progressionMode(contract), preview = value.action === 'preview_progression'
  if ((mode === 'atomic' || contract.progression_actor_id != null) && contract.progression_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
  assertCurrent()
  const body = preview ? { action: value.action, rule_id: progressionUuid(value.rule_id) }
    : mode === 'atomic' ? progressionIntent(value)
    : value.action === 'apply_progression' ? { action: value.action, rule_id: progressionUuid(value.rule_id), replace_conflicts: Boolean(value.replace_conflicts) }
    : progressionIntent(value)
  return runChampionshipOperation(actor, championship, progressionJson(['progression', mode, body]), mode === 'atomic', async () => {
    try {
      const pending = await progressionAttempts.read(actor, championship)
      if (pending && (mode === 'legacy' || preview)) throw new Error('Há uma progressão aguardando confirmação. Repita a tentativa original antes de iniciar outra.')
      const attempt = mode === 'atomic' && !preview ? await progressionAttempts.prepare(actor, championship, body) : null
      const current = await session()
      if (current.actor !== actor) throw new Error('A conta mudou. Abra novamente o campeonato antes de confirmar.')
      assertCurrent()
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000)
      let response: Response, result: any
      try {
        response = await fetch(`/api/campeonatos/${encodeURIComponent(championship)}/estrutura-avancada${mode === 'atomic' ? '/progressao-atomica' : ''}`, {
          method: 'POST', cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/json',
            ...(attempt ? { 'Idempotency-Key': attempt.requestId } : {}) }, body: JSON.stringify(body),
        })
        result = await response.json().catch(() => null)
      } catch { throw new Error('Não foi possível confirmar a progressão. Confira o acompanhamento e repita a tentativa original.') }
      finally { clearTimeout(timeout) }
      if (!response.ok) throw new Error(result?.error || 'Não foi possível confirmar a progressão. Confira o acompanhamento.')
      if (mode === 'atomic') { assertProgressionResponse(result, actor, championship, body, attempt?.requestId); if (attempt) await progressionAttempts.complete(attempt) }
      else if (result?.ok !== true) throw new Error('Não foi possível confirmar a progressão. Confira o acompanhamento.')
      return result
    } finally { notifyProgressionAttempt(actor, championship) }
  })
}
