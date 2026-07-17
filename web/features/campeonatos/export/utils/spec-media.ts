/**
 * Processamento de logos e fotos para o SPEC Free Fire.
 *
 * Logos: 300×300 PNG — nome = código do slot (902000034=A, 902000035=B, …)
 * Fotos: 500×600 PNG — nome = id do jogo do jogador
 *
 * Composição: fundo (mesmo p/ todas) + imagem com margem.
 */

import JSZip from 'jszip'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'
import { downloadBlob } from './build-export-zip'

export const LOGO_SIZE = 300
export const PHOTO_W = 500
export const PHOTO_H = 600

/** Código base do SPEC: A = 902000034 */
export const SPEC_LOGO_CODE_BASE = 902000034

export function letterFromSlot(slotLetra: string | null | undefined, slotNumero: number | null | undefined): string {
  const raw = String(slotLetra || '').trim().toUpperCase()
  if (raw && /^[A-Z]$/.test(raw[0])) return raw[0]
  const n = Number(slotNumero || 0)
  if (n >= 1 && n <= 26) return String.fromCharCode(64 + n) // 1→A
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
  /** URL ou dataURL override após admin trocar/recorte simples */
  sourceUrl: string | null
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
      // se colidir, tenta próxima livre
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

/**
 * Desenha fundo + imagem centralizada com margem (px) em canvas.
 * object-fit: contain dentro da área útil.
 */
export async function composeOnCanvas(opts: {
  width: number
  height: number
  sourceUrl: string | null
  backgroundUrl: string | null
  margin: number
  /** cor de fallback se não houver fundo */
  fallbackColor?: string
}): Promise<Blob> {
  const { width, height, sourceUrl, backgroundUrl, margin, fallbackColor = '#000000' } = opts
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível')

  // fundo
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

  const m = Math.max(0, Math.min(Math.floor(margin), Math.floor(Math.min(width, height) / 2) - 1))
  const boxW = width - m * 2
  const boxH = height - m * 2

  if (sourceUrl && boxW > 0 && boxH > 0) {
    try {
      const img = await loadImage(sourceUrl)
      const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const dx = m + (boxW - dw) / 2
      const dy = m + (boxH - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
    } catch {
      // sem imagem de conteúdo — só o fundo
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
  margin: number,
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
      fallbackColor: '#111111',
    })
    folder.file(`${item.codigo}.png`, blob)
    done += 1
    onProgress?.(done, total)
  }

  // mapa letra → código
  const mapLines = items.map((i) => `${i.slotLetra}=${i.codigo} · ${i.equipeNome} · ${i.lineNome}`).join('\n')
  folder.file('_mapa_slots.txt', mapLines)

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export async function buildSpecPhotosZip(
  items: SpecPhotoItem[],
  backgroundUrl: string | null,
  margin: number,
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
