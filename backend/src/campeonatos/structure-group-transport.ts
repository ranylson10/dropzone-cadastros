import { supabaseAdmin } from '../shared/supabase-admin'
import { operationUuid } from '../shared/operation-json'
import { SlotTransferError } from './slot-transfer'
import { assertStructureGroupResponse, structureGroupIntent, structureGroupValues } from './structure-group-contract'

export function structureGroupWriteMode(): 'legacy' | 'atomic' {
  const value = process.env.STRUCTURE_GROUP_WRITE_MODE?.trim() || 'legacy'
  if (value !== 'legacy' && value !== 'atomic') throw new SlotTransferError('Criação de grupo temporariamente indisponível.', 503)
  return value
}
export async function tryAtomicStructureGroup(actor: string, champ: string, body: any, key: unknown) {
  if (!['create_group', 'preview_create_group'].includes(String(body?.action || '').trim())) return null
  if (structureGroupWriteMode() !== 'atomic') throw new SlotTransferError('Criação de grupo temporariamente indisponível.', 503)
  let values, expected: string | null, request: string
  try {
    actor = operationUuid(actor); champ = operationUuid(champ); request = operationUuid(key)
    if (body.action === 'create_group') { const intent = structureGroupIntent(body); values = structureGroupValues(intent); expected = intent.expected }
    else { if (body.expected != null) throw Error('Unexpected fence'); values = structureGroupValues(body); expected = null }
  } catch { throw new SlotTransferError('Confira a fase, o grupo e a chave de confirmação.') }
  const args = { p_actor_id: actor, p_request_id: request, p_campeonato_id: champ, p_action: body.action, p_values: values, p_expected: expected }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 25000)
  const uncertain = () => new SlotTransferError('Não foi possível confirmar o grupo. Confira a estrutura e repita a tentativa original.', 503, true)
  try {
    for (let n = 0; n < 2; n++) {
      let result
      try { result = await supabaseAdmin.rpc('fn_criar_grupo_atomico', args).abortSignal(controller.signal) } catch { throw uncertain() }
      if (result.error?.code === '40P01' && n === 0) continue
      if (result.error) {
        const code = result.error.code
        if (code === '42501') throw new SlotTransferError('Sem permissão para criar grupos neste campeonato.', 403)
        if (['23505', '23514', '23503', '40001', '40P01', '55P03'].includes(code)) throw new SlotTransferError('A fase, o grupo ou a capacidade mudou. Confira a estrutura.', 409)
        if (['22023', '22P02', '22003', '54000'].includes(code)) throw new SlotTransferError('Dados de grupo inválidos ou excessivos.')
        throw uncertain()
      }
      try { assertStructureGroupResponse(result.data, actor, champ, request, body.action, values) } catch { throw uncertain() }
      return result.data
    }
    throw uncertain()
  } finally { clearTimeout(timeout) }
}
