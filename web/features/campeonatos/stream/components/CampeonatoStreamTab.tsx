'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { StreamOverlaysHub } from './StreamOverlaysHub'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import '../stream.css'

/**
 * Hub Stream no painel do campeonato.
 * Planilha abre em menu suspenso (modal) por cima da página — sem lateral espremida.
 */
export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const workspaceUrl = `/campeonatos/${props.campeonatoId}/stream`
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            Overlays e planilha de dados ao vivo. A planilha abre em painel flutuante no topo
            (equipes, MVP, mapas, partida atual/próxima).
          </p>
        </div>
        <div className="stream-panel-actions">
          <StreamSpreadsheetPanel
            campeonatoId={props.campeonatoId}
            asModal
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            showTrigger
            triggerLabel="Planilha de dados"
          />
          <a className="stream-secondary-btn" href={workspaceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Workspace
          </a>
        </div>
      </header>

      <StreamOverlaysHub campeonatoId={props.campeonatoId} />
    </div>
  )
}
