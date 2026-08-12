'use client'

import { ArrowLeft, Copy, Download, ImagePlus, Images, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import JSZip from 'jszip'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import { loadPostArtworkGameBooyahs, loadPostArtworkGameMvp, loadPostArtworkGameStandings, loadPostArtworkGeneralMvp, loadPostArtworkGeneralStandings, loadPostArtworkKillLeaders } from '../services/post-artwork-data.service'
import type {
  PostArtworkAsset,
  PostArtworkAssetKind,
  PostArtworkBlock,
  PostArtworkMvpStyle,
  PostArtworkPlayerRow,
  PostArtworkProject,
  PostArtworkSliceDirection,
  PostArtworkTableColumnKey,
  PostArtworkTableColumnStyle,
  PostArtworkTableStyle,
  PostArtworkTeamRow,
} from '../types/artwork.types'
import '../post-artworks.css'

type ApiPayload = { campeonato?: { id: string; nome: string }; items?: PostArtworkProject[]; item?: PostArtworkProject; assets?: PostArtworkAsset[]; asset?: PostArtworkAsset; jogos?: Array<any>; error?: string }
type GameOption = { id: string; nome: string; mataMata: boolean; classificamQuantidade: number | null }
type AssetTarget = 'project' | 'column' | 'header' | 'mvp'

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

function EditableNumberInput(props: { value: number; min?: number; max?: number; step?: number; bigStep?: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(props.value))
  const holdRef = useRef<number | null>(null)
  const repeatRef = useRef<number | null>(null)
  useEffect(() => setText(String(props.value)), [props.value])

  function clearHold() {
    if (holdRef.current !== null) window.clearTimeout(holdRef.current)
    if (repeatRef.current !== null) window.clearInterval(repeatRef.current)
    holdRef.current = null
    repeatRef.current = null
  }

  useEffect(() => clearHold, [])

  function clamp(value: number) {
    let next = Math.round(value)
    if (props.min !== undefined) next = Math.max(props.min, next)
    if (props.max !== undefined) next = Math.min(props.max, next)
    return next
  }

  function commitValue(value: number) {
    const next = clamp(value)
    props.onCommit(next)
    setText(String(next))
  }

  function commit() {
    const normalized = text.trim().replace(',', '.')
    if (!normalized || normalized === '-' || normalized === '.') { setText(String(props.value)); return }
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) { setText(String(props.value)); return }
    commitValue(parsed)
  }

  function nudge(direction: -1 | 1, big = false) {
    const normalized = text.trim().replace(',', '.')
    const base = Number.isFinite(Number(normalized)) ? Number(normalized) : props.value
    const step = big ? (props.bigStep ?? 10) : (props.step ?? 1)
    commitValue(base + direction * step)
  }

  function startHold(direction: -1 | 1, big: boolean) {
    nudge(direction, big)
    clearHold()
    holdRef.current = window.setTimeout(() => {
      repeatRef.current = window.setInterval(() => nudge(direction, big), 110)
    }, 320)
  }

  return <div className="post-artworks-number-input"><input inputMode="numeric" value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
    if (event.key === 'Escape') { setText(String(props.value)); event.currentTarget.blur() }
    if (event.key === 'ArrowUp') { event.preventDefault(); nudge(1, event.shiftKey) }
    if (event.key === 'ArrowDown') { event.preventDefault(); nudge(-1, event.shiftKey) }
  }} /><div className="post-artworks-number-stepper"><button type="button" aria-label="Aumentar valor" onMouseDown={(event) => startHold(1, event.shiftKey)} onMouseUp={clearHold} onMouseLeave={clearHold} onTouchStart={() => startHold(1, false)} onTouchEnd={clearHold}>▲</button><button type="button" aria-label="Diminuir valor" onMouseDown={(event) => startHold(-1, event.shiftKey)} onMouseUp={clearHold} onMouseLeave={clearHold} onTouchStart={() => startHold(-1, false)} onTouchEnd={clearHold}>▼</button></div></div>
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
    headerBackgroundType: 'color',
    headerBackgroundColor: '#111318',
    headerBackgroundUrl: null,
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
    headerBackgroundType: raw.headerBackgroundType === 'image' || raw.headerBackgroundType === 'none' ? raw.headerBackgroundType : 'color',
    headerBackgroundColor: String(raw.headerBackgroundColor || '#111318'),
    headerBackgroundUrl: typeof raw.headerBackgroundUrl === 'string' ? raw.headerBackgroundUrl : null,
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

function createDayTableBlock(index: number, game?: GameOption): PostArtworkBlock {
  const style = defaultTableStyle()
  return {
    id: uid('table-day'),
    type: 'table_day',
    name: `Tabela do Jogo ${index + 1}`,
    x: 60,
    y: 220,
    width: tableVisualWidth(style),
    visible: true,
    dataStart: 1,
    dataEnd: 12,
    source: game ? { jogoId: game.id, jogoName: game.nome } : {},
    style: style as unknown as Record<string, unknown>,
  }
}

function tableStyleWithColumns(enabledKeys: PostArtworkTableColumnKey[]) {
  const style = defaultTableStyle()
  style.columns = style.columns.map((column) => ({ ...column, enabled: enabledKeys.includes(column.key) }))
  return style
}

function createQualifiedTeamsBlock(index: number, game?: GameOption): PostArtworkBlock {
  const style = tableStyleWithColumns(['rank', 'logo', 'name', 'points'])
  const limit = game?.mataMata && game.classificamQuantidade ? game.classificamQuantidade : 12
  return { id: uid('qualified-teams'), type: 'qualified_teams', name: `Classificados ${index + 1}`, x: 60, y: 220, width: tableVisualWidth(style), visible: true, dataStart: 1, dataEnd: limit, source: game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function createBooyahsDayBlock(index: number, game?: GameOption): PostArtworkBlock {
  const style = tableStyleWithColumns(['rank', 'logo', 'name', 'booyah', 'kills'])
  return { id: uid('booyahs-day'), type: 'booyahs_day', name: `Booyahs do Jogo ${index + 1}`, x: 60, y: 220, width: tableVisualWidth(style), visible: true, dataStart: 1, dataEnd: 12, source: game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function defaultMvpStyle(): PostArtworkMvpStyle {
  return {
    cardWidth: 420, cardHeight: 560, backgroundType: 'color', backgroundColor: '#15171c', backgroundUrl: null,
    imageSize: 260, imageRadius: 18, nameColor: '#ffffff', nameFontSize: 38, nameFontWeight: 900,
    teamColor: '#c8cbd2', teamFontSize: 20, statsColor: '#ffffff', statsFontSize: 24,
    showPhoto: true, showTeam: true, showDrops: true, showKills: true, gap: 16,
  }
}

function normalizeMvpStyle(block: PostArtworkBlock): PostArtworkMvpStyle {
  return { ...defaultMvpStyle(), ...((block.style || {}) as Partial<PostArtworkMvpStyle>) }
}

function createMvpBlock(type: 'mvp_general' | 'mvp_day', index: number, game?: GameOption): PostArtworkBlock {
  const style = defaultMvpStyle()
  return { id: uid(type === 'mvp_day' ? 'mvp-day' : 'mvp-general'), type, name: `${type === 'mvp_day' ? 'MVP do Jogo' : 'MVP Geral'} ${index + 1}`, x: 60, y: 160, width: style.cardWidth, visible: true, dataStart: 1, dataEnd: 1, source: type === 'mvp_day' && game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function playerForBlock(block: PostArtworkBlock, general: PostArtworkPlayerRow[], day: Record<string, PostArtworkPlayerRow[]>, killLeaders: PostArtworkPlayerRow[] = []) {
  const rows = block.type === 'mvp_day' ? day[block.source?.jogoId || ''] || [] : block.type === 'kills_leaders' ? killLeaders : general
  return rows[Math.max(0, (block.dataStart || 1) - 1)] || null
}

function gameOptionsFromApi(jogos: ApiPayload['jogos']): GameOption[] {
  return (jogos || []).map((game: any) => ({
    id: String(game.id || ''),
    nome: String(game.nome || 'Jogo'),
    mataMata: Boolean(game.mata_mata),
    classificamQuantidade: game.classificam_quantidade == null ? null : Number(game.classificam_quantidade),
  })).filter((game) => game.id)
}

function rowsForBlock(block: PostArtworkBlock, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>, booyahRows: Record<string, PostArtworkTeamRow[]> = {}) {
  if (block.type === 'table_day' || block.type === 'qualified_teams') return dayRows[block.source?.jogoId || ''] || []
  if (block.type === 'booyahs_day') return booyahRows[block.source?.jogoId || ''] || []
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

const MAX_EXPORT_RENDER_PIXELS = 40_000_000

function resolveExportRenderScale(width: number, height: number) {
  const basePixels = Math.max(1, width * height)
  const safeScale = Math.sqrt(MAX_EXPORT_RENDER_PIXELS / basePixels)
  return Math.max(1, Math.min(2, safeScale))
}

async function renderArtworkCanvas(project: PostArtworkProject, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>, mvpGeneralRows: PostArtworkPlayerRow[], mvpDayRows: Record<string, PostArtworkPlayerRow[]>, booyahRows: Record<string, PostArtworkTeamRow[]> = {}, killLeaderRows: PostArtworkPlayerRow[] = [], renderScale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(project.width * renderScale))
  canvas.height = Math.max(1, Math.round(project.height * renderScale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.scale(renderScale, renderScale)
  ctx.fillStyle = project.background_color || '#ffffff'
  ctx.fillRect(0, 0, project.width, project.height)
  if (project.background_url) await drawCover(ctx, project.background_url, 0, 0, project.width, project.height)

  for (const block of project.blocks.filter((item) => item.visible && (item.type === 'table_general' || item.type === 'table_day' || item.type === 'qualified_teams' || item.type === 'booyahs_day'))) {
    const style = normalizeTableStyle(block)
    const blockRows = sliceRows(rowsForBlock(block, generalRows, dayRows, booyahRows), block)
    const columns = style.columns.filter((column) => column.enabled)
    const totalWidth = tableVisualWidth(style)
    let y = block.y

    if (style.showHeader) {
      if (style.headerBackgroundType === 'image' && style.headerBackgroundUrl) {
        await drawCover(ctx, style.headerBackgroundUrl, block.x, y, totalWidth, style.headerHeight)
      }
      let x = block.x
      for (const column of columns) {
        if (style.headerBackgroundType === 'color') {
          ctx.fillStyle = style.headerBackgroundColor
          ctx.fillRect(x, y, column.width, style.headerHeight)
        }
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
        if (column.backgroundType === 'color') {
          ctx.fillStyle = column.backgroundColor || '#15171c'
          ctx.fillRect(x, y, column.width, style.rowHeight)
        } else if (column.backgroundType === 'image' && column.backgroundUrl) {
          await drawCover(ctx, column.backgroundUrl, x, y, column.width, style.rowHeight)
        }
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

  for (const block of project.blocks.filter((item) => item.visible && (item.type === 'mvp_general' || item.type === 'mvp_day' || item.type === 'kills_leaders'))) {
    const style = normalizeMvpStyle(block)
    const player = playerForBlock(block, mvpGeneralRows, mvpDayRows, killLeaderRows)
    const x = block.x
    let y = block.y
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(x, y, style.cardWidth, style.cardHeight)
    if (style.backgroundType === 'image' && style.backgroundUrl) await drawCover(ctx, style.backgroundUrl, x, y, style.cardWidth, style.cardHeight)
    if (!player) continue
    y += style.gap
    if (style.showPhoto) {
      const px = x + (style.cardWidth - style.imageSize) / 2
      if (player.photo) {
        try {
          const photo = await loadImage(player.photo)
          ctx.save(); ctx.beginPath(); ctx.roundRect(px, y, style.imageSize, style.imageSize, style.imageRadius); ctx.clip(); ctx.drawImage(photo, px, y, style.imageSize, style.imageSize); ctx.restore()
        } catch {}
      }
      y += style.imageSize + style.gap
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = style.nameColor; ctx.font = `${style.nameFontWeight} ${style.nameFontSize}px Arial`; ctx.fillText(player.nick, x + style.cardWidth / 2, y + style.nameFontSize / 2, style.cardWidth - style.gap * 2)
    y += style.nameFontSize + style.gap
    if (style.showTeam && player.team) { ctx.fillStyle = style.teamColor; ctx.font = `700 ${style.teamFontSize}px Arial`; ctx.fillText(player.team, x + style.cardWidth / 2, y + style.teamFontSize / 2, style.cardWidth - style.gap * 2); y += style.teamFontSize + style.gap }
    const stats = [style.showKills ? `${player.kills} ABATES` : '', style.showDrops ? `${player.drops} QUEDAS` : ''].filter(Boolean).join('  •  ')
    if (stats) { ctx.fillStyle = style.statsColor; ctx.font = `800 ${style.statsFontSize}px Arial`; ctx.fillText(stats, x + style.cardWidth / 2, y + style.statsFontSize / 2, style.cardWidth - style.gap * 2) }
  }
  return canvas
}

function createDownsampledCanvas(source: HTMLCanvasElement, width: number, height: number, sx = 0, sy = 0, sw = source.width, sh = source.height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

function canvasBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg') {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem.')), format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? .98 : undefined))
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
  const [games, setGames] = useState<GameOption[]>([])
  const [dayStandings, setDayStandings] = useState<Record<string, PostArtworkTeamRow[]>>({})
  const [mvpGeneral, setMvpGeneral] = useState<PostArtworkPlayerRow[]>([])
  const [mvpDay, setMvpDay] = useState<Record<string, PostArtworkPlayerRow[]>>({})
  const [booyahDay, setBooyahDay] = useState<Record<string, PostArtworkTeamRow[]>>({})
  const [killLeaders, setKillLeaders] = useState<PostArtworkPlayerRow[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [selectedColumnKey, setSelectedColumnKey] = useState<PostArtworkTableColumnKey>('name')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingCell, setUploadingCell] = useState(false)
  const [assets, setAssets] = useState<PostArtworkAsset[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [assetTarget, setAssetTarget] = useState<AssetTarget>('project')
  const [libraryError, setLibraryError] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [previewZoom, setPreviewZoom] = useState(100)
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const previewShellRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null)

  async function reloadAssets() {
    setLibraryError('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets`)
      setAssets(body.assets || [])
    } catch (e: any) {
      setAssets([])
      setLibraryError(e?.message || 'Não foi possível carregar a biblioteca de imagens.')
    }
  }

  async function rememberAsset(url: string, name: string, kind: PostArtworkAssetKind) {
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets`, { method: 'POST', body: JSON.stringify({ url, name, kind }) })
      if (body.asset) setAssets((current) => [body.asset!, ...current.filter((item) => item.id !== body.asset!.id)])
    } catch (e: any) {
      setLibraryError(e?.message || 'Imagem enviada, mas não foi possível salvá-la na biblioteca.')
    }
  }

  function openAssetLibrary(target: AssetTarget) {
    setAssetTarget(target)
    setLibraryOpen(true)
    if (!assets.length) void reloadAssets()
  }

  function applyLibraryAsset(asset: PostArtworkAsset) {
    if (assetTarget === 'project' && draft) setDraft({ ...draft, background_url: asset.url })
    if (assetTarget === 'column' && selectedColumn) patchColumn(selectedColumn.key, { backgroundType: 'image', backgroundUrl: asset.url })
    if (assetTarget === 'header' && selectedTableStyle) patchTableStyle({ headerBackgroundType: 'image', headerBackgroundUrl: asset.url })
    if (assetTarget === 'mvp' && selectedMvpStyle) patchMvpStyle({ backgroundType: 'image', backgroundUrl: asset.url })
    setLibraryOpen(false)
  }

  async function deleteLibraryAsset(assetId: string) {
    try {
      await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' })
      setAssets((current) => current.filter((item) => item.id !== assetId))
    } catch (e: any) { setLibraryError(e?.message || 'Não foi possível remover a imagem da biblioteca.') }
  }

  async function reload(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const [body, ranking, mvpRanking, killRanking, gamesPayload] = await Promise.all([
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`),
        loadPostArtworkGeneralStandings(campeonatoId).catch(() => []),
        loadPostArtworkGeneralMvp(campeonatoId).catch(() => []),
        loadPostArtworkKillLeaders(campeonatoId).catch(() => []),
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/jogos`).catch(() => ({} as ApiPayload)),
      ])
      const next = body.items || []
      setItems(next)
      setStandings(ranking)
      setMvpGeneral(mvpRanking)
      setKillLeaders(killRanking)
      setGames(gameOptionsFromApi(gamesPayload.jogos))
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

  useEffect(() => { void reload(); void reloadAssets() }, [campeonatoId])

  const dayGameKey = useMemo(() => {
    if (!draft) return ''
    return [...new Set(draft.blocks.filter((block) => block.type === 'table_day' || block.type === 'qualified_teams').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [draft])

  useEffect(() => {
    const ids = dayGameKey ? dayGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setDayStandings({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameStandings(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setDayStandings(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, dayGameKey])

  const booyahGameKey = useMemo(() => {
    if (!draft) return ''
    return [...new Set(draft.blocks.filter((block) => block.type === 'booyahs_day').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [draft])

  useEffect(() => {
    const ids = booyahGameKey ? booyahGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setBooyahDay({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameBooyahs(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setBooyahDay(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, booyahGameKey])

  const mvpGameKey = useMemo(() => {
    if (!draft) return ''
    return [...new Set(draft.blocks.filter((block) => block.type === 'mvp_day').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [draft])

  useEffect(() => {
    const ids = mvpGameKey ? mvpGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setMvpDay({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameMvp(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setMvpDay(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, mvpGameKey])

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
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      setDraft({ ...draft, background_url: url })
      void rememberAsset(url, file.name || 'Fundo da arte', 'background')
    }
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
    const game = games[games.length - 1]
    const block = createDayTableBlock(draft.blocks.filter((item) => item.type === 'table_day').length, game)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addMvpGeneral() {
    if (!draft) return
    const block = createMvpBlock('mvp_general', draft.blocks.filter((item) => item.type === 'mvp_general').length)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addMvpDay() {
    if (!draft) return
    const block = createMvpBlock('mvp_day', draft.blocks.filter((item) => item.type === 'mvp_day').length, games[games.length - 1])
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }


  function addQualifiedTeams() {
    if (!draft) return
    const block = createQualifiedTeamsBlock(draft.blocks.filter((item) => item.type === 'qualified_teams').length, games[games.length - 1])
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addBooyahsDay() {
    if (!draft) return
    const game = games[games.length - 1]
    const block = createBooyahsDayBlock(draft.blocks.filter((item) => item.type === 'booyahs_day').length, game)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addKillLeaders() {
    if (!draft) return
    const block = createMvpBlock('mvp_general', draft.blocks.filter((item) => item.type === 'kills_leaders').length)
    const next = { ...block, id: uid('kills-leaders'), type: 'kills_leaders' as const, name: `Líder de Abates ${draft.blocks.filter((item) => item.type === 'kills_leaders').length + 1}` }
    setDraft({ ...draft, blocks: [...draft.blocks, next] })
    setSelectedBlockId(next.id)
  }

  function patchBlock(blockId: string, patch: Partial<PostArtworkBlock>) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) })
  }

  function duplicateBlock(block: PostArtworkBlock) {
    if (!draft) return
    const nextStart = (block.dataEnd || 12) + 1
    const count = Math.max(1, (block.dataEnd || 12) - (block.dataStart || 1) + 1)
    const copy: PostArtworkBlock = { ...structuredClone(block), id: uid(block.type === 'table_day' ? 'table-day' : block.type === 'booyahs_day' ? 'booyahs-day' : block.type === 'qualified_teams' ? 'qualified-teams' : block.type === 'mvp_day' ? 'mvp-day' : block.type === 'kills_leaders' ? 'kills-leaders' : block.type === 'mvp_general' ? 'mvp-general' : 'table-general'), name: `${block.name} cópia`, x: block.x + 24, y: block.y + 24, dataStart: nextStart, dataEnd: nextStart + count - 1 }
    setDraft({ ...draft, blocks: [...draft.blocks, copy] })
    setSelectedBlockId(copy.id)
  }

  function deleteBlock(blockId: string) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.filter((block) => block.id !== blockId) })
    setSelectedBlockId((current) => current === blockId ? '' : current)
  }

  const selectedBlock = draft?.blocks.find((block) => block.id === selectedBlockId) || null
  const selectedTableStyle = selectedBlock && (selectedBlock.type === 'table_general' || selectedBlock.type === 'table_day' || selectedBlock.type === 'qualified_teams' || selectedBlock.type === 'booyahs_day') ? normalizeTableStyle(selectedBlock) : null
  const selectedMvpStyle = selectedBlock && (selectedBlock.type === 'mvp_general' || selectedBlock.type === 'mvp_day' || selectedBlock.type === 'kills_leaders') ? normalizeMvpStyle(selectedBlock) : null
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

  function patchMvpStyle(patch: Partial<PostArtworkMvpStyle>) {
    if (!selectedBlock || !selectedMvpStyle) return
    const next = { ...selectedMvpStyle, ...patch }
    patchBlock(selectedBlock.id, { style: next as unknown as Record<string, unknown>, width: next.cardWidth })
  }

  async function uploadMvpBackground(file?: File | null) {
    if (!file || !selectedBlock || !selectedMvpStyle) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchMvpStyle({ backgroundType: 'image', backgroundUrl: url })
      void rememberAsset(url, file.name || 'Fundo de MVP', 'card')
    }
    catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo do card MVP.') }
    finally { setUploadingCell(false) }
  }

  async function uploadHeaderBackground(file?: File | null) {
    if (!file || !selectedTableStyle) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchTableStyle({ headerBackgroundType: 'image', headerBackgroundUrl: url })
      void rememberAsset(url, file.name || 'Fundo da legenda', 'cell')
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo da legenda.') }
    finally { setUploadingCell(false) }
  }

  async function uploadColumnBackground(key: PostArtworkTableColumnKey, file?: File | null) {
    if (!file) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchColumn(key, { backgroundType: 'image', backgroundUrl: url })
      void rememberAsset(url, file.name || `Fundo ${TABLE_COLUMN_META[key].label || 'logo'}`, 'cell')
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo da célula.') }
    finally { setUploadingCell(false) }
  }

  async function exportArtwork() {
    if (!draft || exporting) return
    setExporting(true); setError('')
    try {
      const [latestRows, latestMvpGeneral] = await Promise.all([loadPostArtworkGeneralStandings(campeonatoId), loadPostArtworkGeneralMvp(campeonatoId)])
      const dayIds = [...new Set(draft.blocks.filter((block) => block.type === 'table_day' || block.type === 'qualified_teams').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestDayEntries = await Promise.all(dayIds.map(async (rodadaId) => [rodadaId, await loadPostArtworkGameStandings(campeonatoId, rodadaId)] as const))
      const latestDayRows = Object.fromEntries(latestDayEntries)
      const booyahDayIds = [...new Set(draft.blocks.filter((block) => block.type === 'booyahs_day').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestBooyahEntries = await Promise.all(booyahDayIds.map(async (rodadaId) => [rodadaId, await loadPostArtworkGameBooyahs(campeonatoId, rodadaId)] as const))
      const latestBooyahRows = Object.fromEntries(latestBooyahEntries)
      const latestKillLeaders = draft.blocks.some((block) => block.type === 'kills_leaders') ? await loadPostArtworkKillLeaders(campeonatoId) : []
      const mvpDayIds = [...new Set(draft.blocks.filter((block) => block.type === 'mvp_day').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestMvpDayEntries = await Promise.all(mvpDayIds.map(async (rodadaId) => [rodadaId, await loadPostArtworkGameMvp(campeonatoId, rodadaId)] as const))
      const latestMvpDayRows = Object.fromEntries(latestMvpDayEntries)
      setStandings(latestRows)
      setDayStandings(latestDayRows)
      setMvpGeneral(latestMvpGeneral)
      setMvpDay(latestMvpDayRows)
      setBooyahDay(latestBooyahRows)
      setKillLeaders(latestKillLeaders)
      const renderScale = resolveExportRenderScale(draft.width, draft.height)
      const board = await renderArtworkCanvas(draft, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders, renderScale)
      const extension = draft.output_format
      if (draft.slice_count === 1) {
        const finalCanvas = createDownsampledCanvas(board, draft.width, draft.height)
        downloadBlob(await canvasBlob(finalCanvas, extension), `${draft.name || 'arte'}.${extension}`)
        return
      }
      const zip = new JSZip()
      for (let index = 0; index < draft.slice_count; index += 1) {
        const sx = (draft.slice_direction === 'horizontal' ? draft.slice_width * index : 0) * renderScale
        const sy = (draft.slice_direction === 'vertical' ? draft.slice_height * index : 0) * renderScale
        const sw = draft.slice_width * renderScale
        const sh = draft.slice_height * renderScale
        const slice = createDownsampledCanvas(board, draft.slice_width, draft.slice_height, sx, sy, sw, sh)
        zip.file(`${draft.name || 'arte'}-${String(index + 1).padStart(2, '0')}.${extension}`, await canvasBlob(slice, extension))
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${draft.name || 'arte'}-carrossel.zip`)
    } catch (e: any) { setError(e?.message || 'Não foi possível gerar as imagens.') }
    finally { setExporting(false) }
  }

  const fitPreviewScale = useMemo(() => draft ? Math.min(1, 820 / draft.width, 620 / draft.height) : 1, [draft])
  const previewScale = useMemo(() => fitPreviewScale * (previewZoom / 100), [fitPreviewScale, previewZoom])


  function changePreviewZoom(next: number, anchor?: { x: number; y: number }) {
    const shell = previewShellRef.current
    const nextZoom = Math.max(25, Math.min(400, Math.round(next)))
    if (!shell || !draft) { setPreviewZoom(nextZoom); return }

    const currentScale = fitPreviewScale * (previewZoom / 100)
    const nextScale = fitPreviewScale * (nextZoom / 100)
    const anchorX = anchor?.x ?? shell.clientWidth / 2
    const anchorY = anchor?.y ?? shell.clientHeight / 2
    const contentX = (shell.scrollLeft + anchorX) / Math.max(currentScale, .0001)
    const contentY = (shell.scrollTop + anchorY) / Math.max(currentScale, .0001)

    setPreviewZoom(nextZoom)
    requestAnimationFrame(() => {
      shell.scrollLeft = contentX * nextScale - anchorX
      shell.scrollTop = contentY * nextScale - anchorY
    })
  }

  function handlePreviewWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    changePreviewZoom(previewZoom + (event.deltaY < 0 ? 10 : -10), { x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('.post-artworks-table-block,.post-artworks-mvp-block,.post-artworks-zoom-actions')) return
    const shell = previewShellRef.current
    if (!shell) return
    event.preventDefault()
    shell.setPointerCapture(event.pointerId)
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, scrollLeft: shell.scrollLeft, scrollTop: shell.scrollTop }
    shell.classList.add('is-panning')
  }

  function panPreview(event: ReactPointerEvent<HTMLDivElement>) {
    const current = panRef.current
    const shell = previewShellRef.current
    if (!current || !shell || current.pointerId !== event.pointerId) return
    shell.scrollLeft = current.scrollLeft - (event.clientX - current.startX)
    shell.scrollTop = current.scrollTop - (event.clientY - current.startY)
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const shell = previewShellRef.current
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    shell?.classList.remove('is-panning')
  }

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
        <div className="post-artworks-header-actions"><button type="button" className="post-artworks-secondary" onClick={() => openAssetLibrary('project')}><Images size={15} /> Biblioteca de imagens</button><button type="button" className="post-artworks-primary" onClick={() => void createProject()} disabled={saving}><Plus size={15} /> Nova arte</button></div>
      </header>

      {error ? <div className="post-artworks-alert error">{error}</div> : null}
      {feedback ? <div className="post-artworks-alert success">{feedback}</div> : null}
      {libraryError ? <div className="post-artworks-alert error">Biblioteca: {libraryError}</div> : null}

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
              <label className="post-artworks-upload">{uploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {draft.background_url ? 'Trocar fundo da arte' : 'Enviar fundo da arte'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('project')}><Images size={14} /> Escolher da biblioteca</button>
              {draft.background_url ? <button type="button" className="post-artworks-secondary" onClick={() => patchDraft({ background_url: null })}>Remover fundo</button> : null}
            </> : <>
              <label>Nome do bloco<input value={selectedBlock.name} onChange={(event) => patchBlock(selectedBlock.id, { name: event.target.value })} /></label>
              {(selectedBlock.type === 'table_day' || selectedBlock.type === 'booyahs_day' || selectedBlock.type === 'mvp_day' || selectedBlock.type === 'qualified_teams') ? <label>Jogo<select value={selectedBlock.source?.jogoId || ''} onChange={(event) => { const game = games.find((item) => item.id === event.target.value); patchBlock(selectedBlock.id, { source: { jogoId: event.target.value, jogoName: game?.nome || '' }, ...(selectedBlock.type === 'qualified_teams' && game?.mataMata && game.classificamQuantidade ? { dataStart: 1, dataEnd: game.classificamQuantidade } : {}) }) }}><option value="">Selecione o jogo</option>{games.filter((game) => selectedBlock.type !== 'qualified_teams' || (game.mataMata && game.classificamQuantidade)).map((game) => <option key={game.id} value={game.id}>{game.nome}{game.mataMata && game.classificamQuantidade ? ` · Top ${game.classificamQuantidade} passa` : ''}</option>)}</select></label> : null}
              <div className="post-artworks-grid2"><label>X<EditableNumberInput value={selectedBlock.x} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { x: value })} /></label><label>Y<EditableNumberInput value={selectedBlock.y} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { y: value })} /></label>{selectedMvpStyle ? <label>Posição no ranking<EditableNumberInput value={selectedBlock.dataStart || 1} min={1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: value, dataEnd: value })} /></label> : <><label>Do item<EditableNumberInput value={selectedBlock.dataStart || 1} min={1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: value, dataEnd: Math.max(value, selectedBlock.dataEnd || value) })} /></label><label>Até<EditableNumberInput value={selectedBlock.dataEnd || 12} min={selectedBlock.dataStart || 1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataEnd: value })} /></label></>}</div>
              {selectedTableStyle ? <><div className="post-artworks-subtitle"><strong>Tabela</strong><small>Uma coluna de ranking por bloco.</small></div><div className="post-artworks-grid2"><label>Altura da linha<EditableNumberInput value={selectedTableStyle.rowHeight} min={20} max={300} onCommit={(value) => patchTableStyle({ rowHeight: value })} /></label><label>Espaço entre linhas<EditableNumberInput value={selectedTableStyle.rowGap} min={0} max={100} onCommit={(value) => patchTableStyle({ rowGap: value })} /></label><label>Gap entre células<EditableNumberInput value={selectedTableStyle.cellGap} min={0} max={100} onCommit={(value) => patchTableStyle({ cellGap: value })} /></label><label>Altura da legenda<EditableNumberInput value={selectedTableStyle.headerHeight} min={20} max={150} onCommit={(value) => patchTableStyle({ headerHeight: value })} /></label></div><label className="post-artworks-check"><input type="checkbox" checked={selectedTableStyle.showHeader} onChange={(event) => patchTableStyle({ showHeader: event.target.checked })} /> Exibir legenda</label>{selectedTableStyle.showHeader ? <><label>Fundo da legenda<select value={selectedTableStyle.headerBackgroundType} onChange={(event) => patchTableStyle({ headerBackgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedTableStyle.headerBackgroundType === 'color' ? <label>Cor da legenda<input type="color" value={selectedTableStyle.headerBackgroundColor} onChange={(event) => patchTableStyle({ headerBackgroundColor: event.target.value })} /></label> : null}{selectedTableStyle.headerBackgroundType === 'image' ? <div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedTableStyle.headerBackgroundUrl ? 'Trocar imagem da legenda' : 'Upload da legenda'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadHeaderBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('header')}><Images size={13} /> Biblioteca</button></div> : null}<label>Cor do texto da legenda<input type="color" value={selectedTableStyle.headerColor} onChange={(event) => patchTableStyle({ headerColor: event.target.value })} /></label></> : null}</> : null}
              {selectedMvpStyle ? <><div className="post-artworks-subtitle"><strong>{selectedBlock.type === 'kills_leaders' ? 'Card de líder de abates' : 'Card MVP'}</strong><small>Um jogador por bloco, independente da transmissão.</small></div><div className="post-artworks-grid2"><label>Largura do card<EditableNumberInput value={selectedMvpStyle.cardWidth} min={180} max={1600} onCommit={(value) => patchMvpStyle({ cardWidth: value })} /></label><label>Altura do card<EditableNumberInput value={selectedMvpStyle.cardHeight} min={220} max={2000} onCommit={(value) => patchMvpStyle({ cardHeight: value })} /></label><label>Tamanho da foto<EditableNumberInput value={selectedMvpStyle.imageSize} min={40} max={1000} onCommit={(value) => patchMvpStyle({ imageSize: value })} /></label><label>Espaçamento<EditableNumberInput value={selectedMvpStyle.gap} min={0} max={120} onCommit={(value) => patchMvpStyle({ gap: value })} /></label></div><div className="post-artworks-mvp-checks"><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showPhoto} onChange={(event) => patchMvpStyle({ showPhoto: event.target.checked })} /> Foto</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showTeam} onChange={(event) => patchMvpStyle({ showTeam: event.target.checked })} /> Equipe</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showKills} onChange={(event) => patchMvpStyle({ showKills: event.target.checked })} /> Abates</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showDrops} onChange={(event) => patchMvpStyle({ showDrops: event.target.checked })} /> Quedas</label></div></> : null}
            </>}
            <div className="post-artworks-actions"><button type="button" className="post-artworks-primary" onClick={() => void saveProject()} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar template</button><button type="button" className="post-artworks-download" onClick={() => void exportArtwork()} disabled={exporting}>{exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />} {draft.slice_count > 1 ? 'Baixar carrossel' : 'Baixar imagem'}</button>{selectedBlock ? <button type="button" className="post-artworks-secondary" onClick={() => setSelectedBlockId('')}>Editar projeto</button> : null}<button type="button" className="post-artworks-danger" onClick={() => void deleteProject()} disabled={saving}><Trash2 size={14} /> Excluir arte</button></div>
          </section>

          <main className="post-artworks-preview-panel">
            <div className="post-artworks-panel-title post-artworks-preview-toolbar"><div><strong>Área de trabalho</strong><small>Arraste os blocos. Scroll dá zoom no ponto do mouse; arraste o fundo para mover a tela.</small></div><div className="post-artworks-zoom-actions"><button type="button" onClick={() => changePreviewZoom(100)}>100%</button><button type="button" onClick={() => changePreviewZoom(previewZoom - 10)}>-</button><b>{previewZoom}%</b><button type="button" onClick={() => changePreviewZoom(previewZoom + 10)}>+</button><button type="button" onClick={() => changePreviewZoom(Math.round((1 / fitPreviewScale) * 100))}>Ajustar</button></div></div>
            <div ref={previewShellRef} className="post-artworks-preview-shell" onWheel={handlePreviewWheel} onPointerDown={beginPan} onPointerMove={panPreview} onPointerUp={endPan} onPointerCancel={endPan}>
              <div className="post-artworks-preview" style={{ width: draft.width * previewScale, height: draft.height * previewScale, backgroundColor: draft.background_color, backgroundImage: draft.background_url ? `url(${JSON.stringify(draft.background_url)})` : undefined }}>
                {Array.from({ length: Math.max(0, draft.slice_count - 1) }, (_, index) => <span key={index} className={`post-artworks-slice-line ${draft.slice_direction}`} style={draft.slice_direction === 'horizontal' ? { left: draft.slice_width * (index + 1) * previewScale } : { top: draft.slice_height * (index + 1) * previewScale }} />)}
                {draft.blocks.filter((block) => block.visible && (block.type === 'table_general' || block.type === 'table_day' || block.type === 'qualified_teams' || block.type === 'booyahs_day')).map((block) => {
                  const style = normalizeTableStyle(block)
                  const blockRows = sliceRows(rowsForBlock(block, standings, dayStandings, booyahDay), block)
                  const columns = style.columns.filter((column) => column.enabled)
                  return <div key={block.id} className={`post-artworks-table-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: tableVisualWidth(style) * previewScale, height: tableVisualHeight(style, blockRows.length) * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {style.showHeader ? <div className="post-artworks-table-row header" style={{ height: style.headerHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale, backgroundColor: style.headerBackgroundType === 'color' ? style.headerBackgroundColor : 'transparent', backgroundImage: style.headerBackgroundType === 'image' && style.headerBackgroundUrl ? `url(${JSON.stringify(style.headerBackgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>{columns.map((column) => <div key={column.key} style={{ width: column.width * previewScale, background: 'transparent', color: style.headerColor, fontSize: Math.max(7, 18 * previewScale) }}>{column.label}</div>)}</div> : null}
                    {blockRows.map((row) => <div key={`${block.id}-${row.rank}`} className="post-artworks-table-row" style={{ height: style.rowHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} className={`cell align-${column.align}`} style={{ width: column.width * previewScale, color: column.color, fontSize: Math.max(7, column.fontSize * previewScale), fontWeight: column.fontWeight, backgroundColor: column.backgroundType === 'color' ? column.backgroundColor : 'transparent', backgroundImage: column.backgroundType === 'image' && column.backgroundUrl ? `url(${JSON.stringify(column.backgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>{column.key === 'logo' ? (row.logo ? <img src={row.logo} alt="" draggable={false} /> : null) : cellValue(row, column.key)}</div>)}</div>)}
                    {!blockRows.length ? <div className="post-artworks-no-data">{(block.type === 'table_day' || block.type === 'booyahs_day') && !block.source?.jogoId ? 'Selecione o jogo do bloco' : 'Sem dados nessa faixa'}</div> : null}
                  </div>
                })}
                {draft.blocks.filter((block) => block.visible && (block.type === 'mvp_general' || block.type === 'mvp_day' || block.type === 'kills_leaders')).map((block) => {
                  const style = normalizeMvpStyle(block)
                  const player = playerForBlock(block, mvpGeneral, mvpDay, killLeaders)
                  return <div key={block.id} className={`post-artworks-mvp-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: style.cardWidth * previewScale, height: style.cardHeight * previewScale, gap: style.gap * previewScale, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundType === 'image' && style.backgroundUrl ? `url(${JSON.stringify(style.backgroundUrl)})` : undefined }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {player ? <>{style.showPhoto ? <div className="post-artworks-mvp-photo" style={{ width: style.imageSize * previewScale, height: style.imageSize * previewScale, borderRadius: style.imageRadius * previewScale }}>{player.photo ? <img src={player.photo} alt="" draggable={false} /> : <span>{player.nick.slice(0, 1)}</span>}</div> : null}<strong style={{ color: style.nameColor, fontSize: Math.max(8, style.nameFontSize * previewScale), fontWeight: style.nameFontWeight }}>{player.nick}</strong>{style.showTeam && player.team ? <small style={{ color: style.teamColor, fontSize: Math.max(7, style.teamFontSize * previewScale) }}>{player.team}</small> : null}<div className="post-artworks-mvp-stats" style={{ color: style.statsColor, fontSize: Math.max(7, style.statsFontSize * previewScale) }}>{style.showKills ? <b>{player.kills}<small>ABATES</small></b> : null}{style.showDrops ? <b>{player.drops}<small>QUEDAS</small></b> : null}</div></> : <div className="post-artworks-no-data">{block.type === 'mvp_day' && !block.source?.jogoId ? 'Selecione o jogo do MVP' : 'Sem dados de MVP'}</div>}
                  </div>
                })}
                {!draft.blocks.length ? <div className="post-artworks-canvas-empty"><strong>Adicione um bloco de estatística</strong><span>Use Tabela Geral para o acumulado ou selecione um jogo nos blocos específicos.</span></div> : null}
              </div>
            </div>
          </main>

          <aside className="post-artworks-blocks-panel">
            <div className="post-artworks-panel-title"><strong>Blocos da arte</strong><small>Independentes da transmissão</small></div>
            <div className="post-artworks-add-blocks"><button type="button" className="post-artworks-add-block" onClick={addGeneralTable}><Plus size={14} /> Tabela Geral</button><button type="button" className="post-artworks-add-block" onClick={addDayTable}><Plus size={14} /> Tabela do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addQualifiedTeams}><Plus size={14} /> Classificados</button><button type="button" className="post-artworks-add-block" onClick={addBooyahsDay}><Plus size={14} /> Booyahs do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addMvpGeneral}><Plus size={14} /> MVP Geral</button><button type="button" className="post-artworks-add-block" onClick={addMvpDay}><Plus size={14} /> MVP do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addKillLeaders}><Plus size={14} /> Líderes de Abates</button></div>
            <div className="post-artworks-block-list">{draft.blocks.map((block) => <article key={block.id} className={block.id === selectedBlockId ? 'active' : ''}><button type="button" className="post-artworks-block-select" onClick={() => setSelectedBlockId(block.id)}><small>{block.type === 'table_day' ? 'TABELA DO JOGO' : block.type === 'qualified_teams' ? 'CLASSIFICADOS' : block.type === 'booyahs_day' ? 'BOOYAHS DO JOGO' : block.type === 'mvp_day' ? 'MVP DO JOGO' : block.type === 'kills_leaders' ? 'LÍDERES DE ABATES' : block.type === 'mvp_general' ? 'MVP GERAL' : 'TABELA GERAL'}</small><strong>{block.name}</strong><span>{(block.type === 'table_day' || block.type === 'booyahs_day' || block.type === 'mvp_day' || block.type === 'qualified_teams') ? `${block.source?.jogoName || 'Jogo não selecionado'} · ` : ''}{block.type === 'mvp_general' || block.type === 'mvp_day' || block.type === 'kills_leaders' ? `Top ${block.dataStart || 1}` : `Top ${block.dataStart || 1}–${block.dataEnd || 12}`}</span></button><div><button type="button" title="Duplicar e avançar a faixa" onClick={() => duplicateBlock(block)}><Copy size={13} /></button><button type="button" title="Excluir bloco" onClick={() => deleteBlock(block.id)}><Trash2 size={13} /></button></div></article>)}</div>
            {selectedBlock && selectedMvpStyle ? <div className="post-artworks-column-editor"><div className="post-artworks-subtitle"><strong>{selectedBlock.type === 'kills_leaders' ? 'Visual do líder de abates' : 'Visual do MVP'}</strong><small>Fundo, foto e textos do card.</small></div><label>Fundo<select value={selectedMvpStyle.backgroundType} onChange={(event) => patchMvpStyle({ backgroundType: event.target.value as 'color' | 'image' })}><option value="color">Cor</option><option value="image">Imagem</option></select></label>{selectedMvpStyle.backgroundType === 'color' ? <label>Cor do fundo<input type="color" value={selectedMvpStyle.backgroundColor} onChange={(event) => patchMvpStyle({ backgroundColor: event.target.value })} /></label> : null}<div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedMvpStyle.backgroundUrl ? 'Trocar fundo do card' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadMvpBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('mvp')}><Images size={13} /> Biblioteca</button></div><div className="post-artworks-grid2"><label>Nome<EditableNumberInput value={selectedMvpStyle.nameFontSize} min={8} max={160} onCommit={(value) => patchMvpStyle({ nameFontSize: value })} /></label><label>Equipe<EditableNumberInput value={selectedMvpStyle.teamFontSize} min={8} max={120} onCommit={(value) => patchMvpStyle({ teamFontSize: value })} /></label><label>Estatísticas<EditableNumberInput value={selectedMvpStyle.statsFontSize} min={8} max={140} onCommit={(value) => patchMvpStyle({ statsFontSize: value })} /></label><label>Raio da foto<EditableNumberInput value={selectedMvpStyle.imageRadius} min={0} max={500} onCommit={(value) => patchMvpStyle({ imageRadius: value })} /></label></div><div className="post-artworks-grid2"><label>Cor do nome<input type="color" value={selectedMvpStyle.nameColor} onChange={(event) => patchMvpStyle({ nameColor: event.target.value })} /></label><label>Cor da equipe<input type="color" value={selectedMvpStyle.teamColor} onChange={(event) => patchMvpStyle({ teamColor: event.target.value })} /></label><label>Cor dos números<input type="color" value={selectedMvpStyle.statsColor} onChange={(event) => patchMvpStyle({ statsColor: event.target.value })} /></label></div></div> : null}
            {selectedBlock && selectedTableStyle ? <div className="post-artworks-column-editor"><div className="post-artworks-subtitle"><strong>Colunas</strong><small>Ative, dimensione e aplique fundo por célula.</small></div><div className="post-artworks-column-tabs">{selectedTableStyle.columns.map((column) => <button type="button" key={column.key} className={selectedColumnKey === column.key ? 'active' : ''} onClick={() => setSelectedColumnKey(column.key)}>{TABLE_COLUMN_META[column.key].label || 'LOGO'}</button>)}</div>{selectedColumn ? <><label className="post-artworks-check"><input type="checkbox" checked={selectedColumn.enabled} onChange={(event) => patchColumn(selectedColumn.key, { enabled: event.target.checked })} /> Exibir coluna</label><label>Largura<EditableNumberInput value={selectedColumn.width} min={30} max={1000} onCommit={(value) => patchColumn(selectedColumn.key, { width: value })} /></label><label>Legenda<input value={selectedColumn.label} onChange={(event) => patchColumn(selectedColumn.key, { label: event.target.value })} /></label><label>Fundo<select value={selectedColumn.backgroundType} onChange={(event) => patchColumn(selectedColumn.key, { backgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedColumn.backgroundType === 'color' ? <label>Cor do fundo<input type="color" value={selectedColumn.backgroundColor} onChange={(event) => patchColumn(selectedColumn.key, { backgroundColor: event.target.value })} /></label> : null}<div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedColumn.backgroundUrl ? 'Trocar fundo das células' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadColumnBackground(selectedColumn.key, event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('column')}><Images size={13} /> Biblioteca</button></div>{selectedColumn.key !== 'logo' ? <div className="post-artworks-grid2"><label>Tamanho do texto<EditableNumberInput value={selectedColumn.fontSize} min={8} max={120} onCommit={(value) => patchColumn(selectedColumn.key, { fontSize: value })} /></label><label>Peso<EditableNumberInput value={selectedColumn.fontWeight} min={100} max={900} onCommit={(value) => patchColumn(selectedColumn.key, { fontWeight: value })} /></label><label>Cor do texto<input type="color" value={selectedColumn.color} onChange={(event) => patchColumn(selectedColumn.key, { color: event.target.value })} /></label><label>Alinhamento<select value={selectedColumn.align} onChange={(event) => patchColumn(selectedColumn.key, { align: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div> : null}</> : null}</div> : null}
          </aside>
        </> : <section className="post-artworks-welcome"><strong>Crie ou selecione uma arte</strong><span>O editor de redes sociais é independente da transmissão.</span></section>}
      </div>
      {libraryOpen ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryOpen(false) }}><section className="post-artworks-library"><header><div><small>BIBLIOTECA DO CAMPEONATO</small><strong>Imagens reutilizáveis</strong><span>Uploads de fundo, células e cards ficam disponíveis aqui para outras artes.</span></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Fechar biblioteca"><X size={18} /></button></header>{libraryError ? <div className="post-artworks-library-error">{libraryError}</div> : null}<div className="post-artworks-library-grid">{assets.map((asset) => <article key={asset.id}><button type="button" className="post-artworks-library-pick" onClick={() => applyLibraryAsset(asset)}><span className="post-artworks-library-thumb" style={{ backgroundImage: `url(${JSON.stringify(asset.url)})` }} /><b>{asset.name}</b><small>{asset.kind === 'background' ? 'Fundo de arte' : asset.kind === 'cell' ? 'Fundo de célula' : asset.kind === 'card' ? 'Fundo de card' : 'Imagem'}</small></button><button type="button" className="post-artworks-library-delete" title="Remover da biblioteca" onClick={() => void deleteLibraryAsset(asset.id)}><Trash2 size={13} /></button></article>)}{!assets.length ? <div className="post-artworks-library-empty"><Images size={28} /><strong>Nenhuma imagem salva ainda</strong><span>Envie um fundo na arte, numa coluna ou num card MVP. O arquivo entra automaticamente na biblioteca.</span></div> : null}</div></section></div> : null}
    </div>
  )
}
