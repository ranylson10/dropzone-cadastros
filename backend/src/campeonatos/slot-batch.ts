import { supabaseAdmin } from '../shared/supabase-admin'
import { SlotTransferError, slotMovementMode } from './slot-transfer'

const pattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !pattern.test(value.trim())) throw new SlotTransferError('Identificador de distribuição inválido.')
  return value.trim().toLowerCase()
}
const messages: Record<string, number> = {
  'Dados de distribuição inválidos.': 400, 'Acompanhamento de distribuição inválido.': 400,
  'Grupos fora da fase ou campeonato.': 400, 'Chave de repetição vinculada a outra distribuição.': 409,
  'As equipes mudaram. Atualize o acompanhamento.': 409, 'Vagas livres insuficientes para distribuição.': 409,
  'Estrutura de distribuição exige reconciliação.': 409, 'Espelho de distribuição exige reconciliação.': 409,
  'Conta indisponível para movimentação.': 403, 'Campeonato indisponível para movimentação.': 403,
  'Sem permissão para movimentar slots.': 403, 'A participação mudou. Atualize o plano.': 409,
  'Line ou equipe incompatível com a participação.': 409, 'Espelho de origem exige reconciliação.': 409,
  'Localização legada exige reconciliação.': 409, 'Destino ocupado ou reservado fora do plano.': 409,
  'Gatilho de slots incompatível com a movimentação.': 503,
}
function rpcError(error?: { code?: string; message?: string }) {
  if (error?.message && ['22023', '42501', '23505', '23514', '40001'].includes(error.code || '') && messages[error.message]) {
    return new SlotTransferError(error.message, messages[error.message])
  }
  if (['23505', '23514', '40001', '40P01', '55P03'].includes(error?.code || '')) return new SlotTransferError('Outra operação alterou os grupos. Confira o acompanhamento e tente novamente.', 409)
  if (['PGRST202', '42883'].includes(error?.code || '')) return new SlotTransferError('Distribuição temporariamente indisponível.', 503)
  return new SlotTransferError('Não foi possível confirmar a distribuição. Confira o acompanhamento e repita com os mesmos dados.', 503, true)
}
/** Dispatch only these two modes. No table pre-read, retry, compensation or legacy fallback. */
export async function tryAtomicSlotBatch(actorId: string, championshipId: string, body: unknown, key: unknown) {
  if (slotMovementMode() === 'legacy') return null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const value = body as Record<string, unknown>
  if (!['shuffle_group', 'distribute_phase'].includes(String(value.mode))) return null
  if (!key) throw new SlotTransferError('Atualize o aplicativo para guardar e confirmar esta distribuição.')
  const shuffle = value.mode === 'shuffle_group'
  if (!shuffle && !['balanced', 'random'].includes(String(value.strategy))) throw new SlotTransferError('Estratégia de distribuição inválida.')
  const rawGroups = shuffle ? [value.group_id] : value.group_ids
  if (!Array.isArray(rawGroups) || rawGroups.length < (shuffle ? 1 : 2) || rawGroups.length > 100) throw new SlotTransferError('Grupos de distribuição inválidos.')
  const groups = rawGroups.map(uuid)
  if (new Set(groups).size !== groups.length) throw new SlotTransferError('Grupos de distribuição inválidos.')
  if (!Array.isArray(value.expected) || value.expected.length < 2 || value.expected.length > 1000) throw new SlotTransferError('Atualize o acompanhamento antes de distribuir as equipes.')
  const expected = value.expected.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new SlotTransferError('Acompanhamento de distribuição inválido.')
    const row = item as Record<string, unknown>
    // Preserve submillisecond precision sent by PostgreSQL; Date.toISOString would lose it.
    if (typeof row.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(row.updated_at)
      || !Number.isFinite(Date.parse(row.updated_at))) throw new SlotTransferError('Acompanhamento de distribuição inválido.')
    return { id: uuid(row.id), slot_id: uuid(row.slot_id), equipe_id: uuid(row.equipe_id), line_id: uuid(row.line_id), updated_at: row.updated_at }
  }).sort((a, b) => a.id.localeCompare(b.id))
  if (new Set(expected.map(row => row.id)).size !== expected.length || new Set(expected.map(row => row.slot_id)).size !== expected.length) throw new SlotTransferError('Acompanhamento de distribuição inválido.')
  const args = { p_actor_id: uuid(actorId), p_request_id: uuid(key), p_campeonato_id: uuid(championshipId), p_mode: value.mode as string,
    p_phase_id: shuffle ? null : uuid(value.phase_id), p_group_ids: groups, p_strategy: shuffle ? null : value.strategy as string, p_expected: expected }
  let response
  try { response = await supabaseAdmin.rpc('fn_distribuir_slots_atomico', args) } catch { throw rpcError() }
  if (response.error) throw rpcError(response.error)
  const result = response.data, byId = new Map(expected.map(row => [row.id, row]))
  const action = shuffle ? 'shuffle' : 'distribute'
  if (!result || result.ok !== true || result.campeonato_id !== args.p_campeonato_id || result.mode !== args.p_mode || result.action !== action
    || result.phase_id !== args.p_phase_id || result.strategy !== args.p_strategy || result.expected_count !== expected.length
    || !Array.isArray(result.group_ids) || JSON.stringify(result.group_ids) !== JSON.stringify(groups)
    || !Array.isArray(result.participacoes) || result.participacoes.length !== expected.length
    || new Set(result.participacoes.map((row: any) => row?.id)).size !== expected.length
    || new Set(result.participacoes.map((row: any) => row?.slot_id)).size !== expected.length
    || result.participacoes.some((row: any) => !byId.has(row?.id) || row.equipe_id !== byId.get(row.id)?.equipe_id || row.line_id !== byId.get(row.id)?.line_id
      || !pattern.test(row.slot_id || '') || !groups.includes(row.grupo_id) || !Number.isInteger(row.slot_numero) || row.slot_numero < 1
      || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)))
    || !Array.isArray(result.distribuicao) || result.distribuicao.length !== groups.length
    || result.distribuicao.some((row: any, index: number) => row?.grupo_id !== groups[index] || row.equipes !== result.participacoes.filter((part: any) => part.grupo_id === row.grupo_id).length)) throw rpcError()
  return { ok: true, operation_confirmed: true, campeonato_id: args.p_campeonato_id, action, mode: args.p_mode,
    phase_id: args.p_phase_id, group_ids: groups, strategy: args.p_strategy, ...(result.repetida === true ? { repetida: true } : {}),
    distribuicao: result.distribuicao.map((row: any) => ({ grupo_id: row.grupo_id, equipes: row.equipes })),
    participacoes: result.participacoes.map((row: any) => ({ id: row.id, equipe_id: row.equipe_id, line_id: row.line_id,
      grupo_id: row.grupo_id, slot_id: row.slot_id, slot_numero: row.slot_numero, updated_at: row.updated_at })) }
}
