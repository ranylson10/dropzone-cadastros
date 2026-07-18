/**
 * Gera e baixa PDF real do regulamento (sem diálogo de impressão).
 */
import { jsPDF } from 'jspdf'
import type { GeneratedDocument, RulebookHighlight } from '../types/rulebook.types'

const GOLD_RGB = { r: 184, g: 134, b: 11 }
const TEXT = { r: 20, g: 24, b: 32 }
const MUTED = { r: 90, g: 96, b: 110 }
const LINE = { r: 210, g: 214, b: 222 }
const SOFT = { r: 251, g: 247, b: 235 }
const SOFT_BORDER = { r: 226, g: 211, b: 160 }

function cleanTitle(title: string) {
  return String(title || '')
    .replace(/^\s*\d+[\.\u00B7\u2022\)]\s*/g, '')
    .replace(/^\s*\d+\.\s*/g, '')
    .trim()
}

function slugFileName(name: string) {
  return String(name || 'campeonato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'campeonato'
}

function formatDatePt(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const type = blob.type || ''
    const format: 'PNG' | 'JPEG' =
      type.includes('png') || url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(blob)
    })
    if (!dataUrl.startsWith('data:image')) return null
    return { dataUrl, format }
  } catch {
    return null
  }
}

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize)
  const raw = String(text || '').replace(/\r\n/g, '\n')
  const paragraphs = raw.split('\n')
  const lines: string[] = []
  for (const p of paragraphs) {
    if (!p.trim()) {
      lines.push('')
      continue
    }
    const wrapped = doc.splitTextToSize(p, maxWidth) as string[]
    lines.push(...wrapped)
  }
  return lines
}

export async function downloadRulebookPdf(documento: GeneratedDocument): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 14
  const marginTop = 14
  const marginBottom = 16
  const contentW = pageW - marginX * 2
  let y = marginTop
  let page = 1

  const champName = documento.campeonatoNome || 'Campeonato'
  const highlights = (documento.dadosPrincipais || []) as RulebookHighlight[]
  const chapters = documento.chapters || []
  const summary = documento.summary || []

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - marginBottom) return
    drawFooter()
    doc.addPage()
    page += 1
    y = marginTop
  }

  const drawFooter = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text('DropZone · Regulamento oficial', marginX, pageH - 8)
    doc.text(String(page), pageW - marginX, pageH - 8, { align: 'right' })
  }

  const drawLine = (yy: number, color = LINE) => {
    doc.setDrawColor(color.r, color.g, color.b)
    doc.setLineWidth(0.3)
    doc.line(marginX, yy, pageW - marginX, yy)
  }

  // ─── CAPA ─────────────────────────────────────────────
  // Logo + nome no TOPO
  let logoH = 0
  let logoW = 0
  if (documento.logoUrl) {
    const img = await loadImageAsDataUrl(documento.logoUrl)
    if (img) {
      logoW = 22
      logoH = 22
      try {
        doc.addImage(img.dataUrl, img.format, marginX, y, logoW, logoH)
      } catch {
        logoH = 0
        logoW = 0
      }
    }
  }

  const textX = logoW > 0 ? marginX + logoW + 5 : marginX
  const textMax = pageW - marginX - textX

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
  doc.text('REGULAMENTO OFICIAL', textX, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
  const nameLines = wrapText(doc, champName, textMax, 18)
  let nameY = y + 12
  for (const line of nameLines.slice(0, 2)) {
    doc.text(line, textX, nameY)
    nameY += 7
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(`Regulamento — ${champName}`, textX, nameY + 1)
  nameY += 5
  const metaBits = [
    documento.articleCount ? `${documento.articleCount} artigos` : '',
    formatDatePt(documento.generatedAt) ? `Atualizado em ${formatDatePt(documento.generatedAt)}` : '',
  ].filter(Boolean)
  if (metaBits.length) {
    doc.setFontSize(8)
    doc.text(metaBits.join(' · '), textX, nameY + 1)
    nameY += 4
  }

  y = Math.max(y + logoH, nameY) + 6
  drawLine(y, GOLD_RGB)
  y += 5

  // Dados principais
  if (highlights.length) {
    ensureSpace(28)
    const colW = (contentW - 4) / 2
    const rowH = 9
    const rows = Math.ceil(highlights.length / 2)
    const boxH = rows * rowH + 6
    doc.setFillColor(SOFT.r, SOFT.g, SOFT.b)
    doc.setDrawColor(SOFT_BORDER.r, SOFT_BORDER.g, SOFT_BORDER.b)
    doc.setLineWidth(0.4)
    doc.roundedRect(marginX, y, contentW, boxH, 2, 2, 'FD')

    let row = 0
    let col = 0
    for (const item of highlights) {
      const cx = marginX + 3 + col * (colW + 2)
      const cy = y + 4 + row * rowH
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
      doc.text(String(item.label || '').toUpperCase(), cx, cy)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      const valLines = wrapText(doc, String(item.value || '—'), colW - 4, 9)
      doc.text(valLines[0] || '—', cx, cy + 4)
      col += 1
      if (col >= 2) {
        col = 0
        row += 1
      }
    }
    y += boxH + 5
  }

  // Sumário
  ensureSpace(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
  doc.text('SUMÁRIO', marginX, y)
  y += 5

  const tocColW = (contentW - 6) / 2
  const tocItems = summary.length
    ? summary.map((s) => ({
        order: s.order,
        title: cleanTitle(s.title),
      }))
    : chapters.map((c) => ({
        order: c.order,
        title: cleanTitle(c.title),
      }))

  const mid = Math.ceil(tocItems.length / 2)
  const left = tocItems.slice(0, mid)
  const right = tocItems.slice(mid)
  const tocRows = Math.max(left.length, right.length)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (let i = 0; i < tocRows; i++) {
    ensureSpace(5)
    if (left[i]) {
      doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
      doc.setFont('helvetica', 'bold')
      doc.text(`${left[i].order}.`, marginX, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      doc.text(left[i].title, marginX + 7, y)
    }
    if (right[i]) {
      const rx = marginX + tocColW + 6
      doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
      doc.setFont('helvetica', 'bold')
      doc.text(`${right[i].order}.`, rx, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      doc.text(right[i].title, rx + 7, y)
    }
    y += 4.5
  }

  y += 3
  drawLine(y, GOLD_RGB)
  y += 6

  // ─── CAPÍTULOS E ARTIGOS ──────────────────────────────
  for (const ch of chapters) {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
    doc.text(`${ch.order}.`, marginX, y)
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
    doc.text(cleanTitle(ch.title), marginX + 8, y)
    y += 3
    drawLine(y, LINE)
    y += 5

    for (const art of ch.articles || []) {
      const artHead = `${art.number || ''} ${art.title}`.trim()
      const bodyLines = wrapText(doc, art.body || '', contentW, 10)
      const penLines = art.penalty ? wrapText(doc, art.penalty, contentW - 4, 9) : []
      const obsLines = art.observations ? wrapText(doc, art.observations, contentW - 4, 9) : []
      const notesLines = art.notes ? wrapText(doc, art.notes, contentW, 8) : []

      // estimate space for heading + first lines
      ensureSpace(12)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      // article number in gold
      const num = String(art.number || '')
      const titleRest = String(art.title || '')
      doc.setTextColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
      doc.text(num, marginX, y)
      const numW = doc.getTextWidth(num + ' ')
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      const titleWrapped = wrapText(doc, titleRest, contentW - numW, 10.5)
      doc.text(titleWrapped[0] || '', marginX + numW, y)
      y += 5
      if (titleWrapped.length > 1) {
        for (const tl of titleWrapped.slice(1)) {
          ensureSpace(5)
          doc.text(tl, marginX, y)
          y += 4.5
        }
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      for (const line of bodyLines) {
        ensureSpace(5)
        if (line === '') {
          y += 2
          continue
        }
        doc.text(line, marginX, y)
        y += 4.3
      }

      if (penLines.length) {
        ensureSpace(10 + penLines.length * 4)
        y += 1.5
        const boxTop = y - 2
        const boxH = penLines.length * 4 + 8
        doc.setFillColor(248, 248, 248)
        doc.setDrawColor(LINE.r, LINE.g, LINE.b)
        doc.setLineWidth(0.3)
        doc.rect(marginX, boxTop, contentW, boxH, 'FD')
        doc.setDrawColor(194, 65, 12)
        doc.setLineWidth(0.8)
        doc.line(marginX, boxTop, marginX, boxTop + boxH)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
        doc.text('PENALIDADE', marginX + 3, y + 2)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
        for (const line of penLines) {
          doc.text(line, marginX + 3, y)
          y += 4
        }
        y = boxTop + boxH + 3
      }

      if (obsLines.length) {
        ensureSpace(10 + obsLines.length * 4)
        y += 1
        const boxTop = y - 2
        const boxH = obsLines.length * 4 + 8
        doc.setFillColor(248, 248, 248)
        doc.setDrawColor(LINE.r, LINE.g, LINE.b)
        doc.setLineWidth(0.3)
        doc.rect(marginX, boxTop, contentW, boxH, 'FD')
        doc.setDrawColor(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b)
        doc.setLineWidth(0.8)
        doc.line(marginX, boxTop, marginX, boxTop + boxH)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
        doc.text('OBSERVAÇÕES', marginX + 3, y + 2)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
        for (const line of obsLines) {
          doc.text(line, marginX + 3, y)
          y += 4
        }
        y = boxTop + boxH + 3
      }

      if (notesLines.length) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
        for (const line of notesLines) {
          ensureSpace(4)
          doc.text(line, marginX, y)
          y += 3.6
        }
      }

      y += 3
      // separator between articles
      ensureSpace(3)
      drawLine(y, LINE)
      y += 4

      void artHead
    }

    y += 2
  }

  // rodapé final
  ensureSpace(12)
  y += 2
  drawLine(y, LINE)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const foot = wrapText(
    doc,
    `Regulamento exclusivo do campeonato ${champName}. A inscrição e a participação implicam aceitação integral deste documento.`,
    contentW,
    8,
  )
  for (const line of foot) {
    ensureSpace(4)
    doc.text(line, marginX, y)
    y += 3.8
  }

  drawFooter()

  // Atualiza número de página em todas as páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    // limpa área do rodapé e reescreve com total
    doc.setFillColor(255, 255, 255)
    doc.rect(marginX, pageH - 12, contentW, 8, 'F')
    doc.text(`DropZone · ${champName}`, marginX, pageH - 8)
    doc.text(`${i} / ${totalPages}`, pageW - marginX, pageH - 8, { align: 'right' })
  }

  const fileName = `Regulamento-${slugFileName(champName)}.pdf`
  doc.save(fileName)
}
