'use client'

import { supabase } from '@/lib/supabase-browser'
import { resolveStreamAsset, resolveStreamLayoutConfig, resolveStreamLooseImageConfig, resolveStreamLooseTextConfig, resolveStreamOverlayConfig, resolveStreamTableConfig } from './stream-package-config'
import { STREAM_OUTPUT_PROFILES, STREAM_OVERLAY_COLUMN_META, STREAM_SYSTEM_OVERLAY_LAYOUTS, STREAM_SYSTEM_OVERLAY_META } from '../types/stream-package.types'
import type { StreamOutputArea, StreamOutputLayout, StreamOverlayPackage, StreamPackageRenderData } from '../types/stream-package.types'

type RenderArea = { area: StreamOutputArea; data: StreamPackageRenderData; pack: StreamOverlayPackage }

async function imageSource(url: string) {
  if (!url) return null
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/stream/image', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: JSON.stringify({ url }) })
  if (!response.ok) throw new Error('Não foi possível preparar uma das imagens para o PNG.')
  const blobUrl = URL.createObjectURL(await response.blob())
  try { return await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Falha ao carregar uma imagem para o PNG.')); image.src = blobUrl }) }
  finally { URL.revokeObjectURL(blobUrl) }
}

function drawContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

function value(item: Record<string, string | number | null | undefined>, column: string) {
  const raw = item[column]
  if (column === 'movement') { const number = Number(String(raw || '0').replace('+', '')) || 0; return number > 0 ? `▲ +${number}` : number < 0 ? `▼ ${number}` : '—' }
  return String(raw ?? '—')
}

function fillCellGradient(context: CanvasRenderingContext2D, css: string, x: number, y: number, width: number, height: number) {
  const colors = css.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) || []
  if (colors.length < 2) return false
  const gradient = context.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, colors[0]!)
  gradient.addColorStop(1, colors[colors.length - 1]!)
  context.fillStyle = gradient
  context.fillRect(x, y, width, height)
  return true
}

function scaledBox(entry: RenderArea, x: number, y: number, width: number, height: number) {
  const profile = STREAM_OUTPUT_PROFILES.find((item) => item.id === entry.area.profileId) || STREAM_OUTPUT_PROFILES[0]
  return {
    x: entry.area.x + x * (entry.area.width / profile.width),
    y: entry.area.y + y * (entry.area.height / profile.height),
    width: width * (entry.area.width / profile.width),
    height: height * (entry.area.height / profile.height),
  }
}

function contentArea(entry: RenderArea) {
  if (entry.area.contentMode === 'clean') return entry.area
  const profile = STREAM_OUTPUT_PROFILES.find((item) => item.id === entry.area.profileId) || STREAM_OUTPUT_PROFILES[0]
  const frame = STREAM_SYSTEM_OVERLAY_LAYOUTS[entry.area.overlayType].content
  const layout = resolveStreamLayoutConfig(entry.pack, entry.area.overlayType, entry.area.profileId)
  return {
    ...entry.area,
    x: entry.area.x + (frame.x + layout.offsetX) * (entry.area.width / profile.width),
    y: entry.area.y + (frame.y + layout.offsetY) * (entry.area.height / profile.height),
    width: frame.width * layout.widthScale * (entry.area.width / profile.width),
    height: frame.height * layout.heightScale * (entry.area.height / profile.height),
  }
}


function effectiveCleanArea(entry: RenderArea) {
  if (entry.area.contentMode !== 'clean') return entry.area
  const meta = STREAM_SYSTEM_OVERLAY_META[entry.area.overlayType]
  if (meta.structure !== 'table') return entry.area
  const frame = STREAM_SYSTEM_OVERLAY_LAYOUTS[entry.area.overlayType].content
  const layout = resolveStreamLayoutConfig(entry.pack, entry.area.overlayType, entry.area.profileId)
  const table = resolveStreamTableConfig(entry.pack, entry.area.overlayType, entry.area.profileId)
  const availableCount = Math.max(0, Math.min(entry.data.items.length, entry.area.dataEnd) - Math.max(0, entry.area.dataStart - 1))
  const count = Math.max(1, availableCount)
  const baseWidth = Math.max(80, frame.width * layout.widthScale)
  const scale = entry.area.width / baseWidth
  const baseHeight = (table.showHeaders ? table.headerHeight : 0) + (count * table.rowHeight) + (Math.max(0, count - 1) * table.rowGap)
  return { ...entry.area, height: Math.max(40, baseHeight * scale) }
}

async function drawAreaDecorations(context: CanvasRenderingContext2D, entry: RenderArea) {
  if (entry.area.contentMode === 'clean') return
  const config = resolveStreamOverlayConfig(entry.pack, entry.area.overlayType, entry.area.profileId)
  const looseImage = resolveStreamLooseImageConfig(entry.pack, entry.area.overlayType, entry.area.profileId)
  const looseText = resolveStreamLooseTextConfig(entry.pack, entry.area.overlayType, entry.area.profileId)

  if (looseImage.show && looseImage.assetKey) {
    const image = await imageSource(resolveStreamAsset(entry.pack, entry.area.overlayType, looseImage.assetKey, entry.area.profileId)).catch(() => null)
    if (image) {
      const box = scaledBox(entry, looseImage.x, looseImage.y, looseImage.width, looseImage.height)
      if (looseImage.fit === 'cover') context.drawImage(image, box.x, box.y, box.width, box.height)
      else drawContain(context, image, box.x, box.y, box.width, box.height)
    }
  }

  if (looseText.show) {
    const box = scaledBox(entry, looseText.x, looseText.y, looseText.width, looseText.fontSize * 1.3)
    context.save()
    context.fillStyle = looseText.color
    context.font = `${looseText.fontWeight} ${Math.max(8, looseText.fontSize * (entry.area.height / (STREAM_OUTPUT_PROFILES.find((item) => item.id === entry.area.profileId)?.height || 1080)))}px ${looseText.fontFamily || 'Arial'}`
    context.textBaseline = 'top'
    context.textAlign = looseText.align === 'left' ? 'left' : looseText.align === 'right' ? 'right' : 'center'
    const x = looseText.align === 'left' ? box.x : looseText.align === 'right' ? box.x + box.width : box.x + box.width / 2
    context.fillText(config.title || '', x, box.y, box.width)
    context.restore()
  }

  for (const item of config.sceneItems || []) {
    if (!item.show) continue
    const box = scaledBox(entry, item.x, item.y, item.width, item.height)
    if (item.type === 'image' && item.imageUrl) {
      const image = await imageSource(item.imageUrl).catch(() => null)
      if (image) drawContain(context, image, box.x, box.y, box.width, box.height)
      continue
    }
    context.save()
    context.fillStyle = item.color || '#ffffff'
    context.font = `${item.fontWeight || 700} ${Math.max(8, (item.fontSize || 32) * (entry.area.height / (STREAM_OUTPUT_PROFILES.find((profile) => profile.id === entry.area.profileId)?.height || 1080)))}px Arial`
    context.textBaseline = 'middle'
    context.textAlign = 'left'
    const text = item.type === 'round_counter' ? `${item.currentRound || 1}/${item.totalRounds || 12}` : item.text || ''
    context.fillText(text, box.x, box.y + box.height / 2, box.width)
    context.restore()
  }
}

async function drawTable(context: CanvasRenderingContext2D, pack: StreamOverlayPackage, entry: RenderArea) {
  const { data } = entry; const area = entry.area.contentMode === 'clean' ? effectiveCleanArea(entry) : contentArea(entry); const config = resolveStreamOverlayConfig(pack, area.overlayType, area.profileId)
  const table = resolveStreamTableConfig(pack, area.overlayType, area.profileId)
  const columns = (config.columns || []).filter((column) => STREAM_OVERLAY_COLUMN_META[column])
  const items = data.items.slice(Math.max(0, area.dataStart - 1), area.dataEnd)
  if (!columns.length || !items.length) return
  const frame = STREAM_SYSTEM_OVERLAY_LAYOUTS[area.overlayType].content
  const resolvedLayout = resolveStreamLayoutConfig(pack, area.overlayType, area.profileId)
  const baseWidth = area.contentMode === 'clean' ? Math.max(80, frame.width * resolvedLayout.widthScale) : area.width
  const visualScale = area.contentMode === 'clean' ? area.width / baseWidth : 1
  const header = table.showHeaders ? table.headerHeight * visualScale : 0
  const gap = table.rowGap * visualScale
  const rowHeight = table.rowHeight * visualScale
  const widths = columns.map((column) => table.columnStyles[column as keyof typeof table.columnStyles]?.width || (column === 'rank' ? Math.max(34, area.width * .065) : column === 'logo' ? Math.max(46, area.width * .10) : column === 'name' || column === 'nick' ? area.width * .32 : column === 'points' ? area.width * .11 : area.width * .10))
  const total = widths.reduce((sum, width) => sum + width, 0); const scale = area.width / total
  const scaled = widths.map((width) => width * scale)
  const rowBackground = await imageSource(resolveStreamAsset(pack, area.overlayType, 'table_row_bg', area.profileId)).catch(() => null)
  const cellBackgrounds = new Map<string, HTMLImageElement | null>()
  await Promise.all(columns.map(async (column) => {
    const style = table.columnStyles[column as keyof typeof table.columnStyles]
    if (style.backgroundType !== 'image' || !style.assetKey) return
    cellBackgrounds.set(column, await imageSource(resolveStreamAsset(pack, area.overlayType, style.assetKey, area.profileId)).catch(() => null))
  }))
  context.save(); context.beginPath(); context.rect(area.x, area.y, area.width, area.height); context.clip()
  if (header) { let x = area.x; context.textBaseline = 'middle'; context.textAlign = 'center'; for (let index = 0; index < columns.length; index += 1) { const column = columns[index]; context.fillStyle = table.headerColor || '#ffffff'; context.font = `${table.headerFontWeight || 800} ${Math.max(10, header * .38)}px ${table.headerFontFamily || 'Arial'}`; context.fillText(config.columnLabels?.[column] || STREAM_OVERLAY_COLUMN_META[column].label, x + scaled[index] / 2, area.y + header / 2); x += scaled[index] } }
  for (let row = 0; row < items.length; row += 1) { const y = area.y + header + row * (rowHeight + gap); if (rowBackground) context.drawImage(rowBackground, area.x, y, area.width, rowHeight); else { context.fillStyle = 'rgba(20,30,42,.88)'; context.fillRect(area.x, y, area.width, rowHeight) }
    let x = area.x; for (let index = 0; index < columns.length; index += 1) { const column = columns[index]; const style = table.columnStyles[column as keyof typeof table.columnStyles]; const width = scaled[index]; const paddingX = style.paddingX ?? 8; const paddingY = style.paddingY ?? 4; context.save(); context.globalAlpha = style.opacity ?? 1; if (style.backgroundType === 'solid') { context.fillStyle = style.backgroundColor; context.fillRect(x, y, width, rowHeight) } else if (style.backgroundType === 'gradient') fillCellGradient(context, style.backgroundGradient, x, y, width, rowHeight); else { const background = cellBackgrounds.get(column); if (background) context.drawImage(background, x, y, width, rowHeight) }
      if (style.borderWidth) { context.strokeStyle = style.borderColor; context.lineWidth = style.borderWidth; if (style.borderRadius && 'roundRect' in context) { context.beginPath(); context.roundRect(x + style.borderWidth / 2, y + style.borderWidth / 2, Math.max(1, width - style.borderWidth), Math.max(1, rowHeight - style.borderWidth), style.borderRadius); context.stroke() } else context.strokeRect(x + style.borderWidth / 2, y + style.borderWidth / 2, Math.max(1, width - style.borderWidth), Math.max(1, rowHeight - style.borderWidth)) }
      context.fillStyle = style.color; context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || 700} ${Math.max(10, Math.min(style.fontSize || 18, rowHeight * .54))}px ${style.fontFamily || 'Arial'}`; context.textBaseline = 'middle'; context.textAlign = style.align === 'left' ? 'left' : style.align === 'right' ? 'right' : 'center'; const tx = style.align === 'left' ? x + paddingX : style.align === 'right' ? x + width - paddingX : x + width / 2; const ty = (style.verticalAlign === 'top' ? y + paddingY + (style.fontSize || 18) * .5 : style.verticalAlign === 'bottom' ? y + rowHeight - paddingY - (style.fontSize || 18) * .5 : y + rowHeight / 2) + (style.offsetY || 0)
      if ((column === 'logo' || column === 'map') && String(items[row][column] || '')) { const cellImage = await imageSource(String(items[row][column])).catch(() => null); if (cellImage) drawContain(context, cellImage, x + paddingX, y + paddingY, Math.max(1, width - paddingX * 2), Math.max(1, rowHeight - paddingY * 2)) } else context.fillText(value(items[row], column), tx + (style.offsetX || 0), ty, Math.max(8, width - paddingX * 2)); context.restore(); x += width }
  }
  context.restore()
}

export async function renderStreamOutputCanvas(layout: StreamOutputLayout, entries: RenderArea[]) {
  const canvas = document.createElement('canvas'); canvas.width = layout.width; canvas.height = layout.height
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível para exportação.')
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
  if (layout.backgroundType === 'color') { context.fillStyle = layout.backgroundColor; context.fillRect(0, 0, layout.width, layout.height) }
  if (layout.backgroundType === 'image' && layout.backgroundUrl) { const background = await imageSource(layout.backgroundUrl); if (background) context.drawImage(background, 0, 0, layout.width, layout.height) }
  for (const entry of entries) {
    await drawAreaDecorations(context, entry)
    await drawTable(context, entry.pack, entry)
  }
  return canvas
}
