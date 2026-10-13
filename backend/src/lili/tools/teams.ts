import { getAccountsForUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import type { LiliCard } from '@backend/lili/types'
import { AuthUser } from './common'

export async function listUserTeams(user: AuthUser) {
  const accounts = await getAccountsForUser(user)
  return listControllableEquipes(user.id, accounts)
}

export function teamCards(teams: any[], championshipId?: string | null): LiliCard[] {
  return teams.map((team) => ({
    id: team.id,
    kind: 'team',
    title: team.nome,
    subtitle: team.tag ? `${team.tag} • ${team.papel === 'dono' ? 'Proprietário' : 'Staff'}` : team.papel === 'dono' ? 'Proprietário' : 'Staff',
    imageUrl: team.logo_url || null,
    badges: [team.permissoes?.pode_escalar ? 'Pode escalar' : 'Visualização'],
    actions: championshipId ? [{
      id: `team-${team.id}`,
      label: 'Usar esta equipe',
      message: `Quero usar a equipe ${team.nome}`,
      intent: 'iniciar_inscricao',
      variant: 'primary',
      context: { selectedChampionshipId: championshipId, selectedTeamId: team.id, currentFlow: 'registration', currentStep: 'team' },
    }] : [{
      id: `open-team-${team.id}`,
      label: 'Abrir equipe',
      message: `Abrir equipe ${team.nome}`,
      intent: 'abrir_equipe',
      variant: 'primary',
      context: { selectedTeamId: team.id, currentFlow: 'team_hub' },
    }],
  }))
}
