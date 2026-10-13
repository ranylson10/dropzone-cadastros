import { supabaseAdmin } from '../../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../../shared/paginated-query'

async function readGroupSlotRows(campeonatoId: string, grupoId: string) {
  let rows: any[]
  let source: 'view' | 'fallback' = 'view'
  try {
    rows = await readPagedRows<any>(supabaseAdmin.from('vw_campeonato_slots_lines')
      .select('slot_id,slot_numero,slot_letra,status_ui,line_id,equipe_id,line_nome,line_logo_url,equipe_nome,nome_exibicao,participacao_id')
      .eq('campeonato_id', campeonatoId).eq('grupo_id', grupoId)
      .order('slot_numero', { ascending: true }).order('slot_id', { ascending: true }))
  } catch (error: any) {
    if (!['42P01', 'PGRST205'].includes(error?.code || '')) throw error
    source = 'fallback'
    const slots = await readPagedRows<any>(supabaseAdmin.from('campeonato_slots')
      .select('id,slot_numero,slot_letra,equipe_id,line_id')
      .eq('campeonato_id', campeonatoId).eq('grupo_id', grupoId)
      .order('slot_numero', { ascending: true }).order('id', { ascending: true }))
    const parts = await readPagedRows<any>(supabaseAdmin.from('campeonato_equipes')
      .select('id,slot_id,slot_numero,line_id,equipe_id,nome_exibicao')
      .eq('campeonato_id', campeonatoId).eq('grupo_id', grupoId).eq('status', 'ativo')
      .order('id', { ascending: true }))
    const bySlot = new Map(parts.filter(part => part.slot_id).map(part => [String(part.slot_id), part]))
    const legacyByNumber = new Map(parts.filter(part => !part.slot_id).map(part => [String(part.slot_numero), part]))
    rows = slots.map(slot => {
      const part = bySlot.get(String(slot.id)) || legacyByNumber.get(String(slot.slot_numero))
      return { slot_id: slot.id, slot_numero: slot.slot_numero, slot_letra: slot.slot_letra,
        line_id: part?.line_id || slot.line_id, equipe_id: part?.equipe_id || slot.equipe_id,
        participacao_id: part?.id || null, nome_exibicao: part?.nome_exibicao || null,
        status_ui: part ? 'ocupada' : 'livre' }
    })
  }
  return { rows, source }
}

const occupied = (row: any) => row.status_ui === 'ocupada' || Boolean(row.participacao_id || row.line_id || row.equipe_id)

export async function countGroupFreeSlots(campeonatoId: string, grupoId: string) {
  const { rows } = await readGroupSlotRows(campeonatoId, grupoId)
  return rows.filter(row => !occupied(row)).length
}

export async function readGroupInviteBoard(campeonatoId: string, grupoId: string, refs: Map<string, string> = new Map()) {
  const { rows, source } = await readGroupSlotRows(campeonatoId, grupoId)
  const [lines, teams] = await Promise.all([
    readRowsByIds<any>(rows.map(row => String(row.line_id || '')).filter(Boolean), batch => supabaseAdmin
      .from('equipe_lines').select('id,nome,logo_url').in('id', batch).order('id', { ascending: true })),
    readRowsByIds<any>(rows.map(row => String(row.equipe_id || '')).filter(Boolean), batch => supabaseAdmin
      .from('equipes').select('id,nome,logo_url').in('id', batch).order('id', { ascending: true })),
  ])
  const lineMap = new Map(lines.map(line => [String(line.id), line]))
  const teamMap = new Map(teams.map(team => [String(team.id), team]))
  const vagas = rows.map((row, index) => ({
    index, slot_id: row.slot_id, slot_numero: row.slot_numero ?? index + 1,
    slot_letra: String(row.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index),
    ocupada: occupied(row),
    equipe_nome: teamMap.get(String(row.equipe_id))?.nome || row.equipe_nome || null,
    line_nome: lineMap.get(String(row.line_id))?.nome || row.line_nome || row.nome_exibicao || null,
    logo_url: lineMap.get(String(row.line_id))?.logo_url || row.line_logo_url || teamMap.get(String(row.equipe_id))?.logo_url || null,
    campeonato_equipe_id: row.participacao_id || null,
    nome: `Slot ${String(row.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)}`,
    referencia_equipe: row.participacao_id ? refs.get(String(row.participacao_id)) || null : null,
  }))
  const players = await readRowsByIds<any>(vagas.map(row => String(row.campeonato_equipe_id || '')).filter(Boolean), batch => supabaseAdmin
    .from('campeonato_jogadores').select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero')
    .eq('campeonato_id', campeonatoId).in('campeonato_equipe_id', batch).eq('status', 'ativo')
    .order('slot_numero', { ascending: true }).order('id', { ascending: true }))
  const byParticipation = new Map<string, any[]>()
  for (const player of players) {
    const key = String(player.campeonato_equipe_id), list = byParticipation.get(key) || []
    list.push(player); byParticipation.set(key, list)
  }
  return { source, vagas: vagas.map(vaga => {
    const jogadores = byParticipation.get(String(vaga.campeonato_equipe_id)) || []
    return { ...vaga, jogadores, quantidade_jogadores: jogadores.length }
  }) }
}

export async function readGroupInviteAvailability(campeonatoId: string, grupoId: string) {
  // Preserve the team-invite DTO while sharing the complete board query.
  const { vagas } = await readGroupInviteBoard(campeonatoId, grupoId)
  return vagas.map(({ nome: _name, referencia_equipe: _reference, ...vaga }) => vaga)
}
