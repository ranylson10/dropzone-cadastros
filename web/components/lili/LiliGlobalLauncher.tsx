'use client'

import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

function entityFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0] || 'geral'
  const id = parts[1] || ''
  const map: Record<string, string> = {
    campeonatos: 'campeonato', equipes: 'equipe', jogadores: 'jogador', managers: 'manager',
    produtoras: 'produtora', carteira: 'carteira', agenda: 'agenda', broadcast: 'transmissao', stream: 'transmissao',
  }
  if (pathname.includes('/pontuador/')) return { type: 'pontuador', id: parts[1] || '' }
  return { type: map[first] || 'geral', id }
}

export function LiliGlobalLauncher() {
  const pathname = usePathname()
  if (!pathname || pathname === '/lili' || pathname.startsWith('/login')) return null
  const entity = entityFromPath(pathname)
  const query = new URLSearchParams({ origem: pathname, tipo: entity.type })
  if (entity.id) query.set('id', entity.id)

  return (
    <a className="lili-global-launcher" href={`/lili?${query.toString()}`} aria-label="Abrir Lili para esta página" title="Pedir ajuda à Lili nesta página">
      <MessageCircle size={20} aria-hidden="true" />
      <span>Lili</span>
    </a>
  )
}
