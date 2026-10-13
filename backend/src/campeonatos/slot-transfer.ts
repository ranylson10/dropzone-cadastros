import { supabaseAdmin } from '../shared/supabase-admin'

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
export class SlotTransferError extends Error {
  constructor(message: string, readonly status = 400, readonly uncertain = false) { super(message) }
}
/** Remains legacy until staging, permission/DDL and all cooperating writers are reviewed. */
export function slotMovementMode() {
  const mode = process.env.SLOT_MOVEMENT_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new SlotTransferError('Movimentação temporariamente indisponível.', 503)
  return mode
}
function uuid(value: unknown, required = true): string | null {
  if (!required && (value == null || value === '')) return null
  if (typeof value !== 'string' || !uuidPattern.test(value.trim())) throw new SlotTransferError('Identificador de movimentação inválido.')
  return value.trim().toLowerCase()
}
const domainMessages: Record<string, number> = {
  'Dados de movimentação inválidos.': 400, 'Permissão de movimentação inválida.': 400,
  'Conta indisponível para movimentação.': 403, 'Campeonato indisponível para movimentação.': 403,
  'Sem permissão para movimentar slots.': 403, 'Slots fora do campeonato.': 400,
  'Chave de repetição vinculada a outro movimento.': 409, 'Chave de repetição vinculada a outro plano.': 409,
  'O ocupante mudou. Atualize o acompanhamento.': 409, 'A estrutura mudou. Atualize o acompanhamento.': 409,
  'A participação mudou. Atualize o plano.': 409, 'Destino ocupado ou reservado fora do plano.': 409,
  'Line ou equipe incompatível com a participação.': 409, 'Localização legada exige reconciliação.': 409,
  'Espelho de origem exige reconciliação.': 409, 'Destino fora da estrutura do campeonato.': 409,
  'Gatilho de slots incompatível com a movimentação.': 503,
}
function rpcError(error: { code?: string; message?: string } = {}) {
  if (['22023', '42501', '23505', '23514', '40001'].includes(error.code || '') && error.message && domainMessages[error.message]) {
    return new SlotTransferError(error.message, domainMessages[error.message])
  }
  if (['23505', '23514', '40001', '40P01', '55P03'].includes(error.code || '')) {
    return new SlotTransferError('Outra operação alterou os slots. Confira o acompanhamento e tente novamente.', 409)
  }
  if (['PGRST202', '42883'].includes(error.code || '')) return new SlotTransferError('Movimentação temporariamente indisponível.', 503)
  return new SlotTransferError('Não foi possível confirmar o resultado. Confira o acompanhamento e repita com os mesmos dados.', 503, true)
}

export async function tryAtomicSlotTransfer(actorId: string, championshipId: string, body: unknown, requestId: unknown) {
  if (slotMovementMode() === 'legacy') return null
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SlotTransferError('Dados de movimentação inválidos.')
  const value = body as Record<string, unknown>
  if (typeof value.mode !== 'string' || !value.mode) throw new SlotTransferError('Dados de movimentação inválidos.')
  if (!['move', 'swap'].includes(String(value.mode))) {
    throw new SlotTransferError('Esta operação ainda precisa da integração transacional antes da ativação.', 503)
  }
  if (!requestId) throw new SlotTransferError('Atualize o aplicativo para guardar e confirmar esta movimentação.')
  const args = {
    p_actor_id: uuid(actorId)!, p_request_id: uuid(requestId)!, p_campeonato_id: uuid(championshipId)!,
    p_mode: value.mode as 'move' | 'swap', p_source_slot_id: uuid(value.source_slot_id)!, p_target_slot_id: uuid(value.target_slot_id)!,
    p_source_participation_id: uuid(value.source_participation_id)!,
    p_target_participation_id: uuid(value.target_participation_id, value.mode === 'swap'),
  }
  if (args.p_source_slot_id === args.p_target_slot_id || (args.p_mode === 'move' && args.p_target_participation_id)
    || args.p_source_participation_id === args.p_target_participation_id) throw new SlotTransferError('Dados de movimentação inválidos.')
  // ONE RPC. Never read slots/participations before replay, auto-retry or compensate.
  let response
  try { response = await supabaseAdmin.rpc('fn_transferir_slots_atomico', args) } catch { throw rpcError() }
  if (response.error) throw rpcError(response.error)
  const result = response.data
  const expected = new Map<string, string>([[args.p_source_participation_id, args.p_target_slot_id]])
  if (args.p_target_participation_id) expected.set(args.p_target_participation_id, args.p_source_slot_id)
  if (!result || result.ok !== true || result.campeonato_id !== args.p_campeonato_id || result.mode !== args.p_mode || result.action !== args.p_mode
    || result.source_slot_id !== args.p_source_slot_id || result.target_slot_id !== args.p_target_slot_id
    || result.source_participation_id !== args.p_source_participation_id || result.target_participation_id !== args.p_target_participation_id
    || typeof result.mensagem !== 'string' || !Array.isArray(result.participacoes) || result.participacoes.length !== expected.size
    || new Set(result.participacoes.map((part: any) => part.id)).size !== expected.size
    || result.participacoes.some((part: any) => !expected.has(part?.id) || expected.get(part.id) !== part.slot_id
      || !uuidPattern.test(part.equipe_id || '') || !uuidPattern.test(part.line_id || '') || !uuidPattern.test(part.grupo_id || '')
      || !Number.isInteger(part.slot_numero) || part.slot_numero < 1 || typeof part.updated_at !== 'string' || !Number.isFinite(Date.parse(part.updated_at)))) {
    throw rpcError()
  }
  return { ok: true, campeonato_id: result.campeonato_id, action: result.action, mode: result.mode,
    source_slot_id: result.source_slot_id, target_slot_id: result.target_slot_id,
    source_participation_id: result.source_participation_id, target_participation_id: result.target_participation_id,
    mensagem: result.mensagem, ...(result.repetida === true ? { repetida: true } : {}),
    participacoes: result.participacoes.map((part: any) => ({ id: part.id, equipe_id: part.equipe_id, line_id: part.line_id,
      grupo_id: part.grupo_id, slot_id: part.slot_id, slot_numero: part.slot_numero, updated_at: part.updated_at })),
  }
}
export function slotTransferErrorResponse(error: unknown) {
  if (!(error instanceof SlotTransferError)) return null
  return { status: error.status, body: { error: error.message, ...(error.uncertain ? { resultado_incerto: true } : {}) } }
}
