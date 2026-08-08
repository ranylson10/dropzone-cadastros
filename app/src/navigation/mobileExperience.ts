import { MobileQuickAction, ProfileType } from '@/types/dropzone'

export const mobileQuickActions: MobileQuickAction[] = [
  {
    id: 'browse_vacancies',
    title: 'Campeonatos com vagas',
    description: 'Encontrar eventos abertos e comprar vaga com poucos toques.',
    profileTypes: ['jogador', 'equipe', 'manager'],
    priority: 10,
  },
  {
    id: 'my_championships',
    title: 'Meus campeonatos',
    description: 'Acompanhar grupos, jogos, status da inscrição e próximas ações.',
    profileTypes: ['jogador', 'equipe', 'produtora', 'manager', 'broadcast'],
    priority: 20,
  },
  {
    id: 'lineup',
    title: 'Escalar jogadores',
    description: 'Completar elenco, copiar link de escalação e ver prazo por jogo.',
    profileTypes: ['equipe', 'manager'],
    priority: 30,
  },
  {
    id: 'team_roster',
    title: 'Equipe e lines',
    description: 'Gerenciar elenco, convites e lines que vão disputar eventos.',
    profileTypes: ['equipe', 'manager'],
    priority: 40,
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description: 'Ver jogos de hoje, prazo de escalação e compromissos.',
    profileTypes: ['jogador', 'equipe', 'produtora', 'manager', 'broadcast'],
    priority: 50,
  },
  {
    id: 'invites',
    title: 'Convites',
    description: 'Aceitar ou recusar convites de equipe, campeonato e staff.',
    profileTypes: ['jogador', 'equipe', 'produtora', 'manager'],
    priority: 60,
  },
  {
    id: 'seller_sales',
    title: 'Vendas',
    description: 'Gerar pagamento, acompanhar venda e copiar link de inscrição.',
    profileTypes: ['manager'],
    priority: 70,
  },
  {
    id: 'producer_overview',
    title: 'Painel rápido',
    description: 'Resumo de inscrições, pagamentos, jogos e alertas da produtora.',
    profileTypes: ['produtora'],
    priority: 80,
  },
  {
    id: 'wallet',
    title: 'Carteira',
    description: 'Ver saldo, comissões e comprovantes.',
    profileTypes: ['equipe', 'produtora', 'manager'],
    priority: 90,
  },
  {
    id: 'commerce',
    title: 'Carrinho e favoritos',
    description: 'Retomar vagas salvas, revisar quantidades e iniciar pagamento.',
    profileTypes: ['jogador', 'equipe', 'manager'],
    priority: 95,
  },
  {
    id: 'lili',
    title: 'Falar com a Lili',
    description: 'Resolver dúvidas e abrir o lugar certo sem procurar menu.',
    profileTypes: ['jogador', 'equipe', 'produtora', 'manager', 'broadcast'],
    priority: 100,
  },
]

export function actionsForProfile(profileType: ProfileType) {
  return mobileQuickActions
    .filter((action) => action.profileTypes.includes(profileType))
    .sort((a, b) => a.priority - b.priority)
}
