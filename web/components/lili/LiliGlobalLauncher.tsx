'use client'

import { usePathname } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { useMemo, useState } from 'react'

function entityFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0] || 'geral'
  const id = parts[1] || ''
  const map: Record<string, string> = {
    campeonatos: 'campeonato',
    equipes: 'equipe',
    jogadores: 'jogador',
    managers: 'manager',
    produtoras: 'produtora',
    carteira: 'carteira',
    agenda: 'agenda',
    broadcast: 'transmissao',
    stream: 'transmissao',
  }
  if (pathname.includes('/pontuador/')) return { type: 'pontuador', id: parts[1] || '' }
  return { type: map[first] || 'geral', id }
}

export function LiliGlobalLauncher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const entity = entityFromPath(pathname || '')
  const liliHref = useMemo(() => {
    const query = new URLSearchParams({ origem: pathname || '/', tipo: entity.type, embedded: '1' })
    if (entity.id) query.set('id', entity.id)
    return `/lili?${query.toString()}`
  }, [entity.id, entity.type, pathname])

  if (!pathname || pathname === '/lili' || pathname.startsWith('/login')) return null

  return (
    <>
      {open ? (
        <section className="lili-floating-chat" aria-label="Lili, assistente virtual">
          <header>
            <div>
              <strong>Lili</strong>
              <span>Assistente DropZone</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar Lili">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <iframe src={liliHref} title="Lili, assistente DropZone" />
        </section>
      ) : null}

      <button
        type="button"
        className="lili-global-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Fechar Lili' : 'Abrir Lili para esta página'}
        title="Pedir ajuda à Lili nesta página"
      >
        <MessageCircle size={20} aria-hidden="true" />
        <span>Lili</span>
      </button>
    </>
  )
}
