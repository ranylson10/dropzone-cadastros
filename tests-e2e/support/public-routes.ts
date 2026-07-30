export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/campeonatos',
  '/rank',
  '/vagas',
  '/politica-de-privacidade',
  '/termos-de-servico',
  '/exclusao-de-dados',
] as const

export function isSafeInternalHref(href: string): boolean {
  if (!href.startsWith('/')) return false
  if (href.startsWith('//')) return false
  if (href.startsWith('/api/')) return false
  if (href.includes('[token]') || href.includes('[id]')) return false
  if (href.startsWith('/broadcast/') || href.startsWith('/stream/')) return false
  return true
}
