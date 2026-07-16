export type ManagerPanelMode = 'hub' | 'produtora' | 'equipes' | 'jogador'

/** Sub-área dentro de Produtora (vendedor/afiliado). */
export type ManagerProdutoraSub = 'vendas' | 'campeonatos'

export type ManagerChampTab = 'equipes' | 'jogadores' | 'grupos' | 'jogos' | 'estatisticas' | 'info'

export const MANAGER_CONTEXT_CARDS: Array<{
  id: Exclude<ManagerPanelMode, 'hub'>
  title: string
  description: string
  eyebrow: string
  help: string
}> = [
  {
    id: 'produtora',
    title: 'Produtora',
    description: 'Você ajuda a produtora a vender e preencher vagas de campeonato.',
    eyebrow: 'Ajudante de produtora',
    help: 'Vendas, link público e operação nos eventos liberados.',
  },
  {
    id: 'equipes',
    title: 'Equipes',
    description: 'Você é staff de equipes (convite) ou tem perfil de equipe na conta.',
    eyebrow: 'Ajudante de equipe',
    help: 'Equipes onde você é manager + painéis de equipe vinculados.',
  },
  {
    id: 'jogador',
    title: 'Jogador',
    description: 'Você ajuda jogadores ou joga com perfil vinculado na mesma conta.',
    eyebrow: 'Ajudante de jogador',
    help: 'Jogadores que você gerencia + seu perfil de atleta.',
  },
]

/** Compat: alguns atalhos antigos usavam 'vendas' / 'campeonatos'. */
export function normalizeManagerMode(raw: string | null | undefined): ManagerPanelMode {
  if (raw === 'vendas' || raw === 'campeonatos' || raw === 'produtora') return 'produtora'
  if (raw === 'equipes') return 'equipes'
  if (raw === 'jogador') return 'jogador'
  return 'hub'
}
