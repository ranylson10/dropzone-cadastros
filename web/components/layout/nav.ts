/**
 * Navegação global do DropZone — única fonte de verdade.
 * Painel e páginas públicas usam o mesmo menu (AppShell / AppHeader).
 */
export type AppNavItem = {
  label: string
  href: string
  /** Subitens (dropdown) */
  children?: AppNavItem[]
}

/**
 * Menu compacto:
 * · Vagas abertas e Produtoras ficam sob Campeonatos
 */
export const APP_NAV: AppNavItem[] = [
  { label: 'Início', href: '/' },
  {
    label: 'Campeonatos',
    href: '/campeonatos',
    children: [
      { label: 'Todos os campeonatos', href: '/campeonatos' },
      { label: 'Vagas abertas', href: '/vagas' },
      { label: 'Produtoras', href: '/produtoras' },
    ],
  },
  { label: 'Agenda', href: '/agenda' },
  { label: 'Equipes', href: '/equipes' },
  { label: 'Jogadores', href: '/jogadores' },
  { label: 'Managers', href: '/managers' },
]

/** Resolve item ativo a partir do pathname (inclui submenus). */
export function resolveActiveNavLabel(pathname?: string | null): string | undefined {
  if (!pathname) return undefined
  const clean = pathname.split('?')[0] || '/'
  if (clean === '/' || clean === '') return 'Início'

  // subpaths de campeonato / vagas / produtoras → destaca Campeonatos
  if (
    clean === '/vagas'
    || clean.startsWith('/vagas/')
    || clean === '/produtoras'
    || clean.startsWith('/produtoras/')
    || clean === '/campeonatos'
    || clean.startsWith('/campeonatos/')
  ) {
    return 'Campeonatos'
  }

  if (clean === '/agenda' || clean.startsWith('/agenda/')) {
    return 'Agenda'
  }

  for (const item of APP_NAV) {
    if (item.href !== '/' && (clean === item.href || clean.startsWith(`${item.href}/`))) {
      return item.label
    }
    if (item.children) {
      for (const child of item.children) {
        if (clean === child.href || clean.startsWith(`${child.href}/`)) {
          return item.label
        }
      }
    }
  }
  return undefined
}
