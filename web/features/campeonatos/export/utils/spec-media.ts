/**
 * Processamento de logos e fotos para o SPEC Free Fire.
 *
 * Logos: 300×300 PNG — nome = código do slot (902000034=A, 902000035=B, …)
 * Fotos: 500×600 PNG — nome = id do jogo do jogador
 *
 * Composição: fundo + imagem com margens (cima/baixo/lados) + recolor opcional da logo.
 */

import JSZip from 'jszip'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'
import { downloadBlob } from './build-export-zip'

export const LOGO_SIZE = 300
export const PHOTO_W = 500
export const PHOTO_H = 600

/** Código base do SPEC: A = 902000034 */
export const SPEC_LOGO_CODE_BASE = 902000034

export type BoxMargin = {
  top: number
  right: number
  bottom: number
  left: number
}

export const DEFAULT_LOGO_MARGIN: BoxMargin = { top: 24, right: 24, bottom: 24, left: 24 }
export const DEFAULT_PHOTO_MARGIN: BoxMargin = { top: 30, right: 30, bottom: 30, left: 30 }

export function letterFromSlot(slotLetra: string | null | undefined, slotNumero: number | null | undefined): string {
  const raw = String(slotLetra || '').trim().toUpperCase()
  if (raw && /^[A-Z]$/.test(raw[0])) return raw[0]
  const n = Number(slotNumero || 0)
  if (n >= 1 && n <= 26) return String.fromCharCode(64 + n)
  return ''
}

export function logoCodeFromLetter(letter: string): number | null {
  const L = String(letter || '').trim().toUpperCase()
  if (!L || L < 'A' || L > 'Z') return null
  return SPEC_LOGO_CODE_BASE + (L.charCodeAt(0) - 65)
}

export type SpecLogoItem = {
  key: string
  equipeId: string
  equipeNome: string
  lineNome: string
  slotLetra: string
  codigo: number
  logoUrl: string | null
  sourceUrl: string | null
  /** recolor só desta logo (hex). null = original */
  tintColor: string | null
}

export type SpecPhotoItem = {
  key: string
  nick: string
  idJogo: string
  fotoUrl: string | null
  sourceUrl: string | null
  equipeNome: string
}

export function buildSpecLogoItems(data: CampeonatoExportPayload): SpecLogoItem[] {
  const items: SpecLogoItem[] = []
  const usedLetters = new Set<string>()

  for (const eq of data.equipes || []) {
    for (const line of eq.lines || []) {
      let letter = letterFromSlot(line.slot?.letra, line.slot?.numero)
      if (letter && usedLetters.has(letter)) {
        for (let i = 0; i < 26; i++) {
          const cand = String.fromCharCode(65 + i)
          if (!usedLetters.has(cand)) {
            letter = cand
            break
          }
        }
      }
      if (!letter) {
        for (let i = 0; i < 26; i++) {
          const cand = String.fromCharCode(65 + i)
          if (!usedLetters.has(cand)) {
            letter = cand
            break
          }
        }
      }
      if (!letter) continue
      usedLetters.add(letter)
      const codigo = logoCodeFromLetter(letter)
      if (codigo == null) continue

      const logoUrl = line.logo_url || eq.logo_url || null
      items.push({
        key: line.participacao_id || `${eq.id}-${line.id || letter}`,
        equipeId: eq.id,
        equipeNome: eq.nome,
        lineNome: line.nome,
        slotLetra: letter,
        codigo,
        logoUrl,
        sourceUrl: logoUrl,
        tintColor: null,
      })
    }
  }

  return items.sort((a, b) => a.codigo - b.codigo)
}

export function buildSpecPhotoItems(data: CampeonatoExportPayload): SpecPhotoItem[] {
  const items: SpecPhotoItem[] = []
  const seenIds = new Set<string>()

  for (const eq of data.equipes || []) {
    for (const line of eq.lines || []) {
      for (const jog of line.jogadores || []) {
        const idJogo = String(jog.id_jogo || '').replace(/\D/g, '')
        if (!idJogo || seenIds.has(idJogo)) continue
        seenIds.add(idJogo)
        items.push({
          key: `${eq.id}:${line.participacao_id}:${jog.id}`,
          nick: jog.nick || 'Jogador',
          idJogo,
          fotoUrl: jog.foto_url || null,
          sourceUrl: jog.foto_url || null,
          equipeNome: eq.nome,
        })
      }
    }
  }
  return items
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src.slice(0, 80)}`))
    img.src = src
  })
}

function clampMargin(m: BoxMargin, width: number, height: number): BoxMargin {
  const maxH = Math.max(0, Math.floor(height / 2) - 1)
  const maxW = Math.max(0, Math.floor(width / 2) - 1)
  return {
    top: Math.max(0, Math.min(Math.floor(m.top || 0), maxH)),
    bottom: Math.max(0, Math.min(Math.floor(m.bottom || 0), maxH)),
    left: Math.max(0, Math.min(Math.floor(m.left || 0), maxW)),
    right: Math.max(0, Math.min(Math.floor(m.right || 0), maxW)),
  }
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = String(hex || '').trim()
  const m = raw.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * Recolore a logo com cor VIVA (opaca).
 * Pixels escuros/com conteúdo viram a cor escolhida em alpha cheio;
 * fundo branco/quase branco fica transparente.
 */
function recolorImageToCanvas(img: HTMLImageElement, tintHex: string): HTMLCanvasElement {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.drawImage(img, 0, 0, w, h)
  const color = parseHexColor(tintHex)
  if (!color) return c

  const src = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i]
    const g = src.data[i + 1]
    const b = src.data[i + 2]
    const a = src.data[i + 3]
    if (a < 10) {
      out.data[i + 3] = 0
      continue
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    // branco / quase branco → transparente
    if (lum > 0.88 && a > 200) {
      out.data[i + 3] = 0
      continue
    }
    // cor sólida viva (sem misturar luminância)
    out.data[i] = color.r
    out.data[i + 1] = color.g
    out.data[i + 2] = color.b
    // alpha forte: conteúdo escuro/médio fica bem opaco
    const coverage = Math.min(1, Math.max(0, (0.92 - lum) / 0.92))
    out.data[i + 3] = Math.round(Math.max(a * 0.92, 220 * coverage + a * 0.15))
  }
  ctx.putImageData(out, 0, 0)
  return c
}

/**
 * Desenha fundo + imagem com margens independentes.
 * object-fit: contain na área útil.
 */
export async function composeOnCanvas(opts: {
  width: number
  height: number
  sourceUrl: string | null
  backgroundUrl: string | null
  margin: BoxMargin
  /** cor de fallback se não houver fundo */
  fallbackColor?: string
  /** recolor da logo (hex). null = original */
  tintColor?: string | null
}): Promise<Blob> {
  const {
    width,
    height,
    sourceUrl,
    backgroundUrl,
    margin,
    fallbackColor = '#000000',
    tintColor = null,
  } = opts
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível')

  if (backgroundUrl) {
    try {
      const bg = await loadImage(backgroundUrl)
      ctx.drawImage(bg, 0, 0, width, height)
    } catch {
      ctx.fillStyle = fallbackColor
      ctx.fillRect(0, 0, width, height)
    }
  } else {
    ctx.fillStyle = fallbackColor
    ctx.fillRect(0, 0, width, height)
  }

  const m = clampMargin(margin, width, height)
  const boxW = width - m.left - m.right
  const boxH = height - m.top - m.bottom

  if (sourceUrl && boxW > 0 && boxH > 0) {
    try {
      const img = await loadImage(sourceUrl)
      const source: CanvasImageSource = tintColor
        ? recolorImageToCanvas(img, tintColor)
        : img
      const iw = 'naturalWidth' in source && (source as HTMLImageElement).naturalWidth
        ? (source as HTMLImageElement).naturalWidth
        : (source as HTMLCanvasElement).width
      const ih = 'naturalHeight' in source && (source as HTMLImageElement).naturalHeight
        ? (source as HTMLImageElement).naturalHeight
        : (source as HTMLCanvasElement).height
      const scale = Math.min(boxW / iw, boxH / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = m.left + (boxW - dw) / 2
      const dy = m.top + (boxH - dh) / 2
      ctx.drawImage(source, dx, dy, dw, dh)
    } catch {
      // só fundo
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao exportar PNG'))),
      'image/png',
    )
  })
}

export async function buildSpecLogosZip(
  items: SpecLogoItem[],
  backgroundUrl: string | null,
  margin: BoxMargin,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder('logos') || zip
  let done = 0
  const total = items.length

  for (const item of items) {
    const blob = await composeOnCanvas({
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      sourceUrl: item.sourceUrl,
      backgroundUrl,
      margin,
      // cor por logo (não global)
      tintColor: item.tintColor || null,
      fallbackColor: '#111111',
    })
    folder.file(`${item.codigo}.png`, blob)
    done += 1
    onProgress?.(done, total)
  }

  const mapLines = items.map((i) => `${i.slotLetra}=${i.codigo} · ${i.equipeNome} · ${i.lineNome}`).join('\n')
  folder.file('_mapa_slots.txt', mapLines)

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export async function buildSpecPhotosZip(
  items: SpecPhotoItem[],
  backgroundUrl: string | null,
  margin: BoxMargin,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder('fotos') || zip
  let done = 0
  const total = items.length

  for (const item of items) {
    const blob = await composeOnCanvas({
      width: PHOTO_W,
      height: PHOTO_H,
      sourceUrl: item.sourceUrl,
      backgroundUrl,
      margin,
      fallbackColor: '#111111',
    })
    folder.file(`${item.idJogo}.png`, blob)
    done += 1
    onProgress?.(done, total)
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

export { downloadBlob }
