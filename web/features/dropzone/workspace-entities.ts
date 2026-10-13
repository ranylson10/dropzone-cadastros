import type { ProfileType } from '@/lib/types'
import type { ProducerTab } from './panels/produtora/producer-tabs'

export type ProducerSection = 'visao' | 'campeonatos' | 'financeiro' | 'equipe' | 'configuracoes'
export type ProducerEntityRequest = { championshipId: string; types: string[]; summary: boolean }

export function initialWorkspaceEntityTypes(profileType: ProfileType) {
  if (profileType === 'manager' || profileType === 'broadcast') return []
  if (profileType === 'produtora') return ['championship']
  if (profileType === 'jogador') return ['championship', 'team', 'team_line', 'player_team', 'player_registration']
  return ['championship', 'team', 'team_line', 'player_team', 'championship_team', 'player_registration', 'invite_token']
}

const entitiesForTab: Record<ProducerTab, string[]> = {
  visao: ['championship_team', 'phase', 'group', 'game', 'registration_link'],
  jogos: ['phase', 'group', 'game'],
  links: ['phase', 'group', 'group_slot', 'game', 'invite_token', 'registration_link', 'championship_team'],
  // These feature components already fetch their own authorized data.
  equipes: [], jogadores: [], grupos: [], calls: [], regulamento: [], estatisticas: [], financeiro: [], vendedores: [],
}

export function producerEntityRequest(section: ProducerSection, tab: ProducerTab, championshipId: string, detailOpen: boolean): ProducerEntityRequest {
  if (section === 'visao') return { championshipId: '', types: [], summary: true }
  if (section !== 'campeonatos' || !detailOpen || !championshipId) return { championshipId: '', types: [], summary: false }
  return { championshipId, types: entitiesForTab[tab], summary: true }
}

export function producerRequestKey(request: ProducerEntityRequest) {
  return JSON.stringify([request.championshipId, [...request.types].sort(), request.summary])
}
