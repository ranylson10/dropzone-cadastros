import { supabaseAdmin } from '../shared/supabase-admin'
import { SlotTransferError } from './slot-transfer'

const pattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const actions = { preview_progression: 'preview', apply_progression: 'apply', reverse_progression: 'reverse' } as const
function uuid(value: unknown) {
  if (typeof value !== 'string' || !pattern.test(value.trim())) throw new SlotTransferError('Identificador de progressão inválido.')
  return value.trim().toLowerCase()
}
function object(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function progressionWriteMode(): 'legacy' | 'atomic' {
  const mode = process.env.PROGRESSION_WRITE_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new SlotTransferError('Progressão temporariamente indisponível.', 503)
  return mode
}
function rpcError(error?: { code?: string; message?: string }) {
  if (error?.code === '42501') return new SlotTransferError('Sem permissão para esta progressão.', 403)
  if (['22023', '22P02', '54000', '22003'].includes(error?.code || '')) return new SlotTransferError('Dados ou acompanhamento de progressão inválidos. Atualize a prévia.')
  if (['23505', '23514', '23503', '40001', '40P01', '55P03', 'P0001'].includes(error?.code || '')) {
    return new SlotTransferError(error?.message === 'Execução anterior sem acompanhamento transacional. Revise antes de reverter.'
      ? error.message : 'A classificação, a estrutura ou os vínculos mudaram. Confira o acompanhamento antes de repetir.', 409)
  }
  if (['PGRST202', '42883'].includes(error?.code || '')) return new SlotTransferError('Progressão temporariamente indisponível.', 503)
  return new SlotTransferError('Não foi possível confirmar a progressão. Confira o acompanhamento e repita com os mesmos dados.', 503, true)
}
function assertPreview(value: unknown, rule: string) {
  if (!object(value) || !object(value.rule) || value.rule.id !== rule || !object(value.phase) || !pattern.test(value.phase.id || '')
    || !object(value.fence) || !object(value.fence.rule) || value.fence.rule.id !== rule || !Array.isArray(value.candidates)
    || !object(value.summary) || !Number.isSafeInteger(value.summary.selected) || value.summary.selected < 0
    || value.summary.selected !== value.candidates.length || value.candidates.length > 1000
    || new Set(value.candidates.map((row: any) => row?.campeonato_equipe_id)).size !== value.candidates.length
    || !value.candidates.every((row: any) => object(row) && pattern.test(row.campeonato_equipe_id || '') && Number.isSafeInteger(row.colocacao) && row.colocacao > 0)) throw rpcError()
}
/** One immutable RPC payload. Only a known-aborted deadlock may retry, once; there is no legacy fallback. */
export async function tryAtomicProgression(actorId: string, championshipId: string, body: unknown, requestId: unknown) {
  if (progressionWriteMode() === 'legacy') return null
  if (!object(body) || typeof body.action !== 'string' || !Object.hasOwn(actions, body.action)) throw new SlotTransferError('Ação de progressão inválida.')
  const action = actions[body.action as keyof typeof actions], actor = uuid(actorId), championship = uuid(championshipId)
  const request = action === 'preview' ? null : uuid(requestId)
  let args: Record<string, unknown>
  if (action === 'reverse') {
    if (body.reason != null && typeof body.reason !== 'string') throw new SlotTransferError('Motivo de reversão inválido.')
    args = { execution_id: uuid(body.execution_id), reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null }
  } else {
    args = { rule_id: uuid(body.rule_id) }
    if (action === 'apply') {
      if (typeof body.replace_conflicts !== 'boolean' || !object(body.expected)
        || !['rule', 'source', 'destination', 'phase'].every(key => object(body.expected[key]))
        || !['ranking', 'source_links', 'destination_links', 'participants'].every(key => Array.isArray(body.expected[key]))) throw new SlotTransferError('Atualize a prévia antes de aplicar esta progressão.')
      args = { ...args, replace_conflicts: body.replace_conflicts, expected: body.expected }
    }
  }
  if (new TextEncoder().encode(JSON.stringify(args)).length > 4194304) throw new SlotTransferError('O acompanhamento excede o limite de progressão.')
  const payload = { p_actor_id: actor, p_request_id: request, p_campeonato_id: championship, p_action: action, p_args: args }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000)
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let response
      try { response = await supabaseAdmin.rpc('fn_operar_progressao_atomica', payload).abortSignal(controller.signal) }
      catch { throw rpcError() }
      if (response.error?.code === '40P01' && attempt === 0) continue
      if (response.error) throw rpcError(response.error)
      const result = response.data
      if (!object(result) || result.ok !== true || result.actor_id !== actor || result.campeonato_id !== championship || result.progression_action !== action) throw rpcError()
      if (action !== 'preview' && (result.operation_confirmed !== true || result.request_id !== request)) throw rpcError()
      if (action === 'preview' || action === 'apply') assertPreview(result.preview, args.rule_id as string)
      if (action === 'apply' && (!Number.isSafeInteger(result.applied) || result.applied < 0 || result.applied > 1000
        || (result.execution_id !== null && !pattern.test(result.execution_id || '')) || (result.applied > 0 && !result.execution_id))) throw rpcError()
      if (action === 'reverse' && (result.execution_id !== args.execution_id || !Number.isSafeInteger(result.reversed) || result.reversed < 0 || result.reversed > 1000)) throw rpcError()
      return result
    }
    throw rpcError()
  } finally { clearTimeout(timeout) }
}
