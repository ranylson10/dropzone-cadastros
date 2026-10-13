import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows } from '../shared/paginated-query'
import { participationExpected } from './participation-contract'
import { slotMovementExpected } from './slot-movement-contract'

/** Read only AFTER authorizing the championship. Do not infer row versions from display joins. */
export async function loadParticipationSnapshots(championshipId: string) {
  return readPagedRows<any>(supabaseAdmin.from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,slot_numero,status,updated_at')
    .eq('campeonato_id', championshipId).in('status', ['ativo', 'pendente', 'rejeitado']).order('id'))
}
/** A display view can derive occupants; read the physical mirror independently for movement proof. */
export async function loadSlotSnapshotSources(championshipId: string) {
  return readPagedRows<any>(supabaseAdmin.from('campeonato_slots')
    .select('id,campeonato_id,equipe_id,line_id,grupo_id,slot_numero,status')
    .eq('campeonato_id', championshipId).order('id'))
}
export function participationSnapshot(row: any, championshipId: string, slot?: any) {
  if (!row || row.campeonato_id !== championshipId) return null
  if (slot && (row.slot_id !== slot.id || row.equipe_id !== slot.equipe_id || row.line_id !== slot.line_id
    || row.grupo_id !== slot.grupo_id || Number(row.slot_numero) !== Number(slot.slot_numero))) return null
  try { return participationExpected(row) } catch { return null }
}
export function slotMovementSnapshot(row: any, championshipId: string, slot: any) {
  const expected = participationSnapshot(row, championshipId, slot)
  if (!expected || expected.status !== 'ativo' || row.id !== slot.participacao_id || !['ocupado', 'ocupada'].includes(String(slot.status || ''))) return null
  try { return slotMovementExpected({ id: row.id, ...expected }) } catch { return null }
}
