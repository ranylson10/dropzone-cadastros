'use client'

import type { StreamOverlay } from '../types/stream.types'

const MOCK_OVERLAYS: StreamOverlay[] = [
  { id: 'ov-scoreboard', name: 'Placar ao vivo', kind: 'scoreboard', fields: ['line', 'kills', 'points'] },
  { id: 'ov-lower', name: 'Lower third', kind: 'lower_third', fields: ['nick', 'role'] },
  { id: 'ov-standings', name: 'Classificação', kind: 'standings', fields: ['slot', 'line', 'points'] },
]

const KIND_LABEL: Record<StreamOverlay['kind'], string> = {
  lower_third: 'Lower third',
  scoreboard: 'Placar',
  standings: 'Tabela',
  custom: 'Custom',
}

export function StreamOverlaysPanel(props: { campeonatoId: string }) {
  return (
    <section className="stream-panel" aria-label="Editor de overlays">
      <div className="stream-panel-title">
        <h4>Editor de overlays</h4>
        <span className="stream-badge">estrutura</span>
      </div>

      <div className="stream-overlays-layout">
        <aside className="stream-overlay-list">
          <strong>Overlays</strong>
          {MOCK_OVERLAYS.map((item) => (
            <div key={item.id} className="stream-overlay-item">
              <b>{item.name}</b>
              <small>{KIND_LABEL[item.kind]}</small>
            </div>
          ))}
        </aside>

        <div className="stream-overlay-stage">
          <div>
            <strong>Preview do overlay</strong>
            <p className="stream-hint">
              Em breve: editor visual e vínculos com a planilha de dados
              {props.campeonatoId ? ` · campeonato ${props.campeonatoId.slice(0, 8)}…` : ''}.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
