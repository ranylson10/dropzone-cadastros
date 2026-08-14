'use client'

import { ExternalLink, MonitorUp } from 'lucide-react'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import '../stream.css'

export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const localStudioUrl = `/campeonatos/${props.campeonatoId}/stream`

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Overlays no computador</h3>
          <p>
            O editor, os projetos de live, a prévia e a exportação PNG agora funcionam no aplicativo DropZone Live Local.
            Assim, artes e overlays não ficam sendo renderizados ou armazenados no site.
          </p>
        </div>
        <div className="stream-panel-actions">
          <StreamSpreadsheetPanel
            campeonatoId={props.campeonatoId}
            asModal
            showTrigger
            triggerLabel="Ver dados"
          />
          <a className="stream-primary-btn" href={localStudioUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Guia do app local
          </a>
        </div>
      </header>

      <section className="stream-panel" aria-label="Fluxo da transmissão local">
        <div className="stream-panel-title">
          <div>
            <h4><MonitorUp size={18} /> Produção local</h4>
            <p className="stream-hint">
              Continue lançando as partidas e acompanhando os dados no DropZone. No app, informe este campeonato para sincronizar
              equipes, estatísticas e logos uma vez; depois o OBS ou vMix lê somente a saída local.
            </p>
          </div>
        </div>
        <div className="stream-error" role="note">
          Durante o teste, o instalador é entregue diretamente. A área de download público será adicionada ao site depois da validação.
        </div>
      </section>
    </div>
  )
}
