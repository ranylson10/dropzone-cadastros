export type ManagerPanelMode = 'hub' | 'vendas' | 'campeonatos' | 'equipes' | 'jogador'

export type ManagerChampTab = 'equipes' | 'jogadores' | 'grupos' | 'jogos' | 'estatisticas' | 'info'

export const MANAGER_MODE_CARDS: Array<{
  id: Exclude<ManagerPanelMode, 'hub'>
  title: string
  description: string
  eyebrow: string
}> = [
  {
    id: 'vendas',
    title: 'Vendas',
    description: 'WhatsApp, link público e anunciar eventos — passo 1 e 2 do fluxo.',
    eyebrow: 'Afiliado',
  },
  {
    id: 'campeonatos',
    title: 'Campeonatos',
    description: 'Preencher vagas vendidas, ver grupos/jogos e pontuar se liberado.',
    eyebrow: 'Operação',
  },
  {
    id: 'equipes',
    title: 'Equipes',
    description: 'Painel de equipe quando você também gerencia elenco.',
    eyebrow: 'Líder / staff',
  },
  {
    id: 'jogador',
    title: 'Jogador',
    description: 'Painel competitivo quando você joga com perfil vinculado.',
    eyebrow: 'Atleta',
  },
]
