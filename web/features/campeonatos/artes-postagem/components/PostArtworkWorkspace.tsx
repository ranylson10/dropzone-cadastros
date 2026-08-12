'use client'

import { ArrowLeft, Copy, Download, ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import JSZip from 'jszip'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import { loadPostArtworkDayStandings, loadPostArtworkGeneralStandings } from '../services/post-artwork-data.service'
import type {
  PostArtworkBlock,
  PostArtworkProject,
  PostArtworkSliceDirection,
  PostArtworkTableColumnKey,
  PostArtworkTableColumnStyle,
  PostArtworkTableStyle,
  PostArtworkTeamRow,
} from '../types/artwork.types'
import '../post-artworks.css'

type ApiPayload = { campeonato?: { id: string; nome: string }; items?: PostArtworkProject[]; item?: PostArtworkProject; partidas?: Array<{ rodada_id?: string | null; rodada_nome?: string | null }>; error?: string }
type RoundOption = { id: string; nome: string }

const TABLE_COLUMN_META: Record<PostArtworkTableColumnKey, { label: string; defaultWidth: number; align: 'left' | 'center' | 'right' }> = {
  rank: { label: 'RK', defaultWidth: 74, align: 'center' },
  logo: { label: '', defaultWidth: 76, align: 'center' },
  name: { label: 'EQUIPE', defaultWidth: 310, align: 'left' },
  drops: { label: 'QD', defaultWidth: 82, align: 'center' },
  booyah: { label: 'B!', defaultWidth: 82, align: 'center' },
  kills: { label: 'ABT', defaultWidth: 90, align: 'center' },
  points: { label: 'PTS', defaultWidth: 100, align: 'center' },
}

const TABLE_COLUMNS = Object.keys(TABLE_COLUMN_META) as PostArtworkTableColumnKey[]

async function authFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para editar artes deste campeonato.')
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({})) as ApiPayload
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.')
  return body
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function EditableNumberInput(props: { value: number; min?: number; max?: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(props.value)), [props.value])
  function commit() {
    const normalized = text.trim().replace(',', '.')
    if (!normalized || normalized === '-' || normalized === '.') { setText(String(props.value)); return }
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) { setText(String(props.value)); return }
    let next = Math.round(parsed)
    if (props.min !== undefined) next = Math.max(props.min, next)
    if (props.max !== undefined) next = Math.min(props.max, next)
    props.onCommit(next)
    setText(String(next))
  }
  return <input inputMode="numeric" value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } if (event.key === 'Escape') { setText(String(props.value)); event.currentTarget.blur() } }} />
}

function defaultColumn(key: PostArtworkTableColumnKey): PostArtworkTableColumnStyle {
  const meta = TABLE_COLUMN_META[key]
  return {
    key,
    label: meta.label,
    enabled: true,
    width: meta.defaultWidth,
    align: meta.align,
    backgroundType: 'color',
    backgroundColor: key === 'points' ? '#f4f4f4' : '#15171c',
    backgroundUrl: null,
    color: key === 'points' ? '#111111' : '#ffffff',
    fontSize: key === 'name' ? 26 : 28,
    fontWeight: 800,
  }
}

function defaultTableStyle(): PostArtworkTableStyle {
  return {
    rowHeight: 64,
    rowGap: 6,
    cellGap: 4,
    headerHeight: 34,
    showHeader: true,
    headerBackgroundColor: '#111318',
    headerColor: '#ffffff',
    columns: TABLE_COLUMNS.map(defaultColumn),
  }
}

function normalizeTableStyle(block: PostArtworkBlock): PostArtworkTableStyle {
  const raw = (block.style || {}) as Partial<PostArtworkTableStyle>
  const byKey = new Map((Array.isArray(raw.columns) ? raw.columns : []).map((column) => [column.key, column]))
  return {
    rowHeight: Number(raw.rowHeight) || 64,
    rowGap: Number(raw.rowGap) || 0,
    cellGap: Number(raw.cellGap) || 0,
    headerHeight: Number(raw.headerHeight) || 34,
    showHeader: raw.showHeader !== false,
    headerBackgroundColor: String(raw.headerBackgroundColor || '#111318'),
    headerColor: String(raw.headerColor || '#ffffff'),
    columns: TABLE_COLUMNS.map((key) => ({ ...defaultColumn(key), ...(byKey.get(key) || {}), key })),
  }
}

function createGeneralTableBlock(index: number): PostArtworkBlock {
  const style = defaultTableStyle()
  return {
    id: uid('table-general'),
    type: 'table_general',
    name: `Tabela Geral ${index + 1}`,
    x: 60,
    y: 220,
    width: tableVisualWidth(style),
    visible: true,
    dataStart: 1,
    dataEnd: 12,
    style: style as unknown as Record<string, unknown>,
  }
}

function createDayTableBlock(index: number, round?: RoundOption): PostArtworkBlock {
  const style = defaultTableStyle()
  return {
    id: uid('table-day'),
    type: 'table_day',
    name: `Tabela do Dia ${index + 1}`,
    x: 60,
    y: 220,
    width: tableVisualWidth(style),
    visible: true,
    dataStart: 1,
    dataEnd: 12,
    source: round ? { rodadaId: round.id, rodadaName: round.nome } : {},
    style: style as unknown as Record<string, unknown>,
  }
}

function roundOptionsFromPartidas(partidas: ApiPayload['partidas']): RoundOption[] {
  const unique = new Map<string, string>()
  for (const partida of partidas || []) {
    const id = String(partida.rodada_id || '')
    if (!id) continue
    if (!unique.has(id)) unique.set(id, String(partida.rodada_nome || `Rodada ${unique.size + 1}`))
  }
  return [...unique.entries()].map(([id, nome]) => ({ id, nome }))
}

function rowsForBlock(block: PostArtworkBlock, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>) {
  if (block.type === 'table_day') return dayRows[block.source?.rodadaId || ''] || []
  return generalRows
}

function cloneDraft(item: PostArtworkProject): PostArtworkProject {
  return { ...item, blocks: item.blocks.map((block) => ({ ...block, style: structuredClone(block.style || {}) })) }
}

function tableVisualWidth(style: PostArtworkTableStyle) {
  const enabled = style.columns.filter((column) => column.enabled)
  return enabled.reduce((total, column) => total + column.width, 0) + Math.max(0, enabled.length - 1) * style.cellGap
}

function tableVisualHeight(style: PostArtworkTableStyle, rowCount: number) {
  const header = style.showHeader ? style.headerHeight + style.rowGap : 0
  return header + rowCount * style.rowHeight + Math.max(0, rowCount - 1) * style.rowGap
}

function sliceRows(rows: PostArtworkTeamRow[], block: PostArtworkBlock) {
  const start = Math.max(0, (block.dataStart || 1) - 1)
  const end = Math.max(start + 1, block.dataEnd || block.dataStart || 1)
  return rows.slice(start, end)
}

function cellValue(row: PostArtworkTeamRow, key: PostArtworkTableColumnKey) {
  if (key === 'rank') return String(row.rank)
  if (key === 'name') return row.name
  if (key === 'drops') return String(row.drops)
  if (key === 'booyah') return String(row.booyah)
  if (key === 'kills') return String(row.kills)
  if (key === 'points') return String(row.points)
  return ''
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

async function drawCover(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, width: number, height: number) {
  try {
    const image = await loadImage(url)
    ctx.drawImage(image, x, y, width, height)
  } catch {
    // Mantém a cor de fallback quando a imagem não puder ser carregada.
  }
}

async function renderArtworkCanvas(project: PostArtworkProject, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>) {
  const canvas = document.createElement('canvas')
  canvas.width = project.width
  canvas.height = project.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')

  ctx.fillStyle = project.background_color || '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (project.background_url) await drawCover(ctx, project.background_url, 0, 0, canvas.width, canvas.height)

  for (const block of project.blocks.filter((item) => item.visible && (item.type === 'table_general' || item.type === 'table_day'))) {
    const style = normalizeTableStyle(block)
    const blockRows = sliceRows(rowsForBlock(block, generalRows, dayRows), block)
    const columns = style.columns.filter((column) => column.enabled)
    const totalWidth = tableVisualWidth(style)
    let y = block.y

    if (style.showHeader) {
      let x = block.x
      for (const column of columns) {
        ctx.fillStyle = style.headerBackgroundColor
        ctx.fillRect(x, y, column.width, style.headerHeight)
        ctx.fillStyle = style.headerColor
        ctx.font = `800 18px Arial`
        ctx.textBaseline = 'middle'
        ctx.textAlign = column.align
        const tx = column.align === 'left' ? x + 10 : column.align === 'right' ? x + column.width - 10 : x + column.width / 2
        ctx.fillText(column.label, tx, y + style.headerHeight / 2, column.width - 16)
        x += column.width + style.cellGap
      }
      y += style.headerHeight + style.rowGap
    }

    for (const row of blockRows) {
      let x = block.x
      for (const column of columns) {
        ctx.fillStyle = column.backgroundColor || '#15171c'
        ctx.fillRect(x, y, column.width, style.rowHeight)
        if (column.backgroundType === 'image' && column.backgroundUrl) await drawCover(ctx, column.backgroundUrl, x, y, column.width, style.rowHeight)
        if (column.key === 'logo' && row.logo) {
          try {
            const logo = await loadImage(row.logo)
            const size = Math.min(style.rowHeight - 12, column.width - 12)
            ctx.drawImage(logo, x + (column.width - size) / 2, y + (style.rowHeight - size) / 2, size, size)
          } catch {}
        } else {
          ctx.fillStyle = column.color
          ctx.font = `${column.fontWeight} ${column.fontSize}px Arial`
          ctx.textBaseline = 'middle'
          ctx.textAlign = column.align
          const tx = column.align === 'left' ? x + 12 : column.align === 'right' ? x + column.width - 12 : x + column.width / 2
          ctx.fillText(cellValue(row, column.key), tx, y + style.rowHeight / 2, column.width - 18)
        }
        x += column.width + style.cellGap
      }
      y += style.rowHeight + style.rowGap
    }

    block.width = totalWidth
  }
  return canvas
}

function canvasBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg') {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem.')), format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? .94 : undefined))
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PostArtworkWorkspace({ campeonatoId }: { campeonatoId: string }) {
  const [items, setItems] = useState<PostArtworkProject[]>([])
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState<PostArtworkProject | null>(null)
  const [campeonatoNome, setCampeonatoNome] = useState('Campeonato')
  const [standings, setStandings] = useState<PostArtworkTeamRow[]>([])
  const [rounds, setRounds] = useState<RoundOption[]>([])
  const [dayStandings, setDayStandings] = useState<Record<string, PostArtworkTeamRow[]>>({})
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [selectedColumnKey, setSelectedColumnKey] = useState<PostArtworkTableColumnKey>('name')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingCell, setUploadingCell] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)

  async function reload(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const [body, ranking, sumula] = await Promise.all([
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`),
        loadPostArtworkGeneralStandings(campeonatoId).catch(() => []),
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/sumula`).catch(() => ({} as ApiPayload)),
      ])
      const next = body.items || []
      setItems(next)
      setStandings(ranking)
      setRounds(roundOptionsFromPartidas(sumula.partidas))
      setCampeonatoNome(body.campeonato?.nome || 'Campeonato')
      const nextId = preferredId || activeId || next[0]?.id || ''
      setActiveId(nextId)
      const selected = next.find((item) => item.id === nextId) || null
      setDraft(selected ? cloneDraft(selected) : null)
      setSelectedBlockId(selected?.blocks[0]?.id || '')
    } catch (e: any) {
      setError(e?.message || 'Erro ao abrir as artes para postagem.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [campeonatoId])

  const dayRoundKey = useMemo(() => {
    if (!draft) return ''
    return [...new Set(draft.blocks.filter((block) => block.type === 'table_day').map((block) => block.source?.rodadaId).filter(Boolean))].sort().join('|')
  }, [draft])

  useEffect(() => {
    const ids = dayRoundKey ? dayRoundKey.split('|').filter(Boolean) : []
    if (!ids.length) { setDayStandings({}); return }
    let active = true
    Promise.all(ids.map(async (rodadaId) => [rodadaId, await loadPostArtworkDayStandings(campeonatoId, rodadaId).catch(() => [])] as const))
      .then((entries) => { if (active) setDayStandings(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, dayRoundKey])

  function selectItem(id: string) {
    setActiveId(id)
    const selected = items.find((item) => item.id === id) || null
    setDraft(selected ? cloneDraft(selected) : null)
    setSelectedBlockId(selected?.blocks[0]?.id || '')
    setFeedback('')
    setError('')
  }

  async function createProject() {
    setSaving(true)
    setError('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`, { method: 'POST', body: JSON.stringify({ name: `Arte ${items.length + 1}` }) })
      if (body.item) await reload(body.item.id)
    } catch (e: any) { setError(e?.message || 'Erro ao criar arte.') } finally { setSaving(false) }
  }

  async function saveProject() {
    if (!draft) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(draft.id)}`, { method: 'PUT', body: JSON.stringify(draft) })
      if (body.item) {
        setItems((current) => current.map((item) => item.id === body.item!.id ? body.item! : item))
        setDraft(cloneDraft(body.item))
      }
      setFeedback('Arte salva. Depois de cada jogo, basta abrir e baixar novamente com os dados atualizados.')
    } catch (e: any) { setError(e?.message || 'Erro ao salvar arte.') } finally { setSaving(false) }
  }

  async function deleteProject() {
    if (!draft || !window.confirm(`Excluir a arte “${draft.name}”?`)) return
    setSaving(true)
    setError('')
    try {
      await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
      setActiveId(''); setDraft(null); setSelectedBlockId(''); await reload()
    } catch (e: any) { setError(e?.message || 'Erro ao excluir arte.') } finally { setSaving(false) }
  }

  async function uploadBackground(file?: File | null) {
    if (!file || !draft) return
    setUploading(true); setError('')
    try { setDraft({ ...draft, background_url: await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId }) }) }
    catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo.') }
    finally { setUploading(false) }
  }

  function patchDraft(patch: Partial<PostArtworkProject>) { if (draft) setDraft({ ...draft, ...patch }) }

  function patchSlices(patch: Partial<Pick<PostArtworkProject, 'slice_count' | 'slice_direction' | 'slice_width' | 'slice_height'>>) {
    if (!draft) return
    const sliceCount = Math.max(1, Math.min(10, Number(patch.slice_count ?? draft.slice_count) || 1))
    const sliceDirection = (patch.slice_direction ?? draft.slice_direction) as PostArtworkSliceDirection
    const sliceWidth = Math.max(240, Math.min(7680, Number(patch.slice_width ?? draft.slice_width) || 1080))
    const sliceHeight = Math.max(240, Math.min(7680, Number(patch.slice_height ?? draft.slice_height) || 1350))
    patchDraft({ ...patch, slice_count: sliceCount, slice_direction: sliceDirection, slice_width: sliceWidth, slice_height: sliceHeight, width: sliceDirection === 'horizontal' ? sliceWidth * sliceCount : sliceWidth, height: sliceDirection === 'vertical' ? sliceHeight * sliceCount : sliceHeight })
  }

  function addGeneralTable() {
    if (!draft) return
    const block = createGeneralTableBlock(draft.blocks.filter((item) => item.type === 'table_general').length)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addDayTable() {
    if (!draft) return
    const round = rounds[rounds.length - 1]
    const block = createDayTableBlock(draft.blocks.filter((item) => item.type === 'table_day').length, round)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function patchBlock(blockId: string, patch: Partial<PostArtworkBlock>) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) })
  }

  function duplicateBlock(block: PostArtworkBlock) {
    if (!draft) return
    const nextStart = (block.dataEnd || 12) + 1
    const count = Math.max(1, (block.dataEnd || 12) - (block.dataStart || 1) + 1)
    const copy: PostArtworkBlock = { ...structuredClone(block), id: uid(block.type === 'table_day' ? 'table-day' : 'table-general'), name: `${block.name} cópia`, x: block.x + 24, y: block.y + 24, dataStart: nextStart, dataEnd: nextStart + count - 1 }
    setDraft({ ...draft, blocks: [...draft.blocks, copy] })
    setSelectedBlockId(copy.id)
  }

  function deleteBlock(blockId: string) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.filter((block) => block.id !== blockId) })
    setSelectedBlockId((current) => current === blockId ? '' : current)
  }

  const selectedBlock = draft?.blocks.find((block) => block.id === selectedBlockId) || null
  const selectedTableStyle = selectedBlock && (selectedBlock.type === 'table_general' || selectedBlock.type === 'table_day') ? normalizeTableStyle(selectedBlock) : null
  const selectedColumn = selectedTableStyle?.columns.find((column) => column.key === selectedColumnKey) || null

  function patchTableStyle(patch: Partial<PostArtworkTableStyle>) {
    if (!selectedBlock || !selectedTableStyle) return
    const next = { ...selectedTableStyle, ...patch }
    patchBlock(selectedBlock.id, { style: next as unknown as Record<string, unknown>, width: tableVisualWidth(next) })
  }

  function patchColumn(key: PostArtworkTableColumnKey, patch: Partial<PostArtworkTableColumnStyle>) {
    if (!selectedTableStyle) return
    const columns = selectedTableStyle.columns.map((column) => column.key === key ? { ...column, ...patch } : column)
    patchTableStyle({ columns })
  }

  async function uploadColumnBackground(key: PostArtworkTableColumnKey, file?: File | null) {
    if (!file) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchColumn(key, { backgroundType: 'image', backgroundUrl: url })
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo da célula.') }
    finally { setUploadingCell(false) }
  }

  async function exportArtwork() {
    if (!draft || exporting) return
    setExporting(true); setError('')
    try {
      const latestRows = await loadPostArtworkGeneralStandings(campeonatoId)
      const dayIds = [...new Set(draft.blocks.filter((block) => block.type === 'table_day').map((block) => block.source?.rodadaId).filter(Boolean))] as string[]
      const latestDayEntries = await Promise.all(dayIds.map(async (rodadaId) => [rodadaId, await loadPostArtworkDayStandings(campeonatoId, rodadaId)] as const))
      const latestDayRows = Object.fromEntries(latestDayEntries)
      setStandings(latestRows)
      setDayStandings(latestDayRows)
      const board = await renderArtworkCanvas(draft, latestRows, latestDayRows)
      const extension = draft.output_format
      if (draft.slice_count === 1) {
        downloadBlob(await canvasBlob(board, extension), `${draft.name || 'arte'}.${extension}`)
        return
      }
      const zip = new JSZip()
      for (let index = 0; index < draft.slice_count; index += 1) {
        const slice = document.createElement('canvas')
        slice.width = draft.slice_width
        slice.height = draft.slice_height
        const ctx = slice.getContext('2d')!
        const sx = draft.slice_direction === 'horizontal' ? draft.slice_width * index : 0
        const sy = draft.slice_direction === 'vertical' ? draft.slice_height * index : 0
        ctx.drawImage(board, sx, sy, draft.slice_width, draft.slice_height, 0, 0, draft.slice_width, draft.slice_height)
        zip.file(`${draft.name || 'arte'}-${String(index + 1).padStart(2, '0')}.${extension}`, await canvasBlob(slice, extension))
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${draft.name || 'arte'}-carrossel.zip`)
    } catch (e: any) { setError(e?.message || 'Não foi possível gerar as imagens.') }
    finally { setExporting(false) }
  }

  const previewScale = useMemo(() => draft ? Math.min(1, 820 / draft.width, 620 / draft.height) : 1, [draft])

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, block: PostArtworkBlock) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: block.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: block.x, y: block.y }
    setSelectedBlockId(block.id)
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    patchBlock(current.id, { x: Math.round(current.x + (event.clientX - current.startX) / previewScale), y: Math.round(current.y + (event.clientY - current.startY) / previewScale) })
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null }

  if (loading) return <div className="post-artworks-state"><Loader2 className="spin" /> Carregando artes…</div>

  return (
    <div className="post-artworks-page">
      <header className="post-artworks-header">
        <div><a href={`/campeonatos/${campeonatoId}`}><ArrowLeft size={15} /> Voltar ao campeonato</a><small>ARTES PARA POSTAR</small><h1>{campeonatoNome}</h1><p>Templates de redes sociais independentes da transmissão. O layout fica salvo; os dados são atualizados na hora de baixar.</p></div>
        <button type="button" className="post-artworks-primary" onClick={() => void createProject()} disabled={saving}><Plus size={15} /> Nova arte</button>
      </header>

      {error ? <div className="post-artworks-alert error">{error}</div> : null}
      {feedback ? <div className="post-artworks-alert success">{feedback}</div> : null}

      <div className="post-artworks-workspace">
        <aside className="post-artworks-list-panel">
          <div className="post-artworks-panel-title"><strong>Artes salvas</strong><small>{items.length} template(s)</small></div>
          <div className="post-artworks-list">{items.map((item) => <button type="button" key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => selectItem(item.id)}><b>{item.name}</b><span>{item.width} × {item.height}</span><small>{item.slice_count} fatia(s) · {item.output_format.toUpperCase()}</small></button>)}{!items.length ? <div className="post-artworks-empty"><strong>Nenhuma arte criada</strong><span>Crie a primeira prancha para tabela geral, MVP e outros conteúdos.</span></div> : null}</div>
        </aside>

        {draft ? <>
          <section className="post-artworks-controls">
            <div className="post-artworks-panel-title"><strong>{selectedBlock ? 'Bloco selecionado' : 'Projeto'}</strong><small>{selectedBlock ? 'Posição e faixa de dados' : 'Canvas e exportação'}</small></div>
            {!selectedBlock ? <>
              <label>Nome da arte<input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} /></label>
              <div className="post-artworks-grid2"><label>Largura da fatia<EditableNumberInput value={draft.slice_width} min={240} max={7680} onCommit={(value) => patchSlices({ slice_width: value })} /></label><label>Altura da fatia<EditableNumberInput value={draft.slice_height} min={240} max={7680} onCommit={(value) => patchSlices({ slice_height: value })} /></label><label>Quantidade de fatias<EditableNumberInput value={draft.slice_count} min={1} max={10} onCommit={(value) => patchSlices({ slice_count: value })} /></label><label>Direção<select value={draft.slice_direction} onChange={(event) => patchSlices({ slice_direction: event.target.value as PostArtworkSliceDirection })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label></div>
              <div className="post-artworks-summary"><span>Área total</span><strong>{draft.width} × {draft.height}</strong><small>{draft.slice_count} fatia(s) de {draft.slice_width} × {draft.slice_height}</small></div>
              <label>Formato<select value={draft.output_format} onChange={(event) => patchDraft({ output_format: event.target.value as PostArtworkProject['output_format'] })}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
              <label>Cor base<input type="color" value={draft.background_color} onChange={(event) => patchDraft({ background_color: event.target.value })} /></label>
              <label className="post-artworks-upload">{uploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {draft.background_url ? 'Trocar fundo da arte' : 'Enviar fundo da arte'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label>
              {draft.background_url ? <button type="button" className="post-artworks-secondary" onClick={() => patchDraft({ background_url: null })}>Remover fundo</button> : null}
            </> : <>
              <label>Nome do bloco<input value={selectedBlock.name} onChange={(event) => patchBlock(selectedBlock.id, { name: event.target.value })} /></label>
              {selectedBlock.type === 'table_day' ? <label>Rodada / dia<select value={selectedBlock.source?.rodadaId || ''} onChange={(event) => { const round = rounds.find((item) => item.id === event.target.value); patchBlock(selectedBlock.id, { source: { rodadaId: event.target.value, rodadaName: round?.nome || '' } }) }}><option value="">Selecione a rodada</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.nome}</option>)}</select></label> : null}
              <div className="post-artworks-grid2"><label>X<EditableNumberInput value={selectedBlock.x} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { x: value })} /></label><label>Y<EditableNumberInput value={selectedBlock.y} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { y: value })} /></label><label>Do item<EditableNumberInput value={selectedBlock.dataStart || 1} min={1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: value, dataEnd: Math.max(value, selectedBlock.dataEnd || value) })} /></label><label>Até<EditableNumberInput value={selectedBlock.dataEnd || 12} min={selectedBlock.dataStart || 1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataEnd: value })} /></label></div>
              {selectedTableStyle ? <><div className="post-artworks-subtitle"><strong>Tabela</strong><small>Uma coluna de ranking por bloco.</small></div><div className="post-artworks-grid2"><label>Altura da linha<EditableNumberInput value={selectedTableStyle.rowHeight} min={20} max={300} onCommit={(value) => patchTableStyle({ rowHeight: value })} /></label><label>Espaço entre linhas<EditableNumberInput value={selectedTableStyle.rowGap} min={0} max={100} onCommit={(value) => patchTableStyle({ rowGap: value })} /></label><label>Gap entre células<EditableNumberInput value={selectedTableStyle.cellGap} min={0} max={100} onCommit={(value) => patchTableStyle({ cellGap: value })} /></label><label>Altura da legenda<EditableNumberInput value={selectedTableStyle.headerHeight} min={20} max={150} onCommit={(value) => patchTableStyle({ headerHeight: value })} /></label></div><label className="post-artworks-check"><input type="checkbox" checked={selectedTableStyle.showHeader} onChange={(event) => patchTableStyle({ showHeader: event.target.checked })} /> Exibir legenda</label></> : null}
            </>}
            <div className="post-artworks-actions"><button type="button" className="post-artworks-primary" onClick={() => void saveProject()} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar template</button><button type="button" className="post-artworks-download" onClick={() => void exportArtwork()} disabled={exporting}>{exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />} {draft.slice_count > 1 ? 'Baixar carrossel' : 'Baixar imagem'}</button>{selectedBlock ? <button type="button" className="post-artworks-secondary" onClick={() => setSelectedBlockId('')}>Editar projeto</button> : null}<button type="button" className="post-artworks-danger" onClick={() => void deleteProject()} disabled={saving}><Trash2 size={14} /> Excluir arte</button></div>
          </section>

          <main className="post-artworks-preview-panel">
            <div className="post-artworks-panel-title"><strong>Área de trabalho</strong><small>Arraste os blocos. As linhas vêm das estatísticas atuais do campeonato.</small></div>
            <div className="post-artworks-preview-shell">
              <div className="post-artworks-preview" style={{ width: draft.width * previewScale, height: draft.height * previewScale, backgroundColor: draft.background_color, backgroundImage: draft.background_url ? `url(${JSON.stringify(draft.background_url)})` : undefined }}>
                {Array.from({ length: Math.max(0, draft.slice_count - 1) }, (_, index) => <span key={index} className={`post-artworks-slice-line ${draft.slice_direction}`} style={draft.slice_direction === 'horizontal' ? { left: draft.slice_width * (index + 1) * previewScale } : { top: draft.slice_height * (index + 1) * previewScale }} />)}
                {draft.blocks.filter((block) => block.visible && (block.type === 'table_general' || block.type === 'table_day')).map((block) => {
                  const style = normalizeTableStyle(block)
                  const blockRows = sliceRows(rowsForBlock(block, standings, dayStandings), block)
                  const columns = style.columns.filter((column) => column.enabled)
                  return <div key={block.id} className={`post-artworks-table-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: tableVisualWidth(style) * previewScale, height: tableVisualHeight(style, blockRows.length) * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {style.showHeader ? <div className="post-artworks-table-row header" style={{ height: style.headerHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} style={{ width: column.width * previewScale, background: style.headerBackgroundColor, color: style.headerColor, fontSize: Math.max(7, 18 * previewScale) }}>{column.label}</div>)}</div> : null}
                    {blockRows.map((row) => <div key={`${block.id}-${row.rank}`} className="post-artworks-table-row" style={{ height: style.rowHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} className={`cell align-${column.align}`} style={{ width: column.width * previewScale, color: column.color, fontSize: Math.max(7, column.fontSize * previewScale), fontWeight: column.fontWeight, backgroundColor: column.backgroundColor, backgroundImage: column.backgroundType === 'image' && column.backgroundUrl ? `url(${JSON.stringify(column.backgroundUrl)})` : undefined }}>{column.key === 'logo' ? (row.logo ? <img src={row.logo} alt="" draggable={false} /> : null) : cellValue(row, column.key)}</div>)}</div>)}
                    {!blockRows.length ? <div className="post-artworks-no-data">{block.type === 'table_day' && !block.source?.rodadaId ? 'Selecione a rodada do bloco' : 'Sem dados nessa faixa'}</div> : null}
                  </div>
                })}
                {!draft.blocks.length ? <div className="post-artworks-canvas-empty"><strong>Adicione um bloco de estatística</strong><span>Use Tabela Geral para o acumulado ou Tabela do Dia para uma rodada específica.</span></div> : null}
              </div>
            </div>
          </main>

          <aside className="post-artworks-blocks-panel">
            <div className="post-artworks-panel-title"><strong>Blocos da arte</strong><small>Independentes da transmissão</small></div>
            <div className="post-artworks-add-blocks"><button type="button" className="post-artworks-add-block" onClick={addGeneralTable}><Plus size={14} /> Tabela Geral</button><button type="button" className="post-artworks-add-block" onClick={addDayTable}><Plus size={14} /> Tabela do Dia</button></div>
            <div className="post-artworks-block-list">{draft.blocks.map((block) => <article key={block.id} className={block.id === selectedBlockId ? 'active' : ''}><button type="button" className="post-artworks-block-select" onClick={() => setSelectedBlockId(block.id)}><small>{block.type === 'table_day' ? 'TABELA DO DIA' : 'TABELA GERAL'}</small><strong>{block.name}</strong><span>{block.type === 'table_day' ? `${block.source?.rodadaName || 'Rodada não selecionada'} · ` : ''}Top {block.dataStart || 1}–{block.dataEnd || 12}</span></button><div><button type="button" title="Duplicar e avançar a faixa" onClick={() => duplicateBlock(block)}><Copy size={13} /></button><button type="button" title="Excluir bloco" onClick={() => deleteBlock(block.id)}><Trash2 size={13} /></button></div></article>)}</div>
            {selectedBlock && selectedTableStyle ? <div className="post-artworks-column-editor"><div className="post-artworks-subtitle"><strong>Colunas</strong><small>Ative, dimensione e aplique fundo por célula.</small></div><div className="post-artworks-column-tabs">{selectedTableStyle.columns.map((column) => <button type="button" key={column.key} className={selectedColumnKey === column.key ? 'active' : ''} onClick={() => setSelectedColumnKey(column.key)}>{TABLE_COLUMN_META[column.key].label || 'LOGO'}</button>)}</div>{selectedColumn ? <><label className="post-artworks-check"><input type="checkbox" checked={selectedColumn.enabled} onChange={(event) => patchColumn(selectedColumn.key, { enabled: event.target.checked })} /> Exibir coluna</label><label>Largura<EditableNumberInput value={selectedColumn.width} min={30} max={1000} onCommit={(value) => patchColumn(selectedColumn.key, { width: value })} /></label><label>Legenda<input value={selectedColumn.label} onChange={(event) => patchColumn(selectedColumn.key, { label: event.target.value })} /></label><label>Fundo<select value={selectedColumn.backgroundType} onChange={(event) => patchColumn(selectedColumn.key, { backgroundType: event.target.value as 'color' | 'image' })}><option value="color">Cor</option><option value="image">Imagem</option></select></label>{selectedColumn.backgroundType === 'color' ? <label>Cor do fundo<input type="color" value={selectedColumn.backgroundColor} onChange={(event) => patchColumn(selectedColumn.key, { backgroundColor: event.target.value })} /></label> : <label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedColumn.backgroundUrl ? 'Trocar fundo das células' : 'Enviar fundo das células'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadColumnBackground(selectedColumn.key, event.target.files?.[0])} /></label>}{selectedColumn.key !== 'logo' ? <div className="post-artworks-grid2"><label>Tamanho do texto<EditableNumberInput value={selectedColumn.fontSize} min={8} max={120} onCommit={(value) => patchColumn(selectedColumn.key, { fontSize: value })} /></label><label>Peso<EditableNumberInput value={selectedColumn.fontWeight} min={100} max={900} onCommit={(value) => patchColumn(selectedColumn.key, { fontWeight: value })} /></label><label>Cor do texto<input type="color" value={selectedColumn.color} onChange={(event) => patchColumn(selectedColumn.key, { color: event.target.value })} /></label><label>Alinhamento<select value={selectedColumn.align} onChange={(event) => patchColumn(selectedColumn.key, { align: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div> : null}</> : null}</div> : null}
          </aside>
        </> : <section className="post-artworks-welcome"><strong>Crie ou selecione uma arte</strong><span>O editor de redes sociais é independente da transmissão.</span></section>}
      </div>
    </div>
  )
}
