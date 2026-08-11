'use client'

import type { CSSProperties } from 'react'
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

function cellStyleKey(column: string): 'rank' | 'logo' | 'name' | 'stat' | 'points' {
  if (column === 'rank') return 'rank'
  if (column === 'logo' || column === 'map') return 'logo'
  if (column === 'name' || column === 'nick') return 'name'
  if (column === 'points') return 'points'
  return 'stat'
}

function renderCellValue(column: string, value: CellValue) {
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
}) {
  const config = resolveStreamOverlayConfig(props.pack, props.type, props.outputProfileId)
  const columns = (config.columns || []).filter((column) => STREAM_OVERLAY_COLUMN_META[column])
  const maxItems = Math.max(1, Number(config.maxItems || props.data.items.length || 1))
  const items = props.data.items.slice(0, maxItems)
  const shared = resolveStreamTableConfig(props.pack, props.type, props.outputProfileId)
  const mode = config.tableMode || shared.mode
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
                <div className={`stream-package-render-cell ${cellClass(column)}`} key={column}>
                  {STREAM_OVERLAY_COLUMN_META[column].label}
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
                  const style = shared.columnStyles[cellStyleKey(column)]
                  return (
                    <div
                      className={`stream-package-render-cell ${cellClass(column)}`}
                      key={column}
                      style={{
                        backgroundImage: style.assetKey ? cssBackground(resolveStreamAsset(props.pack, props.type, style.assetKey, props.outputProfileId)) : undefined,
                        color: style.color,
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
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

export function StreamPackageStage(props: {
  pack: StreamOverlayPackage
  type: StreamSystemOverlayType
  data: StreamPackageRenderData
  preview?: boolean
  canvasWidth?: number
  canvasHeight?: number
  outputProfileId?: StreamOutputProfileId
  contentOnly?: boolean
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
      className={`stream-package-render-root overlay-${props.type} fx-${animation.enter}${props.preview ? ' is-preview' : ''}`}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        '--stream-package-primary': props.pack.shared_config.identity.primaryColor,
        '--stream-package-secondary': props.pack.shared_config.identity.secondaryColor,
        '--stream-package-font': props.pack.shared_config.identity.fontFamily,
        '--stream-package-enter-ms': `${animation.durationMs}ms`,
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

      <div
        className={`stream-package-render-content structure-${meta.structure} variant-${layout.variant}`}
        style={{
          left: layout.content.x + sharedLayout.offsetX,
          top: layout.content.y + sharedLayout.offsetY,
          width: layout.content.width * sharedLayout.widthScale,
          height: layout.content.height * sharedLayout.heightScale,
        }}
      >
        {!props.data.items.length ? (
          <div className="stream-package-render-empty">{props.data.emptyMessage || 'Sem dados disponíveis para esta overlay.'}</div>
        ) : null}
        {props.data.items.length && meta.structure === 'table' ? <TableRenderer pack={props.pack} type={props.type} data={props.data} outputProfileId={outputProfileId} /> : null}
        {props.data.items.length && meta.structure === 'cards' ? <CardRenderer pack={props.pack} type={props.type} data={props.data} outputProfileId={outputProfileId} /> : null}
        {props.data.items.length && meta.structure === 'hero' ? <HeroRenderer pack={props.pack} type={props.type} data={props.data} /> : null}
      </div>
      </div>
    </div>
  )
}
