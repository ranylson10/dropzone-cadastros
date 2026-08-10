import type { ProfileType } from '@/types/dropzone'
import type { QuickTokenKind } from '@/lib/api'

export const PLAYER_ROLES = ['support', 'rush', 'sniper', 'bomber'] as const
export const BROADCAST_ROLES = ['stream', 'narrador', 'comentarista', 'apresentador'] as const

export function loginSuggestion(value: string) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._\s-]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .replace(/-+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 20)
  return base.length >= 3 ? base : ''
}

export function quickTokenRequiredProfiles(kind: QuickTokenKind): ProfileType[] {
  if (kind === 'team_championship_invite' || kind === 'group_registration') return ['equipe', 'manager']
  if (kind === 'seller_invite') return ['manager']
  return ['jogador']
}

export function quickTokenPreferredProfile(kind: QuickTokenKind): ProfileType {
  if (kind === 'team_championship_invite' || kind === 'group_registration') return 'equipe'
  if (kind === 'seller_invite') return 'manager'
  return 'jogador'
}

export const profileLabel: Record<ProfileType, string> = {
  jogador: 'Jogador', equipe: 'Equipe', produtora: 'Produtora', manager: 'Manager', broadcast: 'Broadcast',
}
