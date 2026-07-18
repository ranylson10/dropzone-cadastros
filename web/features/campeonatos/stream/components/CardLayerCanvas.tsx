'use client'

import type { StreamCardBlock, StreamLayer } from '../types/stream.types'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import { layerBoxStyle, resolveLayerData, type LayerResolveContext } from '../utils/resolve-layer'

export function CardLayerCanvas(props: {
  card: StreamCardBlock
  ctx: LayerResolveContext
  selectedLayerId?: string | null
  onSelectLayer?: (id: string) => void
  /** modo editor: mostra handles/outline */
  editable?: boolean
  /** preenche o pai (live com % de largura) em vez de px fixos */
  fillParent?: boolean
  className?: string
}) {
  const { card, ctx } = props
  const layers = [...(card.layers || [])].sort((a, b) => (a.z || 0) - (b.z || 0))
  const container = boxToCssSafe(card.box)

  return (
    <div
      className={`stream-card-canvas ${props.className || ''}`}
      style={{
        ...container,
        position: 'relative',
        width: props.fillParent ? '100%' : card.canvasW || 240,
        height: props.fillParent ? '100%' : card.canvasH || 160,
        overflow: 'hidden',
        boxSizing: 'border-box',
        // garante que background-image do box apareça mesmo com camadas vazias
        backgroundClip: 'padding-box',
      }}
    >
      {layers.map((layer) => (
        <LayerView
          key={layer.id}
          layer={layer}
          ctx={ctx}
          selected={props.selectedLayerId === layer.id}
          editable={props.editable}
          onSelect={() => props.onSelectLayer?.(layer.id)}
        />
      ))}
      {!layers.length ? (
        <div className="stream-prev-empty stream-block-empty" style={{ position: 'absolute', inset: 0 }}>
          {props.editable ? 'Vazio — arraste ou defina fundo / itens' : ''}
        </div>
      ) : null}
    </div>
  )
}

function LayerView(props: {
  layer: StreamLayer
  ctx: LayerResolveContext
  selected?: boolean
  editable?: boolean
  onSelect?: () => void
}) {
  const { layer } = props
  const preferImage = layer.type === 'image' || layer.type === 'logo'
  const resolved = resolveLayerData(layer.data, props.ctx, { preferImage })
  const fs = fieldToCss(layer.style)
  const box = {
    ...layerBoxStyle(layer),
    ...fs.wrap,
    ...(resolved.kind === 'image' ? {} : fs.text),
    cursor: props.editable ? 'pointer' : 'default',
    outline: props.selected ? '2px solid #dfbf4a' : props.editable ? '1px dashed rgba(255,255,255,.15)' : undefined,
    outlineOffset: props.selected ? 1 : 0,
  }

  const inner =
    resolved.kind === 'image' ? (
      resolved.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: layer.objectFit || (layer.type === 'logo' ? 'contain' : 'cover'),
            display: 'block',
          }}
        />
      ) : (
        <span className="stream-prev-logo-fallback" style={{ width: '70%', height: '70%', fontSize: 12 }}>
          {props.editable ? (layer.type === 'logo' ? 'UPLOAD LOGO' : 'UPLOAD IMG') : ''}
        </span>
      )
    ) : (
      <span style={{ width: '100%', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {resolved.text || (props.editable ? layer.name : '')}
      </span>
    )

  if (props.editable) {
    return (
      <button type="button" className="stream-layer-hit" style={box} onClick={props.onSelect}>
        {inner}
      </button>
    )
  }
  return <div style={box}>{inner}</div>
}
