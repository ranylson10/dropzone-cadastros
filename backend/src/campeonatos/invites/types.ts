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
