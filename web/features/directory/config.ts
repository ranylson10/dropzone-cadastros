import type { DirectoryKind } from './types'

export const DIRECTORY_CONFIG: Record<DirectoryKind, { title: string; singular: string; description: string }> = {
  campeonatos: { title: 'Campeonatos', singular: 'Campeonato', description: 'Encontre campeonatos, compare vagas, valor de inscrição, premiação e próximas datas em uma única lista.' },
  equipes: { title: 'Equipes', singular: 'Equipe', description: 'Organizações e lines presentes no cenário competitivo.' },
  jogadores: { title: 'Jogadores', singular: 'Jogador', description: 'Perfis competitivos, funções e participações.' },
  managers: { title: 'Managers', singular: 'Manager', description: 'Gestores responsáveis por equipes, jogadores e produtoras.' },
  produtoras: { title: 'Produtoras', singular: 'Produtora', description: 'Organizações responsáveis pela produção dos campeonatos.' },
}

/** @deprecated use APP_NAV from @/components/layout — mantido para imports antigos */
export { APP_NAV as DIRECTORY_NAV } from '@/components/layout'
