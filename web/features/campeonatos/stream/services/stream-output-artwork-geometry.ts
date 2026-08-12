import {
  resolveStreamLayoutConfig,
  resolveStreamLooseImageConfig,
  resolveStreamLooseTextConfig,
  resolveStreamOverlayConfig,
  resolveStreamTableConfig,
} from './stream-package-config'
import {
  STREAM_SYSTEM_OVERLAY_LAYOUTS,
  STREAM_SYSTEM_OVERLAY_META,
  type StreamOutputArea,
  type StreamOverlayPackage,
} from '../types/stream-package.types'

export const STREAM_ARTWORK_DESIGN_WIDTH = 1920
export const STREAM_ARTWORK_DESIGN_HEIGHT = 1080

export type StreamArtworkBounds = { x: number; y: number; width: number; height: number }

export function streamOutputArtworkArea(area: StreamOutputArea): StreamOutputArea {
  return { ...area, profileId: 'png-4k', contentMode: 'full', lockAspect: true }
}

export function streamOutputArtworkBounds(pack: StreamOverlayPackage, area: StreamOutputArea, itemCount?: number): StreamArtworkBounds {
  const frame = STREAM_SYSTEM_OVERLAY_LAYOUTS[area.overlayType].content
  const layout = resolveStreamLayoutConfig(pack, area.overlayType, 'png-4k')
  const config = resolveStreamOverlayConfig(pack, area.overlayType, 'png-4k')
  const looseImage = resolveStreamLooseImageConfig(pack, area.overlayType, 'png-4k')
  const looseText = resolveStreamLooseTextConfig(pack, area.overlayType, 'png-4k')
  const meta = STREAM_SYSTEM_OVERLAY_META[area.overlayType]

  let contentHeight = Math.max(1, frame.height * layout.heightScale)
  if (meta.structure === 'table' && area.overlayType !== 'mvp_general') {
    const table = resolveStreamTableConfig(pack, area.overlayType, 'png-4k')
    const requestedItems = Math.max(1, itemCount ?? (area.dataEnd - area.dataStart + 1))
    const visibleItems = Math.max(1, Math.min(requestedItems, Number(config.maxItems || requestedItems)))
    const rowsPerPanel = (config.tableMode || table.mode) === 'double' ? Math.ceil(visibleItems / 2) : visibleItems
    contentHeight = (table.showHeaders ? table.headerHeight : 0)
      + (rowsPerPanel * table.rowHeight)
      + (Math.max(0, rowsPerPanel - 1) * table.rowGap)
  }

  const boxes: StreamArtworkBounds[] = [{
    x: frame.x + layout.offsetX,
    y: frame.y + layout.offsetY,
    width: Math.max(1, frame.width * layout.widthScale),
    height: Math.max(1, contentHeight),
  }]

  if (looseImage.show) boxes.push({
    x: looseImage.x,
    y: looseImage.y,
    width: Math.max(1, looseImage.width),
    height: Math.max(1, looseImage.height),
  })

  if (looseText.show) boxes.push({
    x: looseText.x,
    y: looseText.y,
    width: Math.max(1, looseText.width),
    height: Math.max(1, looseText.fontSize * 1.35),
  })

  for (const item of config.sceneItems || []) {
    if (!item.show) continue
    boxes.push({
      x: item.x,
      y: item.y,
      width: Math.max(1, item.width),
      height: Math.max(1, item.height),
    })
  }

  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.y + box.height))

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

export function streamOutputArtworkScale(pack: StreamOverlayPackage, area: StreamOutputArea, itemCount?: number) {
  const bounds = streamOutputArtworkBounds(pack, area, itemCount)
  return Math.max(80, area.width) / bounds.width
}

export function streamOutputArtworkEffectiveSize(pack: StreamOverlayPackage, area: StreamOutputArea, itemCount?: number) {
  const bounds = streamOutputArtworkBounds(pack, area, itemCount)
  const scale = Math.max(80, area.width) / bounds.width
  return {
    width: Math.max(80, area.width),
    height: Math.max(1, Math.round(bounds.height * scale)),
  }
}
