'use client'

import { useState } from 'react'
import { ChevronDown, Layers3, Network } from 'lucide-react'
import { CampeonatoEstruturaTab } from '@/features/campeonatos/fases'
import { AdvancedStructureTab } from './AdvancedStructureTab'

export function CampeonatoStructureWorkspace({
  campeonatoId,
  championshipType,
  onChanged,
}: {
  campeonatoId: string
  championshipType: string
  onChanged?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState<'planning' | 'groups'>('planning')

  return (
    <div className="structure-workspace">
      <div className="structure-workspace-intro">
        <p className="eyebrow">Estrutura do campeonato</p>
        <h3>Temporada, divisões, fases, grupos e progressão</h3>
        <p>
          Toda a organização competitiva fica reunida aqui. Abra somente o bloco que deseja editar para evitar uma página extensa e confusa.
        </p>
      </div>

      <section className="structure-workspace-section">
        <button type="button" className="structure-workspace-toggle" onClick={() => setOpen('planning')} aria-expanded={open === 'planning'}>
          <span><Layers3 size={18} /><span><strong>Planejamento competitivo</strong><small>Temporada, edição, divisões personalizadas, etapas, premiação e progressão.</small></span></span>
          <ChevronDown size={18} className={open === 'planning' ? 'open' : ''} />
        </button>
        {open === 'planning' ? <div className="structure-workspace-content"><AdvancedStructureTab campeonatoId={campeonatoId} championshipType={championshipType} /></div> : null}
      </section>

      <section className="structure-workspace-section">
        <button type="button" className="structure-workspace-toggle" onClick={() => setOpen('groups')} aria-expanded={open === 'groups'}>
          <span><Network size={18} /><span><strong>Fases, grupos e slots</strong><small>Monte grupos, posições e vínculos operacionais sem distribuição automática.</small></span></span>
          <ChevronDown size={18} className={open === 'groups' ? 'open' : ''} />
        </button>
        {open === 'groups' ? <div className="structure-workspace-content"><CampeonatoEstruturaTab campeonatoId={campeonatoId} onChanged={onChanged} /></div> : null}
      </section>
    </div>
  )
}
