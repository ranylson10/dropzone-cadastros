'use client'

import type { StreamBlock } from '../../types/stream.types'
import { transitionClass, transitionStyle } from '../../utils/stream-style'
import { ensureTableStructure } from '../../utils/table-structure'
import { CardLayerCanvas } from '../CardLayerCanvas'
import { StreamTableCanvas } from '../StreamTableCanvas'
import type { LayerResolveContext } from '../../utils/resolve-layer'

export type PreviewStanding = {
  pos: number
  nome: string
  logo?: string
  booyah: string
  abates: string
  pts: string
  delta?: string
  quedas?: string
  kd?: string
}

export type PreviewMap = {
  title: string
  imageUrl?: string
  logo?: string
  pts: string
  abates: string
  nome?: string
}

export function OverlayPreview(props: {
  blocks: StreamBlock[]
  selectedBlockId: string | null
  selectedLayerId?: string | null
  onSelectBlock: (id: string) => void
  onSelectLayer?: (layerId: string) => void
  standings: PreviewStanding[]
  mvp?: PreviewStanding[]
  maps: PreviewMap[]
  layout: 'map_cards' | 'standings' | 'mvp_combo' | 'custom'
  /** se true, só mostra o bloco selecionado em grande (modo pasta aberta) */
  focusSelected?: boolean
}) {
  const mvpList = props.mvp?.length ? props.mvp : props.standings
  const ctx: LayerResolveContext = {
    mapas: props.maps,
    classificacao: props.standings,
    mvp: mvpList,
  }

  const blocks = props.focusSelected && props.selectedBlockId
    ? props.blocks.filter((b) => b.id === props.selectedBlockId)
    : props.blocks

  return (
    <div className={`stream-preview-stage layout-${props.focusSelected ? 'focus' : props.layout}`}>
      {blocks.map((block, index) => {
        if (block.type === 'card') {
          return (
            <div
              key={block.id}
              className={`stream-prev-card-wrap ${props.selectedBlockId === block.id ? 'is-selected' : ''} ${transitionClass(block.transition)}`}
              style={transitionStyle(block.transition, index)}
              onClick={() => props.onSelectBlock(block.id)}
            >
              <CardLayerCanvas
                card={block}
                ctx={ctx}
                editable={props.selectedBlockId === block.id}
                selectedLayerId={props.selectedBlockId === block.id ? props.selectedLayerId : null}
                onSelectLayer={props.onSelectLayer}
              />
            </div>
          )
        }
        const table = ensureTableStructure(block)
        const selected = props.selectedBlockId === block.id
        return (
          <div
            key={block.id}
            role="button"
            tabIndex={0}
            className={`stream-prev-table ${selected ? 'is-selected' : ''} ${transitionClass(block.transition)}`}
            style={transitionStyle(block.transition, index)}
            onClick={() => props.onSelectBlock(block.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') props.onSelectBlock(block.id)
            }}
          >
            <StreamTableCanvas
              table={table}
              standings={props.standings}
              mvpRows={mvpList}
              editable={selected}
              selectedRowId={selected ? props.selectedLayerId : null}
              onSelectRow={props.onSelectLayer}
            />
          </div>
        )
      })}
      {!blocks.length ? (
        <div className="stream-prev-empty">Adicione uma pasta Card ou Tabela para começar.</div>
      ) : null}
    </div>
  )
}
