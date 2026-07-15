/**
 * Navegação global do DropZone — única fonte de verdade.
 * Painel e páginas públicas usam o mesmo menu (AppShell / AppHeader).
 */
export type AppNavItem = {
  label: string
  href: string
}

export const APP_NAV: AppNavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Vagas abertas', href: '/vagas' },
  { label: 'Campeonatos', href: '/campeonatos' },
  { label: 'Equipes', href: '/equipes' },
  { label: 'Jogadores', href: '/jogadores' },
  { label: 'Managers', href: '/managers' },
  { label: 'Produtoras', href: '/produtoras' },
]

/** Resolve item ativo a partir do pathname. */
export function resolveActiveNavLabel(pathname?: string | null): string | undefined {
  if (!pathname) return undefined
  const clean = pathname.split('?')[0] || '/'
  if (clean === '/' || clean === '') return 'Início'
  const match = APP_NAV.find((item) => item.href !== '/' && (clean === item.href || clean.startsWith(`${item.href}/`)))
  return match?.label
}
