import { supabaseAdmin } from '../shared/supabase-admin'

/** R08: single eligibility policy for team and admin legacy writes.
 * NOTE: this is preflight validation, NOT a database transaction or a concurrency lock.
 * Atomic RPC must repeat these checks inside the database before writing. */
export async function assertLegacySlotEligible(campeonatoId: string, faseId: string, grupoId: string, slotId: string) {
  const [blocks, lili, invites] = await Promise.all([
    supabaseAdmin.from('campeonato_grupo_escolha_bloqueios')
      .select('grupo_id,slot_id,motivo').eq('campeonato_id', campeonatoId).eq('fase_id', faseId).eq('ativo', true),
    supabaseAdmin.from('lili_reservas_slot').select('id').eq('campeonato_id', campeonatoId)
      .eq('slot_id', slotId).eq('status', 'ativa').gt('expira_em', new Date().toISOString()).limit(1),
    supabaseAdmin.from('tokens').select('id,expira_em').eq('campeonato_id', campeonatoId)
      .eq('slot_id', slotId).eq('status', 'ativo').eq('usado', false)
      .in('tipo', ['convite_equipe_campeonato', 'team_invite']),
  ])
  if (blocks.error) throw blocks.error
  if (lili.error) throw lili.error
  if (invites.error) throw invites.error
  const block = (blocks.data || []).find((row) => String(row.grupo_id || '') === grupoId
    || String(row.slot_id || '') === slotId)
  if (block) throw new Error(block.motivo ? `Grupo ou slot bloqueado: ${block.motivo}` : 'Este grupo ou slot está bloqueado pela administração.')
  if ((lili.data || []).length) throw new Error('Este slot possui uma reserva ativa. Escolha outro slot.')
  const now = Date.now()
  if ((invites.data || []).some((row) => {
    if (!row.expira_em) return true
    const expires = Date.parse(String(row.expira_em))
    return !Number.isFinite(expires) || expires > now
  })) throw new Error('Este slot está reservado por um convite ativo. Escolha outro slot.')
}
