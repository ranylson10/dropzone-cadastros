import { acceptAtomicInvite, enrollmentMode, EnrollmentRequestError, type InviteKind } from './atomic-enrollment'
import { acceptTeamInvite } from './team-invite-accept'
import { acceptGroupInvite } from './group-invite-accept'
import type { InviteActor } from './types'

export async function acceptInvite(kind: InviteKind, actor: InviteActor, token: string, body: unknown, requestId: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EnrollmentRequestError('Dados de inscrição inválidos.')
  const data = body as Record<string, any>
  if (enrollmentMode() === 'atomic') return acceptAtomicInvite(kind, actor, token, data, requestId)
  return kind === 'team' ? acceptTeamInvite(actor, token, data) : acceptGroupInvite(actor, token, data)
}
