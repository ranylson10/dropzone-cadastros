import type { ControllableEquipe } from '../../equipes/manager-team-access'

export type InviteActor = {
  user: { id: string }
  accounts: Array<{ id: string; profile_type?: string | null; name?: string | null; username?: string | null; data?: any }>
}

export function canEnrollTeam(team: ControllableEquipe) {
  return team.permissoes.pode_editar || team.permissoes.pode_escalar
}

export function assertTeamEnrollmentPermission(team: ControllableEquipe, lineId: unknown) {
  if (!canEnrollTeam(team)) throw new Error('Sem permissão para inscrever lines desta equipe.')
  if (!team.permissoes.pode_editar && !String(lineId || '').trim()) {
    throw new Error('Selecione uma line existente. Sua permissão não permite criar ou reativar lines.')
  }
}

/** An invitation targeting a team/line cannot be redirected to another owner. */
export function assertTeamInviteRecipient(
  invite: { equipe_id?: string | null; equipe_destino_id?: string | null; line_destino_id?: string | null },
  equipeId: string,
  lineId?: string | null,
) {
  if ((invite.equipe_id && invite.equipe_id !== equipeId) ||
      (invite.equipe_destino_id && invite.equipe_destino_id !== equipeId)) {
    throw new Error('Este convite está destinado a outra equipe.')
  }
  if (invite.line_destino_id && invite.line_destino_id !== lineId) {
    throw new Error('Este convite está destinado a outra line.')
  }
}
