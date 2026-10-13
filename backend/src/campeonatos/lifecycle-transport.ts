import { supabaseAdmin } from '../shared/supabase-admin'
import { operationUuid } from '../shared/operation-json'
import { SlotTransferError } from './slot-transfer'
import { lifecycleIntent, assertLifecycleResponse } from './lifecycle-contract'

export function lifecycleMode(): 'unavailable' | 'atomic' {
  const value = process.env.LIFECYCLE_WRITE_MODE?.trim() || 'legacy'
  if (value !== 'legacy' && value !== 'atomic') throw new SlotTransferError('Encerramento temporariamente indisponível.', 503)
  return value === 'atomic' ? 'atomic' : 'unavailable'
}
export async function tryAtomicLifecycle(actor: string, champ: string, value: any, key: unknown) {
  if (!['publish_final','reopen_final','preview_publish_final','preview_reopen_final'].includes(value?.action)) return null
  if (lifecycleMode() !== 'atomic') throw new SlotTransferError('Encerramento e reabertura temporariamente indisponíveis.', 503)
  let request: string, body: { action: string; expected?: any }
  try {
    actor = operationUuid(actor); champ = operationUuid(champ); request = operationUuid(key)
    body = value.action.startsWith('preview_') ? { action: value.action, expected: {} } : lifecycleIntent(value)
  } catch { throw new SlotTransferError('Confira a prévia e a chave de confirmação.') }
  const args = { p_actor_id: actor, p_request_id: request, p_campeonato_id: champ, p_action: body.action, p_expected: body.expected }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 25000)
  const uncertain = () => new SlotTransferError('Não foi possível confirmar o resultado. Confira o histórico e repita a tentativa original.', 503, true)
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let result
      try { result = await supabaseAdmin.rpc('fn_lifecycle_atomico', args).abortSignal(controller.signal) } catch { throw uncertain() }
      if (result.error?.code === '40P01' && attempt === 0) continue
      if (result.error) {
        const code = result.error.code
        if (code === '42501') throw new SlotTransferError('Sem permissão para encerrar ou reabrir esta edição.', 403)
        if (['23505','23514','23503','40001','40P01','55P03'].includes(code)) throw new SlotTransferError('Os dados da edição mudaram. Confira antes de repetir.', 409)
        if (['22023','22P02','22003','54000'].includes(code)) throw new SlotTransferError('Não foi possível preparar esta edição. Confira quedas, classificação, configuração e histórico.')
        throw uncertain()
      }
      try { assertLifecycleResponse(result.data, actor, champ, request, body) } catch { throw uncertain() }
      return result.data
    }
    throw uncertain()
  } finally { clearTimeout(timeout) }
}
