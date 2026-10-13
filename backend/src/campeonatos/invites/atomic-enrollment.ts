import { supabaseAdmin } from '../../shared/supabase-admin'
import { listControllableEquipes } from '../../equipes/manager-team-access'
import { assertTeamEnrollmentPermission, type InviteActor } from './types'

export type InviteKind = 'team' | 'group'
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export class EnrollmentRequestError extends Error {
  constructor(message: string, readonly status = 400, readonly uncertain = false) { super(message) }
}

/** Off until the database candidates and staging checks have been completed. */
export function enrollmentMode() {
  const mode = process.env.INVITE_ENROLLMENT_MODE?.trim() || 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') {
    throw new EnrollmentRequestError('Inscrição temporariamente indisponível.', 503)
  }
  return mode
}

function uuid(value: unknown, required = false): string | null {
  if (value == null || value === '') {
    if (!required) return null
  }
  if (typeof value !== 'string' || !uuidPattern.test(value.trim())) {
    throw new EnrollmentRequestError('Identificador de inscrição inválido.')
  }
  return value.trim().toLowerCase()
}

function text(value: unknown, max: number) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new EnrollmentRequestError('Dados de inscrição inválidos.')
  }
  return value.trim() || null
}

const domainMessages: Record<string, number> = {
  'Dados de inscrição inválidos.': 400,
  'Sessão inválida.': 403,
  'Conta impedida de realizar inscrições.': 403,
  'Equipe indisponível.': 403,
  'Sem permissão para inscrever ou criar a line.': 403,
  'Chave de repetição vinculada a outros dados.': 409,
  'Convite inválido.': 400,
  'Slot fora do campeonato.': 400,
  'Link inválido ou ambíguo.': 400,
  'Campeonato indisponível para inscrição.': 403,
  'Inscrições fechadas ou prazo encerrado neste campeonato.': 409,
  'Grupo fora do campeonato.': 400,
  'Convite expirado, utilizado ou alterado.': 409,
  'Slot diferente do convite.': 400,
  'Link expirado, pausado ou alterado.': 409,
  'Metadados de vagas inválidos.': 409,
  'Link sem vagas disponíveis.': 409,
  'Vaga selecionada inválida.': 400,
  'Slot ocupado ou fora do grupo.': 409,
  'Line inválida ou inativa.': 400,
  'Informe um nome real para a line.': 400,
  'Esta line já está inscrita ou pendente neste campeonato.': 409,
  'Prazo de inscrição encerrou durante a operação.': 409,
  'Convite expirou durante a inscrição.': 409,
  'Link expirou durante a inscrição.': 409,
}

function rpcError(error: { code?: string; message?: string }): EnrollmentRequestError {
  // Only exact, reviewed domain messages can leave the backend. Never return details/hint/SQL.
  if (['22023', '42501', '23505'].includes(error.code || '') && error.message && domainMessages[error.message]) {
    return new EnrollmentRequestError(error.message, domainMessages[error.message])
  }
  if (error.code === '23505') return new EnrollmentRequestError('A vaga ou line já está ocupada. Atualize o acompanhamento.', 409)
  if (['40001', '40P01', '55P03'].includes(error.code || '')) {
    return new EnrollmentRequestError('Outra operação alterou esta inscrição. Tente confirmar novamente com os mesmos dados.', 409)
  }
  if (['PGRST202', '42883'].includes(error.code || '')) {
    return new EnrollmentRequestError('Inscrição temporariamente indisponível. Tente novamente mais tarde.', 503)
  }
  return new EnrollmentRequestError('Não foi possível confirmar o resultado. Confira o acompanhamento e repita com os mesmos dados.', 503, true)
}

function validResult(data: any, kind: InviteKind, teamId: string) {
  if (!data || data.ok !== true || !uuidPattern.test(data.participacao?.id || '')
    || data.equipe?.id !== teamId || data.participacao?.equipe_id !== teamId
    || !uuidPattern.test(data.line?.id || '') || data.participacao?.line_id !== data.line.id
    || typeof data.line.nome !== 'string' || typeof data.line.criada_agora !== 'boolean'
    || typeof data.mensagem !== 'string') return false
  return kind === 'team'
    ? data.slot?.id === data.participacao.slot_id && uuidPattern.test(data.slot?.id || '')
    : data.campeonato_equipe_id === data.participacao.id && data.slot_id === data.participacao.slot_id
      && uuidPattern.test(data.slot_id || '') && data.grupo_id === data.participacao.grupo_id
      && !!data.link && typeof data.precisa_pagamento === 'boolean'
}

export async function acceptAtomicInvite(kind: InviteKind, actor: InviteActor, token: string, body: Record<string, any>, requestId: unknown) {
  const actorId = uuid(actor.user.id, true)!
  if (!requestId) throw new EnrollmentRequestError('Atualize o aplicativo ou abra este convite pelo site para confirmar a inscrição.')
  const key = uuid(requestId, true)!
  const cleanToken = text(token, 2048)
  if (!cleanToken) throw new EnrollmentRequestError('Convite inválido.')
  const requestedTeam = uuid(body.equipe_id)
  const lineId = uuid(body.line_id)
  const slotId = uuid(body.slot_id)
  const name = lineId ? null : text(body.nome_line, 200)
  const reference = kind === 'group' ? text(body.referencia_equipe || body.nome_lista, 200) : null
  const rawIndex = kind === 'group' ? body.vaga_index : null
  if (rawIndex != null && rawIndex !== '' && typeof rawIndex !== 'number'
    && !(typeof rawIndex === 'string' && /^\d+$/.test(rawIndex))) throw new EnrollmentRequestError('Vaga selecionada inválida.')
  const index = rawIndex != null && rawIndex !== '' ? Number(rawIndex) : null
  if (index != null && (!Number.isSafeInteger(index) || index < 0 || index > 2147483647)) {
    throw new EnrollmentRequestError('Vaga selecionada inválida.')
  }
  const teams = await listControllableEquipes(actorId, actor.accounts)
  const selected = requestedTeam ? teams.find(team => team.id === requestedTeam) : teams.length === 1 ? teams[0] : null
  if (!selected) throw new EnrollmentRequestError('Selecione com qual equipe deseja entrar neste campeonato.')
  assertTeamEnrollmentPermission(selected, lineId)
  const teamId = uuid(selected.id, true)!
  // Permissions are checked again under locks in SQL. Do not pre-read token/slot validity:
  // a replay must reach its receipt even after the first call consumed the token.
  let response
  try {
    response = await supabaseAdmin.rpc('fn_inscrever_por_convite_atomico', {
      p_actor_id: actorId, p_request_id: key, p_kind: kind, p_token: cleanToken,
      p_equipe_id: teamId, p_line_id: lineId, p_nome_line: name, p_slot_id: slotId,
      p_vaga_index: index, p_referencia: reference,
    })
  } catch {
    throw rpcError({})
  }
  if (response.error) throw rpcError(response.error)
  if (!validResult(response.data, kind, teamId)) throw rpcError({})
  return response.data
}

export function enrollmentErrorResponse(error: unknown, fallback: string) {
  if (error instanceof EnrollmentRequestError) {
    return { status: error.status, body: { error: error.message, ...(error.uncertain ? { resultado_incerto: true } : {}) } }
  }
  const message = error instanceof Error && error.constructor === Error && !('code' in error) ? error.message : fallback
  return { status: 400, body: { error: message } }
}
