import { useAuth } from '@/lib/auth'
import { ProfileCreateScreen } from '@/screens/ProfileCreateScreen'
import { ScreenProps } from '@/types/dropzone'

export function TeamCreateScreen({ onNavigate, onSelectTeam }: ScreenProps) {
  const auth = useAuth()
  return <ProfileCreateScreen profileType="equipe" onCancel={() => onNavigate('team_directory')} onCreated={async (teamId) => {
    await auth.refreshAccounts()
    if (teamId) { auth.setActiveAccountId(teamId); onSelectTeam?.(teamId) }
    else onNavigate('team_directory')
  }} />
}
