import { participationUuid } from './participation-contract'

export type SlotMovementReadContract = { slot_movement_mode?: 'legacy' | 'atomic'; slot_movement_actor_id?: string | null }
export type SlotMovementExpected = { id: string; slot_id: string; equipe_id: string; line_id: string; updated_at: string }
export type SlotMovementIntent = {
  mode: 'move' | 'swap'; source_slot_id: string; target_slot_id: string; source_participation_id: string; target_participation_id: string | null
} | { mode: 'shuffle_group'; group_id: string; expected: SlotMovementExpected[] }
  | { mode: 'distribute_phase'; phase_id: string; group_ids: string[]; strategy: 'balanced' | 'random'; expected: SlotMovementExpected[] }
const uuid = participationUuid
function version(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Atualize o acompanhamento antes de movimentar as equipes.')
  return value
}
export function slotMovementExpected(value: unknown): SlotMovementExpected {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Atualize o acompanhamento antes de movimentar as equipes.')
  const row = value as Record<string, unknown>
  return { id: uuid(row.id), slot_id: uuid(row.slot_id), equipe_id: uuid(row.equipe_id), line_id: uuid(row.line_id), updated_at: version(row.updated_at) }
}
export function slotMovementMode(contract: SlotMovementReadContract) {
  const mode = contract.slot_movement_mode || 'legacy'
  if (!['legacy', 'atomic'].includes(mode)) throw new Error('Movimentação temporariamente indisponível.')
  return mode
}
export function slotMovementIntent(value: unknown): SlotMovementIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Movimentação inválida.')
  const row = value as Record<string, unknown>
  if (row.mode === 'move' || row.mode === 'swap') {
    const intent = { mode: row.mode as 'move' | 'swap', source_slot_id: uuid(row.source_slot_id), target_slot_id: uuid(row.target_slot_id), source_participation_id: uuid(row.source_participation_id), target_participation_id: row.target_participation_id == null || row.target_participation_id === '' ? null : uuid(row.target_participation_id) }
    if (intent.source_slot_id === intent.target_slot_id || (intent.mode === 'move' && intent.target_participation_id) || (intent.mode === 'swap' && !intent.target_participation_id) || intent.source_participation_id === intent.target_participation_id) throw new Error('Movimentação inválida.')
    return intent
  }
  if (!['shuffle_group', 'distribute_phase'].includes(String(row.mode)) || !Array.isArray(row.expected) || row.expected.length < 2 || row.expected.length > 1000) throw new Error('Atualize o acompanhamento antes de distribuir as equipes.')
  const expected = row.expected.map(slotMovementExpected).sort((a, b) => a.id.localeCompare(b.id))
  if (new Set(expected.map(p => p.id)).size !== expected.length || new Set(expected.map(p => p.slot_id)).size !== expected.length) throw new Error('Acompanhamento de distribuição inválido.')
  if (row.mode === 'shuffle_group') return { mode: row.mode, group_id: uuid(row.group_id), expected }
  if (!Array.isArray(row.group_ids) || row.group_ids.length < 2 || row.group_ids.length > 100 || !['balanced', 'random'].includes(String(row.strategy))) throw new Error('Distribuição inválida.')
  const group_ids = row.group_ids.map(uuid)
  if (new Set(group_ids).size !== group_ids.length) throw new Error('Grupos de distribuição inválidos.')
  return { mode: 'distribute_phase', phase_id: uuid(row.phase_id), group_ids, strategy: row.strategy as 'balanced' | 'random', expected }
}
export function assertSlotMovementConfirmed(result: any, championship: string, intent: SlotMovementIntent) {
  const fail = () => { throw new Error('Não foi possível confirmar a movimentação. Confira o acompanhamento e confirme a tentativa anterior.') }
  const movement = 'source_slot_id' in intent ? intent : null
  const batch = 'expected' in intent ? intent : null
  const transfer = Boolean(movement)
  const action = transfer ? intent.mode : intent.mode === 'shuffle_group' ? 'shuffle' : 'distribute'
  if (!result || result.ok !== true || result.campeonato_id !== championship || result.mode !== intent.mode || result.action !== action || (!transfer && result.operation_confirmed !== true)) fail()
  const expectedIds = movement ? [movement.source_participation_id, ...(movement.target_participation_id ? [movement.target_participation_id] : [])] : batch!.expected.map(p => p.id)
  if (!Array.isArray(result.participacoes) || result.participacoes.length !== expectedIds.length || new Set(result.participacoes.map((p: any) => p?.id)).size !== expectedIds.length || new Set(result.participacoes.map((p: any) => p?.slot_id)).size !== expectedIds.length) fail()
  const groups = batch ? batch.mode === 'shuffle_group' ? [batch.group_id] : batch.group_ids : []
  for (const row of result.participacoes) {
    try { slotMovementExpected(row); uuid(row.grupo_id) } catch { fail() }
    if (!expectedIds.includes(row.id) || !Number.isInteger(row.slot_numero) || row.slot_numero < 1) fail()
    if (movement) {
      if (row.slot_id !== (row.id === movement.source_participation_id ? movement.target_slot_id : movement.source_slot_id)) fail()
    } else {
      const original = batch!.expected.find(p => p.id === row.id)
      if (row.equipe_id !== original?.equipe_id || row.line_id !== original?.line_id || !groups.includes(row.grupo_id)) fail()
    }
  }
  if (movement) {
    if (result.source_slot_id !== movement.source_slot_id || result.target_slot_id !== movement.target_slot_id || result.source_participation_id !== movement.source_participation_id || result.target_participation_id !== movement.target_participation_id) fail()
  } else {
    if (result.phase_id !== (intent.mode === 'distribute_phase' ? intent.phase_id : null) || result.strategy !== (intent.mode === 'distribute_phase' ? intent.strategy : null) || JSON.stringify(result.group_ids) !== JSON.stringify(groups) || !Array.isArray(result.distribuicao) || result.distribuicao.length !== groups.length) fail()
    if (result.distribuicao.some((row: any, index: number) => row?.grupo_id !== groups[index] || row.equipes !== result.participacoes.filter((part: any) => part.grupo_id === row.grupo_id).length)) fail()
  }
}
/** Derive only from authorized server versions; display joins never supply a guessed version. */
export function slotMovementBoardExpected(slots: Array<Record<string, any>>) {
  return slots.filter(slot => slot.equipe_id || slot.line_id || slot.participacao_id || ['ocupado', 'ocupada'].includes(slot.status)).map(slot => {
    const expected = slotMovementExpected(slot.slot_movement_expected)
    if (expected.id !== slot.participacao_id || expected.slot_id !== slot.id || expected.equipe_id !== slot.equipe_id || expected.line_id !== slot.line_id) throw new Error('O acompanhamento mudou. Atualize os slots antes de confirmar.')
    return expected
  })
}
