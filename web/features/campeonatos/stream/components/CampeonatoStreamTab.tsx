'use client'

import { ExternalLink } from 'lucide-react'
import { StreamOverlaysHub } from './StreamOverlaysHub'
import '../stream.css'

/**
 * Hub Stream no painel do campeonato.
 * Lista de overlays + atalho para planilha em tela cheia.
 * Editor e planilha pesada abrem em outra aba/rota.
 */
export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const workspaceUrl = `/campeonatos/${props.campeonatoId}/stream`

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            Gerencie overlays aqui. A planilha com dados reais e o editor abrem em tela cheia (outra aba),
            no estilo vMix / Google Sheets.
          </p>
        </div>
        <div className="stream-panel-actions">
          <a className="stream-primary-btn" href={workspaceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Abrir planilha
          </a>
        </div>
      </header>

      <StreamOverlaysHub campeonatoId={props.campeonatoId} />
    </div>
  )
}
