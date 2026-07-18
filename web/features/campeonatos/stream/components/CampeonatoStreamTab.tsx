'use client'

import { useState } from 'react'
import type { StreamInnerPanel } from '../types/stream.types'
import { StreamOverlaysPanel } from './StreamOverlaysPanel'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import '../stream.css'

/**
 * Aba Stream do campeonato (estrutura).
 * Não altera APIs nem outras abas — só UI preparatória.
 */
export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const [panel, setPanel] = useState<StreamInnerPanel>('overlays')

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            Editor de overlays e planilha de dados para vincular informações em tempo real. Estrutura inicial — sem
            impacto no restante do campeonato.
          </p>
        </div>
        <nav className="stream-inner-tabs" aria-label="Seções da aba Stream">
          <button
            type="button"
            className={panel === 'overlays' ? 'active' : ''}
            onClick={() => setPanel('overlays')}
          >
            Overlays
          </button>
          <button
            type="button"
            className={panel === 'planilha' ? 'active' : ''}
            onClick={() => setPanel('planilha')}
          >
            Planilha
          </button>
        </nav>
      </header>

      {panel === 'overlays' ? <StreamOverlaysPanel campeonatoId={props.campeonatoId} /> : null}
      {panel === 'planilha' ? <StreamSpreadsheetPanel campeonatoId={props.campeonatoId} /> : null}
    </div>
  )
}
