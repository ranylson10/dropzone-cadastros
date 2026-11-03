/** Navegação do DropZone R20: o essencial é direto, ferramentas em "Mais". */
export type AppNavItem = {
  label: string
  href: string
  children?: AppNavItem[]
}

export function hasPublicDiscoveryNavigation(pathname: string) {
  if (['/', '/rank', '/agenda', '/carrinho', '/carteira',
    '/lili', '/afiliados', '/termos-de-servico', '/politica-de-privacidade',
    '/exclusao-de-dados'].includes(pathname)) return true
  if (/^\/campeonatos\/[^/]+\/regulamento\/?$/.test(pathname)) return true
  return /^\/(?:campeonatos|equipes|jogadores|produtoras|managers)(?:\/[^/]+)?\/?$/.test(pathname)
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Campeonatos', href: '/campeonatos' },
  { label: 'Equipes', href: '/equipes' },
  { label: 'Jogadores', href: '/jogadores' },
  {
    label: 'Mais', href: '/agenda',
    children: [
      { label: 'Produtoras', href: '/produtoras' },
      { label: 'Ranking', href: '/rank' },
      { label: 'Agenda', href: '/agenda' },
      { label: 'Central do campeonato', href: '/central-campeonato' },
      { label: 'Carteira', href: '/carteira' },
      { label: 'Afiliados', href: '/afiliados' },
      { label: 'Lili', href: '/lili' },
    ],
  },
]

export function resolveActiveNavLabel(pathname?: string | null): string | undefined {
  if (!pathname) return undefined
  const clean = pathname.split('?')[0] || '/'
  if (clean === '/') return 'Início'
  if (/^\/(?:campeonatos|vagas)(?:\/|$)/.test(clean)) return 'Campeonatos'
  if (/^\/equipes(?:\/|$)/.test(clean)) return 'Equipes'
  if (/^\/jogadores(?:\/|$)/.test(clean)) return 'Jogadores'
  if (APP_NAV[4].children?.some((item) => clean === item.href || clean.startsWith(`${item.href}/`))) return 'Mais'
  if (/^\/(?:central-campeonato|carrinho|vendas|vendedores|produtoras|managers)(?:\/|$)/.test(clean)) return 'Mais'
  return undefined
}
