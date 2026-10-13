import { operationUuid } from '../shared/operation-json'

export type StructureGroupReadContract = { structure_group_write_mode?: unknown; structure_group_actor_id?: unknown }
export type StructureGroupValues = { nome: string; fase_id: string; slots: number; whatsapp_url: string | null }
export type StructureGroupIntent = StructureGroupValues & { action: 'create_group'; expected: string }
export function structureGroupValues(value: Record<string, any>): StructureGroupValues {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.nome !== 'string' || !(value.slots == null || typeof value.slots === 'number' || typeof value.slots === 'string' && /^\d+$/.test(value.slots.trim())) || !(value.whatsapp_url == null || typeof value.whatsapp_url === 'string')) throw new Error('Dados de grupo inválidos.')
  const nome = String(value.nome || '').trim(), fase_id = operationUuid(value.fase_id)
  const slots = Number(value.slots ?? 12), whatsapp_url = String(value.whatsapp_url || '').trim() || null
  if (!nome || nome.length > 180 || !Number.isInteger(slots) || slots < 1 || slots > 52 || (whatsapp_url?.length || 0) > 2048) throw new Error('Dados de grupo inválidos.')
  return { nome, fase_id, slots, whatsapp_url }
}
export function structureGroupIntent(value: Record<string, any>): StructureGroupIntent {
  if (value.action !== 'create_group' || typeof value.expected !== 'string' || !/^[0-9a-f]{64}$/.test(value.expected)) throw new Error('Atualize a estrutura antes de criar o grupo.')
  return { action: 'create_group', ...structureGroupValues(value), expected: value.expected }
}
export function assertStructureGroupResponse(result: any, actor: string, champ: string, request: string, action: string, values: StructureGroupValues) {
  if (!result || result.ok !== true || result.mode !== 'atomic' || result.actor_id !== actor || result.campeonato_id !== champ || result.request_id !== request
    || result.action !== action || typeof result.repetida !== 'boolean') throw new Error('Confirmação de grupo inválida.')
  if (action === 'preview_create_group') {
    const preview = result.preview
    if (result.repetida || !preview || typeof preview.fence !== 'string' || !/^[0-9a-f]{64}$/.test(preview.fence) || preview.phase_id !== values.fase_id
      || typeof preview.phase_name !== 'string' || preview.slots !== values.slots || typeof preview.entry !== 'boolean'
      || !Number.isSafeInteger(preview.entry_slots) || preview.entry_slots < 0 || !(preview.quota === null || Number.isSafeInteger(preview.quota) && preview.quota > 0)) throw new Error('Prévia de grupo inválida.')
  } else {
    const group = result.grupo
    if (result.operation_confirmed !== true || !group || operationUuid(group.id) !== group.id || group.campeonato_id !== champ || group.fase_id !== values.fase_id
      || group.nome !== values.nome || group.slots !== values.slots || group.whatsapp_url !== values.whatsapp_url || result.slots_created !== values.slots) throw new Error('Confirmação de grupo inválida.')
  }
}
