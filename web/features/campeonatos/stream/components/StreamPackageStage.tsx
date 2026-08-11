'use client'

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type {
  StreamOutputProfileId,
  StreamOverlayPackage,
  StreamPackageRenderData,
  StreamPackageRenderItem,
  StreamSystemOverlayType,
} from '../types/stream-package.types'
import {
  resolveStreamAsset,
  resolveStreamCardConfig,
  resolveStreamLayoutConfig,
  resolveStreamLooseImageConfig,
  resolveStreamLooseTextConfig,
  resolveStreamOverlayConfig,
  resolveStreamTableConfig,
} from '../services/stream-package-config'
import {
  STREAM_OVERLAY_COLUMN_META,
  STREAM_SYSTEM_OVERLAY_LAYOUTS,
  STREAM_SYSTEM_OVERLAY_META,
} from '../types/stream-package.types'

type CellValue = string | number | null | undefined

function cssBackground(url: string) {
  return url ? `url("${url.replaceAll('\"', '%22')}")` : undefined
}

function splitItems(items: StreamPackageRenderItem[], mode: 'single' | 'double') {
  if (mode === 'single') return [items]
  const midpoint = Math.ceil(items.length / 2)
  return [items.slice(0, midpoint), items.slice(midpoint)]
}

function cellClass(column: string) {
  if (column === 'rank') return 'is-rank'
  if (column === 'logo') return 'is-logo'
  if (column === 'name' || column === 'nick') return 'is-name'
  if (column === 'points') return 'is-points'
  return 'is-stat'
}

function renderCellValue(column: string, value: CellValue) {
  if (column === 'movement') {
    const amount = Number(String(value ?? '0').replace('+', '')) || 0
    const direction = amount > 0 ? 'up' : amount < 0 ? 'down' : 'same'
    return <span className={`stream-package-rank-movement is-${direction}`}><i aria-hidden>{amount > 0 ? '▲' : amount < 0 ? '▼' : '—'}</i>{amount > 0 ? `+${amount}` : amount < 0 ? String(amount) : '0'}</span>
  }
  if (column === 'logo' || column === 'map') {
    const src = String(value || '').trim()
    return src ? <img src={src} alt="" /> : <span className="stream-package-render-placeholder">—</span>
  }
  return String(value ?? '—')
}

function TableRenderer(props: {
  pack: StreamOverlayPackage
  type: StreamSystemOverlayType
  data: StreamPackageRenderData
  outputProfileId?: StreamOutputProfileId
  contentOnly?: boolean
  animationTest?: 'enter' | 'exit'
}) {
  const config = resolveStreamOverlayConfig(props.pack, props.type, props.outputProfileId)
  const columns = (config.columns || []).filter((column) => STREAM_OVERLAY_COLUMN_META[column])
  const maxItems = Math.max(1, Number(config.maxItems || props.data.items.length || 1))
  const items = props.data.items.slice(0, maxItems)
  const shared = resolveStreamTableConfig(props.pack, props.type, props.outputProfileId)
  const mode = props.contentOnly ? 'single' : (config.tableMode || shared.mode)
  const panels = splitItems(items, mode)

  return (
    <div
      className={`stream-package-render-table mode-${mode}`}
      style={{
        gap: shared.panelGap,
        '--stream-package-row-height': `${shared.rowHeight}px`,
        '--stream-package-row-gap': `${shared.rowGap}px`,
        '--stream-package-cell-gap': `${shared.cellGap}px`,
        '--stream-package-header-height': `${shared.headerHeight}px`,
        '--stream-package-logo-width': `${shared.logoWidth}px`,
        '--stream-package-stat-width': `${shared.statWidth}px`,
        '--stream-package-points-width': `${shared.pointsWidth}px`,
        '--stream-package-name-align': shared.nameAlign,
        '--stream-package-name-justify': shared.nameAlign === 'left' ? 'flex-start' : shared.nameAlign === 'right' ? 'flex-end' : 'center',
      } as CSSProperties}
    >
      {panels.map((panel, panelIndex) => (
        <div className="stream-package-render-table-panel" key={panelIndex}>
          {shared.showHeaders ? (
            <div className="stream-package-render-table-row is-header">
              {columns.map((column) => (
                <div className={`stream-package-render-cell ${cellClass(column)}`} key={column} style={{ display: config.hiddenHeaders?.includes(column) ? 'none' : undefined, color: shared.headerColor || undefined, fontFamily: shared.headerFontFamily || undefined, fontSize: shared.headerFontSize || undefined, fontWeight: shared.headerFontWeight || undefined, fontStyle: shared.headerFontStyle || undefined, textAlign: shared.headerAlign, justifyContent: shared.headerAlign === 'left' ? 'flex-start' : shared.headerAlign === 'right' ? 'flex-end' : 'center' }}>
                  {config.columnLabels?.[column] ?? STREAM_OVERLAY_COLUMN_META[column].label}
                </div>
              ))}
            </div>
          ) : null}
          <div className="stream-package-render-table-body">
            {panel.map((item, index) => (
              <div
                className="stream-package-render-table-row"
                key={`${panelIndex}-${index}`}
                style={{
                  backgroundImage: cssBackground(resolveStreamAsset(props.pack, props.type, 'table_row_bg', props.outputProfileId)),
                  animationDelay: `${index * props.pack.shared_config.animation.staggerMs}ms`,
                }}
              >
                {columns.map((column) => {
                  const style = shared.columnStyles[column as keyof typeof shared.columnStyles]
                  const backgroundImage = style.backgroundType === 'image'
                    ? (style.assetKey ? cssBackground(resolveStreamAsset(props.pack, props.type, style.assetKey, props.outputProfileId)) : undefined)
                    : style.backgroundType === 'gradient' ? style.backgroundGradient : undefined
                  return (
                    <div
                      className={`stream-package-render-cell ${cellClass(column)}`}
                      key={column}
                      style={{
                        backgroundImage,
                        backgroundColor: style.backgroundType === 'solid' ? style.backgroundColor : undefined,
                        color: style.color,
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        fontStyle: style.fontStyle,
                        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
                        borderRadius: style.borderRadius,
                        padding: `${style.paddingY ?? 6}px ${style.paddingX ?? 12}px`,
                        ...(style.width ? { flex: `0 0 ${style.width}px`, minWidth: style.width } : {}),
                        justifyContent: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
                        textAlign: style.align,
                      }}
                    >
                      {renderCellValue(column, item[column])}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function cardTitle(type: StreamSystemOverlayType, item: StreamPackageRenderItem) {
  if (type === 'qualified_teams') return String(item.name || item.category || 'Equipe')
  return String(item.name || item.nick || item.title || '—')
}

function CardRenderer(props: {
  pack: StreamOverlayPackage
  type: StreamSystemOverlayType
  data: StreamPackageRenderData
  outputProfileId?: StreamOutputProfileId
  contentOnly?: boolean
}) {
  const config = resolveStreamOverlayConfig(props.pack, props.type, props.outputProfileId)
  const maxItems = Math.max(1, Number(config.maxItems || props.data.items.length || 1))
  const items = props.data.items.slice(0, maxItems)
  const card = resolveStreamCardConfig(props.pack, props.type, props.outputProfileId)
  const layout = STREAM_SYSTEM_OVERLAY_LAYOUTS[props.type]
  const cardWidth = layout.variant === 'map-card' ? Math.max(card.width, 500) : card.width
  const cardHeight = layout.variant === 'logo-card' ? Math.min(card.height, 300) : card.height
  const mediaHeight = layout.variant === 'logo-card' ? Math.min(card.imageHeight, 190) : card.imageHeight
  const maxColumns = Math.max(1, Math.min(8, card.columns || 1))
  const maxRowWidth = (cardWidth * maxColumns) + (card.gap * Math.max(0, maxColumns - 1))
  const justifyContent = card.align === 'start' ? 'flex-start' : card.align === 'end' ? 'flex-end' : 'center'

  return (
    <div
      className={`stream-package-render-cards variant-${layout.variant}`}
      style={{
        gap: card.gap,
        maxWidth: Math.min(1760, maxRowWidth),
        justifyContent,
        '--stream-package-card-logo-scale': card.logoScale,
      } as CSSProperties}
    >
      {items.map((item, index) => (
        <article
          className="stream-package-render-card"
          key={index}
          style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: card.radius,
            backgroundImage: cssBackground(resolveStreamAsset(props.pack, props.type, 'card_bg', props.outputProfileId)),
            animationDelay: `${index * props.pack.shared_config.animation.staggerMs}ms`,
          }}
        >
          <div className="stream-package-render-card-media" style={{ height: mediaHeight }}>
            {item.map ? <img className="stream-package-render-card-map" src={String(item.map)} alt="" /> : null}
            {item.logo ? <img className="stream-package-render-card-logo" src={String(item.logo)} alt="" /> : null}
            {item.rank !== undefined ? <span className="stream-package-render-card-rank">#{String(item.rank)}</span> : null}
          </div>
          <div
            className="stream-package-render-card-content"
            style={{ backgroundImage: cssBackground(resolveStreamAsset(props.pack, props.type, 'card_stats_bg', props.outputProfileId)) }}
          >
            <strong>{cardTitle(props.type, item)}</strong>
            <div className="stream-package-render-card-stats">
              {item.points !== undefined ? <span><small>PTS</small>{String(item.points)}</span> : null}
              {item.kills !== undefined ? <span><small>ABT</small>{String(item.kills)}</span> : null}
              {item.category !== undefined && props.type !== 'qualified_teams' ? <span>{String(item.category)}</span> : null}
              {props.type === 'qualified_teams' && item.category !== undefined ? <span className="is-category">{String(item.category)}</span> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function MvpGeneralRenderer(props: {
  pack: StreamOverlayPackage
  data: StreamPackageRenderData
  outputProfileId?: StreamOutputProfileId
}) {
  const config = resolveStreamOverlayConfig(props.pack, 'mvp_general', props.outputProfileId)
  const maxItems = Math.max(1, Number(config.maxItems || props.data.items.length || 1))
  const items = props.data.items.slice(0, maxItems)
  const leader = items[0]

  if (!leader) return null

  return (
    <div className="stream-package-mvp-general">
      <article
        className="stream-package-mvp-general-leader"
        style={{ backgroundImage: cssBackground(resolveStreamAsset(props.pack, 'mvp_general', 'card_bg', props.outputProfileId)) }}
      >
        <small>TOP 1 · MVP GERAL</small>
        <div className="stream-package-mvp-general-media">
          {leader.logo ? <img src={String(leader.logo)} alt="" /> : <span className="stream-package-render-placeholder">—</span>}
        </div>
        <strong>{String(leader.nick || leader.name || '—')}</strong>
        <div className="stream-package-mvp-general-stats" style={{ backgroundImage: cssBackground(resolveStreamAsset(props.pack, 'mvp_general', 'card_stats_bg', props.outputProfileId)) }}>
          {leader.kills !== undefined ? <span><b>{String(leader.kills)}</b><small>ABT</small></span> : null}
          {leader.kd !== undefined ? <span><b>{String(leader.kd)}</b><small>K.D</small></span> : null}
          {leader.drops !== undefined ? <span><b>{String(leader.drops)}</b><small>QD</small></span> : null}
        </div>
      </article>
      <div className="stream-package-mvp-general-ranking">
        {items.length > 1 ? <TableRenderer pack={props.pack} type="mvp_general" data={{ ...props.data, items: items.slice(1) }} outputProfileId={props.outputProfileId} /> : null}
      </div>
    </div>
  )
}

function HeroRenderer(props: {
  pack: StreamOverlayPackage
  type: StreamSystemOverlayType
  data: StreamPackageRenderData
}) {
  const item = props.data.items[0] || {}
  const layout = STREAM_SYSTEM_OVERLAY_LAYOUTS[props.type]
  const title = props.type === 'next_round'
    ? String(item.round || item.title || 'Próxima queda')
    : String(item.name || item.title || 'Campeão')

  return (
    <div className={`stream-package-render-hero variant-${layout.variant}`}>
      {item.map ? <img className="stream-package-render-hero-map" src={String(item.map)} alt="" /> : null}
      {item.logo ? <img className="stream-package-render-hero-logo" src={String(item.logo)} alt="" /> : null}
      <div className="stream-package-render-hero-copy">
        {props.type === 'next_round' ? <small>PRÓXIMA QUEDA</small> : null}
        {props.type === 'champion' ? <small>CAMPEÃO</small> : null}
        <strong>{title}</strong>
      </div>
    </div>
  )
}

function SceneItemsRenderer({ items, onMove }: { items: ReturnType<typeof resolveStreamOverlayConfig>['sceneItems']; onMove?: (id: string, x: number, y: number) => void }) {
  return <>{(items || []).filter((item) => item.show).map((item) => {
    const style = { left: item.x, top: item.y, width: item.width, height: item.height, color: item.color, fontSize: item.fontSize, fontWeight: item.fontWeight, backgroundImage: cssBackground(item.backgroundUrl || ''), backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } as CSSProperties
    const drag = (event: ReactPointerEvent<HTMLElement>) => {
      if (!onMove) return
      event.preventDefault()
      const root = event.currentTarget.closest('.stream-package-render-root') as HTMLElement | null
      const scale = root ? 1920 / Math.max(1, root.getBoundingClientRect().width) : 1
      const startX = event.clientX; const startY = event.clientY; const x = item.x; const y = item.y
      const move = (moveEvent: PointerEvent) => onMove(item.id, Math.round(x + (moveEvent.clientX - startX) * scale), Math.round(y + (moveEvent.clientY - startY) * scale))
      const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', end)
    }
    if (item.type === 'image') return <img className="stream-package-scene-item is-image" key={item.id} src={item.imageUrl || ''} alt="" style={{ ...style, objectFit: 'contain' }} onPointerDown={drag} />
    if (item.type === 'timer') return <div className="stream-package-scene-item is-timer" key={item.id} style={style}>{item.text || '00:00'}</div>
    if (item.type === 'round_counter') {
      const total = Math.max(1, item.totalRounds || 1); const current = Math.min(total, item.currentRound || 1)
      return <div className="stream-package-scene-item is-round-counter" key={item.id} style={style} onPointerDown={drag}><b>QUEDA</b><div>{Array.from({ length: total }, (_, index) => <img key={index} src={index + 1 < current ? item.pastUrl : index + 1 === current ? item.currentUrl : item.nextUrl} alt="" />)}</div><strong>{current}/{total}</strong></div>
    }
    return <div className="stream-package-scene-item is-text" key={item.id} style={style} onPointerDown={drag}>{item.text || 'Texto livre'}</div>
  })}</>
}

export function StreamPackageStage(props: {
  pack: StreamOverlayPackage
  type: StreamSystemOverlayType
  data: StreamPackageRenderData
  preview?: boolean
  canvasWidth?: number
  canvasHeight?: number
  outputProfileId?: StreamOutputProfileId
  contentOnly?: boolean
  animationTest?: 'enter' | 'exit'
  onSceneItemMove?: (id: string, x: number, y: number) => void
}) {
  const meta = STREAM_SYSTEM_OVERLAY_META[props.type]
  const layout = STREAM_SYSTEM_OVERLAY_LAYOUTS[props.type]
  const outputProfileId = props.outputProfileId || 'live-hd'
  const config = resolveStreamOverlayConfig(props.pack, props.type, outputProfileId)
  const looseImage = resolveStreamLooseImageConfig(props.pack, props.type, outputProfileId)
  const looseText = resolveStreamLooseTextConfig(props.pack, props.type, outputProfileId)
  const eventLogo = looseImage.assetKey ? resolveStreamAsset(props.pack, props.type, looseImage.assetKey, outputProfileId) : ''
  const topArt = resolveStreamAsset(props.pack, props.type, 'top_art', outputProfileId)
  const animation = props.pack.shared_config.animation
  const sharedLayout = resolveStreamLayoutConfig(props.pack, props.type, outputProfileId)
  const canvasWidth = Math.max(1, Number(props.canvasWidth || 1920))
  const canvasHeight = Math.max(1, Number(props.canvasHeight || 1080))
  const designScale = Math.min(canvasWidth / 1920, canvasHeight / 1080)

  return (
    <div
      className={`stream-package-render-root overlay-${props.type} fx-${props.animationTest === 'exit' ? (animation.exit || 'fade') : animation.enter}${props.preview ? ' is-preview' : ''}`}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        '--stream-package-primary': props.pack.shared_config.identity.primaryColor,
        '--stream-package-secondary': props.pack.shared_config.identity.secondaryColor,
        '--stream-package-font': props.pack.shared_config.identity.fontFamily,
        '--stream-package-enter-ms': `${animation.durationMs}ms`,
        '--stream-package-enter-delay': `${animation.delayMs || 0}ms`,
        '--stream-package-enter-px': `${animation.distancePx}px`,
      } as CSSProperties}
    >
      <div
        className="stream-package-render-design"
        style={{ transform: `translate(-50%, -50%) scale(${designScale})` }}
      >
        {!props.contentOnly && topArt ? <img className="stream-package-render-top-art" src={topArt} alt="" /> : null}
      {!props.contentOnly && looseImage.show && eventLogo ? (
        <img
          className="stream-package-render-loose-image"
          src={eventLogo}
          alt=""
          style={{
            left: looseImage.x,
            top: looseImage.y,
            width: looseImage.width,
            height: looseImage.height,
            objectFit: looseImage.fit,
          }}
        />
      ) : null}
      {!props.contentOnly && looseText.show ? (
        <div
          className="stream-package-render-loose-text"
          style={{
            left: looseText.x,
            top: looseText.y,
            width: looseText.width,
            fontFamily: looseText.fontFamily || props.pack.shared_config.identity.fontFamily,
            fontSize: looseText.fontSize,
            fontWeight: looseText.fontWeight,
            color: looseText.color,
            textAlign: looseText.align,
          }}
        >
          {config.title || meta.name}
        </div>
      ) : null}
      {!props.contentOnly ? <SceneItemsRenderer items={config.sceneItems} onMove={props.onSceneItemMove} /> : null}

      <div
        className={`stream-package-render-content structure-${meta.structure} variant-${layout.variant}${props.contentOnly ? ' is-content-only' : ''}`}
        style={{
          left: props.contentOnly ? 0 : layout.content.x + sharedLayout.offsetX,
          top: props.contentOnly ? 0 : layout.content.y + sharedLayout.offsetY,
          width: props.contentOnly ? 1920 : layout.content.width * sharedLayout.widthScale,
          height: props.contentOnly ? 1080 : layout.content.height * sharedLayout.heightScale,
        }}
      >
        {!props.data.items.length ? (
          <div className="stream-package-render-empty">{props.data.emptyMessage || 'Sem dados disponíveis para esta overlay.'}</div>
        ) : null}
        {props.data.items.length && props.type === 'mvp_general' ? <MvpGeneralRenderer pack={props.pack} data={props.data} outputProfileId={outputProfileId} /> : null}
        {props.data.items.length && meta.structure === 'table' && props.type !== 'mvp_general' ? <TableRenderer pack={props.pack} type={props.type} data={props.data} outputProfileId={outputProfileId} contentOnly={props.contentOnly} /> : null}
        {props.data.items.length && meta.structure === 'cards' ? <CardRenderer pack={props.pack} type={props.type} data={props.data} outputProfileId={outputProfileId} /> : null}
        {props.data.items.length && meta.structure === 'hero' ? <HeroRenderer pack={props.pack} type={props.type} data={props.data} /> : null}
      </div>
      </div>
    </div>
  )
}
