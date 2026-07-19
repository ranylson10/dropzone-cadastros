'use client'

import type { CSSProperties } from 'react'
import type { StreamCardBlock, StreamLayer } from '../types/stream.types'
import { normalizeTransition } from '../types/stream.types'
import { boxToCssSafe, fieldToCss, unitMotionClass, unitMotionStyle } from '../utils/stream-style'
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
  motion?: { kind: 'enter' | 'exit'; token: number } | null
  autoPlayEnter?: boolean
}) {
  const { card, ctx } = props
  const layers = [...(card.layers || [])].sort((a, b) => (a.z || 0) - (b.z || 0))
  const container = boxToCssSafe(card.box)
  const tr = normalizeTransition(card.transition)
  const motion =
    props.motion ||
    (props.autoPlayEnter && tr.applyTo === 'children' && tr.enter !== 'none'
      ? { kind: 'enter' as const, token: 1 }
      : null)
  const playChildren = Boolean(motion) && tr.applyTo === 'children'
  const motionKind = motion?.kind || 'enter'

  return (
    <div
      className={`stream-card-canvas ${props.className || ''}${playChildren ? ' is-motion' : ''}`}
      style={{
        ...container,
        position: 'relative',
        width: props.fillParent ? '100%' : card.canvasW || 240,
        height: props.fillParent ? '100%' : card.canvasH || 160,
        overflow: playChildren ? 'visible' : 'hidden',
        boxSizing: 'border-box',
        backgroundClip: 'padding-box',
      }}
    >
      {layers.map((layer, index) => (
        <LayerView
          key={playChildren && motion ? `${layer.id}-m-${motion.token}` : layer.id}
          layer={layer}
          ctx={ctx}
          selected={props.selectedLayerId === layer.id}
          editable={props.editable}
          onSelect={() => props.onSelectLayer?.(layer.id)}
          motionClass={playChildren ? unitMotionClass(card.transition, motionKind) : ''}
          motionStyle={playChildren ? unitMotionStyle(card.transition, motionKind, index) : undefined}
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
  motionClass?: string
  motionStyle?: CSSProperties
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
    ...props.motionStyle,
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

  const cls = `stream-layer-hit${props.motionClass ? ` ${props.motionClass}` : ''}`

  if (props.editable) {
    return (
      <button type="button" className={cls} style={box} onClick={props.onSelect}>
        {inner}
      </button>
    )
  }
  return <div className={props.motionClass || undefined} style={box}>{inner}</div>
}
