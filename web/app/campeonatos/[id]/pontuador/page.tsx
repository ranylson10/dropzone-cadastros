'use client'

import { useParams } from 'next/navigation'
import { ProducerScoringWorkspace } from '@/features/campeonatos/pontuador/ProducerScoringWorkspace'

/** Separate operational window, keeping phase and game selection available. */
export default function PontuadorCampeonatoPage() {
  const { id } = useParams<{ id: string }>()
  return <main className="dz-scorer-window" style={{ maxWidth: 1600, margin: '0 auto', padding: '24px clamp(12px, 2vw, 32px)' }}>
    <header style={{ marginBottom: 20 }}>
      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', opacity: .7 }}>DropZone / operação</span>
      <h1 style={{ margin: '6px 0 0' }}>Pontuador</h1>
      <p>Selecione a fase e o jogo. As alterações são salvas nas ferramentas do pontuador.</p>
    </header>
    {id ? <ProducerScoringWorkspace campeonatoId={id} /> : <p>Campeonato não identificado.</p>}
  </main>
}
