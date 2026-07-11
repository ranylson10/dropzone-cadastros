import type { DirectoryKind } from './types'

export const DIRECTORY_CONFIG: Record<DirectoryKind, { title: string; singular: string; description: string }> = {
  campeonatos: { title: 'Campeonatos', singular: 'Campeonato', description: 'Eventos competitivos cadastrados na DropZone.' },
  equipes: { title: 'Equipes', singular: 'Equipe', description: 'Organizações e lines presentes no cenário competitivo.' },
  jogadores: { title: 'Jogadores', singular: 'Jogador', description: 'Perfis competitivos, funções e participações.' },
  managers: { title: 'Managers', singular: 'Manager', description: 'Gestores responsáveis por equipes, jogadores e produtoras.' },
  produtoras: { title: 'Produtoras', singular: 'Produtora', description: 'Organizações responsáveis pela produção dos campeonatos.' },
}

export const DIRECTORY_NAV = [
  { label: 'Início', href: '/' },
  { label: 'Campeonatos', href: '/campeonatos' },
  { label: 'Equipes', href: '/equipes' },
  { label: 'Jogadores', href: '/jogadores' },
  { label: 'Managers', href: '/managers' },
  { label: 'Produtoras', href: '/produtoras' },
]
