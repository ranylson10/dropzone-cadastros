import { supabaseAdmin } from "@backend/shared/supabase-admin";

/**
 * Aceita ISO com fuso (preferido, convertido no browser) ou datetime-local.
 * Rejeita validade no passado para não gravar link já expirado.
 */
export function parseOptionalDateTime(
  value: unknown,
  options?: { fieldLabel?: string; requireFuture?: boolean },
): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${options?.fieldLabel || 'Data'} inválida.`)
  }
  if (options?.requireFuture && date.getTime() <= Date.now()) {
    throw new Error(
      `${options.fieldLabel || 'Data'} precisa ser no futuro. O link nasceria já expirado.`,
    )
  }
  return date.toISOString()
}

export const TEAM_INVITE_TYPES = ['convite_equipe_campeonato', 'team_invite']

export const PLAYER_INVITE_TYPES = ['convite_jogador_campeonato', 'convite_jogador_equipe', 'player_invite']

export function normalizeTokenKind(value: unknown) {
  const raw = String(value || '').trim()
  if (raw === 'team_invite') return 'convite_equipe_campeonato'
  if (raw === 'player_invite') return 'convite_jogador_campeonato'
  return raw || 'convite_equipe_campeonato'
}

export function isTeamInviteKind(value: string) {
  return TEAM_INVITE_TYPES.includes(value)
}

export function isPlayerInviteKind(value: string) {
  return PLAYER_INVITE_TYPES.includes(value)
}

export async function consumeToken(token: string | null | undefined, tipo?: string | string[]) {
  const clean = String(token || '').trim().toUpperCase()
  if (!clean) return null
  let query = supabaseAdmin.from('tokens').select('*').eq('token', clean).eq('usado', false)
  if (Array.isArray(tipo)) query = query.in('tipo', tipo)
  else if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Token invalido ou ja utilizado.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Token expirado.')
  const { error: updateError } = await supabaseAdmin.from('tokens').update({ usado: true, usado_em: new Date().toISOString() }).eq('id', data.id)
  if (updateError) throw updateError
  return data
}
