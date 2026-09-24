/**
 * Navegação global do DropZone — única fonte de verdade.
 *
 * Regra de produto:
 * - nível 1 mostra apenas áreas essenciais;
 * - nível 2 agrupa ferramentas por contexto;
 * - rotas antigas continuam válidas para preservar links e favoritos.
 */
export type AppNavItem = {
  label: string
  href: string
  children?: AppNavItem[]
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Início', href: '/' },
  {
    label: 'Competições',
    href: '/campeonatos',
    children: [
      { label: 'Campeonatos', href: '/campeonatos' },
      { label: 'Vagas abertas', href: '/vagas' },
      { label: 'Central do campeonato', href: '/central-campeonato' },
    ],
  },
  {
    label: 'Comunidade',
    href: '/comunidade',
    children: [
      { label: 'Equipes', href: '/equipes' },
      { label: 'Jogadores', href: '/jogadores' },
      { label: 'Ranking', href: '/rank' },
      { label: 'Produtoras', href: '/produtoras' },
    ],
  },
  { label: 'Carteira', href: '/carteira' },
  {
    label: 'Mais',
    href: '/agenda',
    children: [
      { label: 'Agenda', href: '/agenda' },
      { label: 'Afiliados', href: '/afiliados' },
      { label: 'Lili', href: '/lili' },
    ],
  },
]

/** Resolve a área principal ativa a partir do pathname. */
export function resolveActiveNavLabel(pathname?: string | null): string | undefined {
  if (!pathname) return undefined
  const clean = pathname.split('?')[0] || '/'
  if (clean === '/' || clean === '') return 'Início'

  if (
    clean === '/campeonatos'
    || clean.startsWith('/campeonatos/')
    || clean === '/vagas'
    || clean.startsWith('/vagas/')
    || clean === '/central-campeonato'
    || clean.startsWith('/central-campeonato/')
  ) return 'Competições'

  if (
    clean === '/comunidade'
    || clean.startsWith('/comunidade/')
    || clean === '/equipes'
    || clean.startsWith('/equipes/')
    || clean === '/jogadores'
    || clean.startsWith('/jogadores/')
    || clean === '/rank'
    || clean.startsWith('/rank/')
    || clean === '/produtoras'
    || clean.startsWith('/produtoras/')
  ) return 'Comunidade'

  if (
    clean === '/carteira'
    || clean.startsWith('/carteira/')
    || clean === '/carrinho'
    || clean.startsWith('/carrinho/')
    || clean === '/vendas'
    || clean.startsWith('/vendas/')
  ) return 'Carteira'

  if (
    clean === '/agenda'
    || clean.startsWith('/agenda/')
    || clean === '/afiliados'
    || clean.startsWith('/afiliados/')
    || clean === '/managers'
    || clean.startsWith('/managers/')
    || clean === '/lili'
    || clean.startsWith('/lili/')
  ) return 'Mais'

  for (const item of APP_NAV) {
    if (item.href !== '/' && (clean === item.href || clean.startsWith(`${item.href}/`))) return item.label
    for (const child of item.children || []) {
      if (clean === child.href || clean.startsWith(`${child.href}/`)) return item.label
    }
  }
  return undefined
}
