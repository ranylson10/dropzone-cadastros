'use client'

import { supabase } from '@/lib/supabase-browser'
import { resolveStreamAsset, resolveStreamOverlayConfig, resolveStreamTableConfig } from './stream-package-config'
import { STREAM_OVERLAY_COLUMN_META } from '../types/stream-package.types'
import type { StreamOutputArea, StreamOutputLayout, StreamOverlayPackage, StreamPackageRenderData } from '../types/stream-package.types'

type RenderArea = { area: StreamOutputArea; data: StreamPackageRenderData }

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

async function drawTable(context: CanvasRenderingContext2D, pack: StreamOverlayPackage, entry: RenderArea) {
  const { area, data } = entry; const config = resolveStreamOverlayConfig(pack, area.overlayType, area.profileId)
  const table = resolveStreamTableConfig(pack, area.overlayType, area.profileId)
  const columns = (config.columns || []).filter((column) => STREAM_OVERLAY_COLUMN_META[column])
  const items = data.items.slice(Math.max(0, area.dataStart - 1), area.dataEnd)
  if (!columns.length || !items.length) return
  const header = table.showHeaders ? Math.min(42, Math.max(22, area.height * .08)) : 0
  const gap = Math.min(8, table.rowGap); const rowHeight = Math.max(22, Math.min(86, (area.height - header - (items.length - 1) * gap) / items.length))
  const widths = columns.map((column) => column === 'rank' ? Math.max(34, area.width * .065) : column === 'logo' ? Math.max(46, area.width * .10) : column === 'name' || column === 'nick' ? area.width * .32 : column === 'points' ? area.width * .11 : area.width * .10)
  const total = widths.reduce((sum, width) => sum + width, 0); const scale = area.width / total
  const scaled = widths.map((width) => width * scale)
  const rowBackground = await imageSource(resolveStreamAsset(pack, area.overlayType, 'table_row_bg', area.profileId)).catch(() => null)
  context.save(); context.beginPath(); context.rect(area.x, area.y, area.width, area.height); context.clip()
  if (header) { let x = area.x; context.textBaseline = 'middle'; context.textAlign = 'center'; for (let index = 0; index < columns.length; index += 1) { const column = columns[index]; context.fillStyle = table.headerColor || '#ffffff'; context.font = `${table.headerFontWeight || 800} ${Math.max(10, header * .38)}px ${table.headerFontFamily || 'Arial'}`; context.fillText(config.columnLabels?.[column] || STREAM_OVERLAY_COLUMN_META[column].label, x + scaled[index] / 2, area.y + header / 2); x += scaled[index] } }
  for (let row = 0; row < items.length; row += 1) { const y = area.y + header + row * (rowHeight + gap); if (rowBackground) context.drawImage(rowBackground, area.x, y, area.width, rowHeight); else { context.fillStyle = 'rgba(20,30,42,.88)'; context.fillRect(area.x, y, area.width, rowHeight) }
    let x = area.x; for (let index = 0; index < columns.length; index += 1) { const column = columns[index]; const style = table.columnStyles[column as keyof typeof table.columnStyles]; const width = scaled[index]; context.save(); context.globalAlpha = style.opacity ?? 1; if (style.backgroundType === 'solid') { context.fillStyle = style.backgroundColor; context.fillRect(x, y, width, rowHeight) } context.fillStyle = style.color; context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || 700} ${Math.max(10, Math.min(style.fontSize || 18, rowHeight * .54))}px ${style.fontFamily || 'Arial'}`; context.textBaseline = 'middle'; context.textAlign = style.align === 'left' ? 'left' : style.align === 'right' ? 'right' : 'center'; const tx = style.align === 'left' ? x + (style.paddingX || 8) : style.align === 'right' ? x + width - (style.paddingX || 8) : x + width / 2; const ty = y + rowHeight / 2 + (style.offsetY || 0)
      if ((column === 'logo' || column === 'map') && String(items[row][column] || '')) { const cellImage = await imageSource(String(items[row][column])).catch(() => null); if (cellImage) drawContain(context, cellImage, x + 4, y + 4, width - 8, rowHeight - 8) } else context.fillText(value(items[row], column), tx + (style.offsetX || 0), ty, Math.max(8, width - 12)); context.restore(); x += width }
  }
  context.restore()
}

export async function renderStreamOutputCanvas(layout: StreamOutputLayout, pack: StreamOverlayPackage, entries: RenderArea[]) {
  const canvas = document.createElement('canvas'); canvas.width = layout.width; canvas.height = layout.height
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível para exportação.')
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
  if (layout.backgroundType === 'color') { context.fillStyle = layout.backgroundColor; context.fillRect(0, 0, layout.width, layout.height) }
  if (layout.backgroundType === 'image' && layout.backgroundUrl) { const background = await imageSource(layout.backgroundUrl); if (background) context.drawImage(background, 0, 0, layout.width, layout.height) }
  for (const entry of entries) await drawTable(context, pack, entry)
  return canvas
}
