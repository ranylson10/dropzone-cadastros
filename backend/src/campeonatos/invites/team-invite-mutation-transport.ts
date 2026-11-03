import { supabaseAdmin } from '../../shared/supabase-admin'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export class TeamInviteMutationError extends Error {
  constructor(message: string, public status = 503) { super(message) }
}
export function teamInviteMutationMode(): 'legacy' | 'atomic' {
  const mode = process.env.DROPZONE_TEAM_INVITE_WRITE_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new TeamInviteMutationError('Modo de convites indisponível.')
  return mode
}
function validId(value: unknown) {
  return typeof value === 'string' && uuid.test(value.trim())
}
function mapError(error: { code?: string } | null | undefined) {
  switch (error?.code) {
    case '42501': return new TeamInviteMutationError('Sem permissão para modificar o convite.', 403)
    case '22023': return new TeamInviteMutationError('Convite inválido ou desatualizado.', 400)
    case '23505': case '40001': case '40P01': case '55P03':
      return new TeamInviteMutationError('Convite modificado por outra operação. Confira antes de repetir.', 409)
    default: return new TeamInviteMutationError('Não foi possível confirmar a alteração. Confira o estado do convite antes de repetir.')
  }
}
/** Em modo atomico, nenhuma gravação REST legada pode executar como fallback. */
export async function tryAtomicTeamInviteMutation(input: {
  actorId: string; campeonatoId: string; tokenId: string
  action: 'renew' | 'cancel'; requestId: string | null
}) {
  if (teamInviteMutationMode() === 'legacy') return null
  if (![input.actorId, input.campeonatoId, input.tokenId].every(validId)) {
    throw new TeamInviteMutationError('Identificador de convite inválido.', 400)
  }
  if (!validId(input.requestId)) {
    throw new TeamInviteMutationError('É necessária uma Idempotency-Key UUID para alterar o convite.', 409)
  }
  if (!['renew', 'cancel'].includes(input.action)) {
    throw new TeamInviteMutationError('Operação de convite inválida.', 400)
  }
  let response
  try {
    response = await supabaseAdmin.rpc('fn_alterar_convite_slot_r11', {
      p_actor_id: input.actorId, p_request_id: input.requestId,
      p_campeonato_id: input.campeonatoId, p_token_id: input.tokenId,
      p_action: input.action,
    })
  } catch { throw mapError(null) }
  if (response.error) throw mapError(response.error)
  const result = response.data
  if (!result || result.ok !== true || result.action !== input.action ||
      result.campeonato_id !== input.campeonatoId || result.token_id !== input.tokenId ||
      (input.action === 'renew' && (!result.convite ||
        typeof result.convite.token !== 'string' || !result.convite.token))) {
    throw mapError(null)
  }
  return result as { ok: true; action: 'renew' | 'cancel'; token_id: string;
    campeonato_id: string; convite?: Record<string, unknown>; repetida?: boolean }
}
