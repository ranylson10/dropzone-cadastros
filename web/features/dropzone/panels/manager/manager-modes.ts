export type ManagerPanelMode = 'hub' | 'produtora' | 'equipes' | 'jogador'

/** Sub-área dentro de Campeonatos (vendedor/afiliado). */
export type ManagerProdutoraSub = 'vendas' | 'campeonatos'

export type ManagerChampTab = 'equipes' | 'jogadores' | 'grupos' | 'jogos' | 'estatisticas' | 'info'

export const MANAGER_CONTEXT_CARDS: Array<{
  id: Exclude<ManagerPanelMode, 'hub'>
  title: string
}> = [
  {
    id: 'produtora',
    title: 'Campeonatos',
  },
  {
    id: 'equipes',
    title: 'Equipes',
  },
  {
    id: 'jogador',
    title: 'Jogadores',
  },
]

/** Compat: atalhos antigos usavam 'vendas' / 'campeonatos' / 'produtora'. */
export function normalizeManagerMode(raw: string | null | undefined): ManagerPanelMode {
  if (raw === 'vendas' || raw === 'campeonatos' || raw === 'produtora') return 'produtora'
  if (raw === 'equipes') return 'equipes'
  if (raw === 'jogador') return 'jogador'
  if (raw === 'hub') return 'hub'
  // R22: a entrada padrão é um painel de ações; atalhos antigos seguem válidos.
  return 'hub'
}
