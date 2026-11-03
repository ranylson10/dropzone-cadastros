import { supabaseAdmin } from '../../shared/supabase-admin'

/**
 * Claim one-time invitations with a single guarded UPDATE.
 * These claims prevent different recipients from both winning the same invite,
 * but do NOT make downstream roster/seller writes part of a database transaction.
 * Retries by the same recipient are allowed so partial downstream failures can recover.
 */

export class InvitationClaimError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

const playerRetryWindowMs = 30 * 60 * 1000

function expiredOrInvalid(value: unknown, now: number) {
  if (value === null || value === undefined || value === '') return false
  const timestamp = Date.parse(String(value))
  return !Number.isFinite(timestamp) || timestamp <= now
}

export function isFreshPlayerReplay(row: any, playerId: string, now: number) {
  const usedAt = Date.parse(String(row?.usado_em || ''))
  return row?.status === 'usado' && row?.usado === true
    && row?.jogador_id === playerId && Number.isFinite(usedAt)
    && usedAt <= now && now - usedAt < playerRetryWindowMs
}

/** A valid player may resume the same invite for 30 minutes after claiming it. */
export async function claimPlayerRosterInvite(invite: any, playerId: string) {
  const now = Date.now()
  if (!invite?.id || !playerId) throw new InvitationClaimError('Convite ou jogador inválido.', 400)
  if (invite.usado === true) {
    if (isFreshPlayerReplay(invite, playerId, now)) return { replay: true }
    throw new InvitationClaimError('Este convite já foi utilizado.')
  }
  if (invite.status !== 'ativo' || expiredOrInvalid(invite.expira_em, now)) {
    throw new InvitationClaimError('Este convite foi cancelado ou expirou.')
  }
  const timestamp = new Date(now).toISOString()
  const { data, error } = await supabaseAdmin.from('tokens')
    .update({ usado: true, status: 'usado', usado_em: timestamp, jogador_id: playerId, updated_at: timestamp })
    .eq('id', invite.id).eq('tipo', 'convite_jogador_equipe')
    .eq('status', 'ativo').eq('usado', false)
    .or(`expira_em.is.null,expira_em.gt.${timestamp}`)
    .select('id').maybeSingle()
  if (error) throw error
  if (data?.id) return { replay: false }
  const current = await supabaseAdmin.from('tokens')
    .select('status,usado,jogador_id,usado_em')
    .eq('id', invite.id).eq('tipo', 'convite_jogador_equipe').maybeSingle()
  if (current.error) throw current.error
  if (isFreshPlayerReplay(current.data, playerId, Date.now())) return { replay: true }
  throw new InvitationClaimError('Convite já utilizado, expirado ou modificado.')
}

/** Sellers may safely retry creating their manager records after an interrupted acceptance. */
export async function claimSellerInvite(invite: any, managerId: string) {
  if (!invite?.id || !managerId) throw new InvitationClaimError('Convite ou manager inválido.', 400)
  if (invite.usado === true) {
    if (invite.status === 'ativo' && invite.manager_id === managerId) return { replay: true }
    throw new InvitationClaimError('Este convite já foi utilizado por outro manager.')
  }
  const now = new Date().toISOString()
  if (invite.status !== 'ativo' || expiredOrInvalid(invite.expira_em, Date.now())) {
    throw new InvitationClaimError('Este convite expirou ou foi cancelado.')
  }
  const { data, error } = await supabaseAdmin.from('tokens')
    .update({ manager_id: managerId, usado: true, usado_em: now, updated_at: now })
    .eq('id', invite.id).in('tipo', ['manager_invite', 'manager_invite_produtora'])
    .eq('status', 'ativo').eq('usado', false)
    .or(`expira_em.is.null,expira_em.gt.${now}`)
    .select('id').maybeSingle()
  if (error) throw error
  if (data?.id) return { replay: false }
  const current = await supabaseAdmin.from('tokens')
    .select('status,usado,manager_id')
    .eq('id', invite.id).in('tipo', ['manager_invite', 'manager_invite_produtora']).maybeSingle()
  if (current.error) throw current.error
  if (current.data?.status === 'ativo' && current.data?.usado === true && current.data.manager_id === managerId) return { replay: true }
  throw new InvitationClaimError('Convite já utilizado, expirado ou modificado.')
}
