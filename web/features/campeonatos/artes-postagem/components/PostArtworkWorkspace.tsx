'use client'

import { ArrowLeft, Copy, Download, ImagePlus, Images, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import JSZip from 'jszip'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import { loadPostArtworkGameBooyahs, loadPostArtworkGameKillLeaders, loadPostArtworkGameMvp, loadPostArtworkGameStandings, loadPostArtworkGeneralMvp, loadPostArtworkGeneralStandings } from '../services/post-artwork-data.service'
import type {
  PostArtworkAsset,
  PostArtworkAssetKind,
  PostArtworkBlock,
  PostArtworkBooyahRow,
  PostArtworkBooyahStyle,
  PostArtworkMvpStyle,
  PostArtworkPlayerRow,
  PostArtworkProject,
  PostArtworkQualifiedStyle,
  PostArtworkSliceDirection,
  PostArtworkTableColumnKey,
  PostArtworkTableColumnStyle,
  PostArtworkTableStyle,
  PostArtworkTeamRow,
} from '../types/artwork.types'
import '../post-artworks.css'

type PostArtworkColorUsage = { artworkId: string; artworkName: string; count: number }
type PostArtworkColorInventory = { color: string; references: number; artworks: number; uses: PostArtworkColorUsage[] }
type PostArtworkSharePreview = {
  token: string
  name: string
  source_name: string
  artworks: Array<{ name: string; width: number; height: number; slices: number }>
  assets: Array<{ name: string; url: string; kind: string }>
  colors: Array<{ color: string; references: number }>
}
type ApiPayload = { campeonato?: { id: string; nome: string }; items?: PostArtworkProject[]; item?: PostArtworkProject; assets?: PostArtworkAsset[]; asset?: PostArtworkAsset; colors?: PostArtworkColorInventory[]; jogos?: Array<any>; fases?: Array<any>; updated_artworks?: number; updated_references?: number; share?: { token: string; name: string; artworks: number; assets: number; source_name: string }; preview?: PostArtworkSharePreview; imported?: { artworks: number; assets: number; ids: string[] }; error?: string }
type GameOption = { id: string; nome: string; faseId: string; faseNome: string; grupoNome: string; numeroPartidas: number; status: string; mataMata: boolean; classificamQuantidade: number | null }
type AssetTarget = 'project' | 'column' | 'header' | 'mvp' | 'qualified' | 'booyah-media' | 'booyah-title' | 'booyah-stats'

const TABLE_COLUMN_META: Record<PostArtworkTableColumnKey, { label: string; defaultWidth: number; align: 'left' | 'center' | 'right' }> = {
  rank: { label: 'RK', defaultWidth: 74, align: 'center' },
  movement: { label: 'VAR', defaultWidth: 86, align: 'center' },
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

function PaletteColorField(props: { label: string; value: string; palette: string[]; onChange: (value: string) => void }) {
  const normalized = String(props.value || '#000000').toUpperCase()
  const inPalette = props.palette.some((color) => color.toUpperCase() === normalized)
  return <div className="post-artworks-palette-field"><span>{props.label}</span><div className="post-artworks-palette-field-swatches">{props.palette.map((color) => <button key={color} type="button" className={color.toUpperCase() === normalized ? 'active' : ''} title={`Usar ${color}`} style={{ background: color }} onClick={() => props.onChange(color)}><i>{color}</i></button>)}</div><details className={inPalette ? '' : 'is-custom'}><summary>{inPalette ? 'Usar cor livre' : `Cor fora da paleta: ${normalized}`}</summary><label>Cor livre<input type="color" value={normalized} onChange={(event) => props.onChange(event.target.value.toUpperCase())} /></label><small>Use apenas quando a cor realmente precisar ser uma exceção.</small></details></div>
}

function defaultColumn(key: PostArtworkTableColumnKey): PostArtworkTableColumnStyle {
  const meta = TABLE_COLUMN_META[key]
  return {
    key,
    label: meta.label,
    enabled: key !== 'movement',
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
    headerFontSize: 18,
    headerFontWeight: 800,
    headerFontFamily: 'Arial',
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
    headerFontSize: Math.max(8, Math.min(120, Number(raw.headerFontSize) || 18)),
    headerFontWeight: Math.max(100, Math.min(900, Number(raw.headerFontWeight) || 800)),
    headerFontFamily: String(raw.headerFontFamily || 'Arial'),
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

function defaultQualifiedStyle(): PostArtworkQualifiedStyle {
  return {
    cardWidth: 170,
    cardHeight: 150,
    columns: 6,
    gap: 8,
    sectionGap: 34,
    eliminatedOffsetX: 0,
    eliminatedOffsetY: 0,
    backgroundType: 'color',
    backgroundColor: '#8fce00',
    backgroundUrl: null,
    logoScale: 0.82,
    showTitles: true,
    qualifiedTitle: 'CLASSIFICADOS',
    eliminatedTitle: 'ELIMINADOS',
    titleColor: '#4c8f00',
    titleFontSize: 34,
    titleFontWeight: 900,
  }
}

function normalizeQualifiedStyle(block: PostArtworkBlock): PostArtworkQualifiedStyle {
  const raw = (block.style || {}) as Partial<PostArtworkQualifiedStyle>
  return {
    ...defaultQualifiedStyle(),
    ...raw,
    columns: Math.max(1, Math.min(12, Number(raw.columns) || 6)),
    logoScale: Math.max(.1, Math.min(1, Number(raw.logoScale) || .82)),
  }
}

function qualifiedVisualWidth(style: PostArtworkQualifiedStyle) {
  return style.columns * style.cardWidth + Math.max(0, style.columns - 1) * style.gap
}

function qualifiedGridHeight(style: PostArtworkQualifiedStyle, count: number) {
  if (!count) return 0
  const rows = Math.ceil(count / style.columns)
  return rows * style.cardHeight + Math.max(0, rows - 1) * style.gap
}

function qualifiedVisualHeight(style: PostArtworkQualifiedStyle, qualifiedCount: number, eliminatedCount: number) {
  const titleHeight = style.showTitles ? style.titleFontSize + 12 : 0
  const qualifiedHeight = qualifiedGridHeight(style, qualifiedCount)
  const eliminatedHeight = qualifiedGridHeight(style, eliminatedCount)
  return titleHeight + qualifiedHeight + style.sectionGap + style.eliminatedOffsetY + titleHeight + eliminatedHeight
}

function createQualifiedTeamsBlock(index: number, game?: GameOption): PostArtworkBlock {
  const legacyTableStyle = tableStyleWithColumns(['rank', 'logo', 'name', 'points'])
  const style = { ...legacyTableStyle, ...defaultQualifiedStyle() }
  const limit = game?.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0
  const qualifiedStyle = normalizeQualifiedStyle({ id: '', type: 'qualified_teams', name: '', x: 0, y: 0, width: 0, visible: true, style: style as unknown as Record<string, unknown> })
  return { id: uid('qualified-teams'), type: 'qualified_teams', name: `Classificados ${index + 1}`, x: 60, y: 220, width: qualifiedVisualWidth(qualifiedStyle), visible: true, dataStart: 1, dataEnd: limit, source: game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function defaultBooyahStyle(): PostArtworkBooyahStyle {
  return {
    totalWidth: 980,
    cardHeight: 250,
    gap: 12,
    backgroundColor: '#15171C',
    accentColor: '#8FCE00',
    textColor: '#FFFFFF',
    logoScale: .42,
    teamFontSize: 24,
    mapFontSize: 18,
    statsFontSize: 20,
    mediaBackgroundUrl: null,
    titleBackgroundUrl: null,
    statsBackgroundUrl: null,
  }
}

function normalizeBooyahStyle(block: PostArtworkBlock): PostArtworkBooyahStyle {
  const raw = (block.style || {}) as Partial<PostArtworkBooyahStyle>
  return { ...defaultBooyahStyle(), ...raw, totalWidth: Math.max(180, Number(raw.totalWidth) || 980), cardHeight: Math.max(100, Number(raw.cardHeight) || 250), gap: Math.max(0, Number(raw.gap) || 0), logoScale: Math.max(.15, Math.min(.8, Number(raw.logoScale) || .42)) }
}

function createBooyahsDayBlock(index: number, game?: GameOption): PostArtworkBlock {
  const style = defaultBooyahStyle()
  return { id: uid('booyahs-day'), type: 'booyahs_day', name: `Booyahs do Jogo ${index + 1}`, x: 60, y: 220, width: style.totalWidth, visible: true, dataStart: 1, dataEnd: 12, source: game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function booyahCardWidth(style: PostArtworkBooyahStyle, count: number) {
  if (count <= 0) return style.totalWidth
  return Math.max(70, (style.totalWidth - Math.max(0, count - 1) * style.gap) / count)
}

function defaultMvpStyle(): PostArtworkMvpStyle {
  return {
    layoutMode: 'card_table',
    cardWidth: 420, cardHeight: 560, backgroundType: 'color', backgroundColor: '#15171c', backgroundUrl: null,
    imageSize: 260, imageRadius: 18, nameColor: '#ffffff', nameFontSize: 38, nameFontWeight: 900,
    teamColor: '#c8cbd2', teamFontSize: 20, statsColor: '#ffffff', statsFontSize: 24,
    showPhoto: true, showTeam: true, showDrops: true, showKills: true, gap: 16,
    tableWidth: 640, tableRowHeight: 58, tableRowGap: 5, tableRankWidth: 58, tableTeamWidth: 170,
    tableBackgroundType: 'color', tableBackgroundColor: '#15171c', tableBackgroundUrl: null, tableTextColor: '#ffffff', tableFontSize: 20,
  }
}

function normalizeMvpStyle(block: PostArtworkBlock): PostArtworkMvpStyle {
  return { ...defaultMvpStyle(), ...((block.style || {}) as Partial<PostArtworkMvpStyle>) }
}

function createMvpBlock(type: 'mvp_general' | 'mvp_day', index: number, game?: GameOption): PostArtworkBlock {
  const style = defaultMvpStyle()
  return { id: uid(type === 'mvp_day' ? 'mvp-day' : 'mvp-general'), type, name: `${type === 'mvp_day' ? 'MVP do Jogo' : 'MVP Geral'} ${index + 1}`, x: 60, y: 160, width: style.cardWidth, visible: true, dataStart: 1, dataEnd: type === 'mvp_general' ? 10 : 1, source: type === 'mvp_day' && game ? { jogoId: game.id, jogoName: game.nome } : {}, style: style as unknown as Record<string, unknown> }
}

function createMvpGeneralCardBlock(index: number): PostArtworkBlock {
  const style = defaultMvpStyle()
  return { id: uid('mvp-general-card'), type: 'mvp_general_card', name: `Card MVP Top 1 ${index + 1}`, x: 60, y: 160, width: style.cardWidth, visible: true, dataStart: 1, dataEnd: 1, style: style as unknown as Record<string, unknown> }
}

function createMvpGeneralTableBlock(index: number): PostArtworkBlock {
  const style = tableStyleWithColumns(['rank', 'name', 'drops', 'kills', 'points'])
  style.columns = style.columns.map((column) => column.key === 'name' ? { ...column, label: 'JOGADOR' } : column.key === 'drops' ? { ...column, label: 'QD' } : column.key === 'kills' ? { ...column, label: 'ABT' } : column.key === 'points' ? { ...column, label: 'K.D' } : column)
  return { id: uid('mvp-general-table'), type: 'mvp_general_table', name: `Tabela MVP ${index + 1}`, x: 520, y: 160, width: tableVisualWidth(style), visible: true, dataStart: 2, dataEnd: 10, style: style as unknown as Record<string, unknown> }
}

function mvpTableCellValue(row: PostArtworkPlayerRow, key: PostArtworkTableColumnKey) {
  if (key === 'rank') return String(row.rank)
  if (key === 'name') return row.nick
  if (key === 'drops') return String(row.drops)
  if (key === 'kills') return String(row.kills)
  if (key === 'points') return row.drops > 0 ? (row.kills / row.drops).toFixed(1).replace('.', ',') : String(row.kills)
  return ''
}

function playerForBlock(block: PostArtworkBlock, general: PostArtworkPlayerRow[], day: Record<string, PostArtworkPlayerRow[]>, killLeaders: Record<string, PostArtworkPlayerRow[]> = {}) {
  const rows = block.type === 'mvp_day' ? day[block.source?.jogoId || ''] || [] : block.type === 'kills_leaders' ? killLeaders[block.source?.jogoId || ''] || [] : general
  return rows[Math.max(0, (block.dataStart || 1) - 1)] || null
}

function playerRowsForBlock(block: PostArtworkBlock, general: PostArtworkPlayerRow[], day: Record<string, PostArtworkPlayerRow[]>, killLeaders: Record<string, PostArtworkPlayerRow[]> = {}) {
  const rows = block.type === 'mvp_day' ? day[block.source?.jogoId || ''] || [] : block.type === 'kills_leaders' ? killLeaders[block.source?.jogoId || ''] || [] : general
  const start = Math.max(0, (block.dataStart || 1) - 1)
  const end = Math.max(start + 1, block.dataEnd || block.dataStart || 1)
  return rows.slice(start, end)
}

function mvpVisualWidth(block: PostArtworkBlock, style: PostArtworkMvpStyle) {
  if (block.type !== 'mvp_general') return style.cardWidth
  if (style.layoutMode === 'table_only') return style.tableWidth
  return style.cardWidth + (Math.max(0, (block.dataEnd || 10) - (block.dataStart || 1)) > 0 ? style.gap + style.tableWidth : 0)
}

function mvpVisualHeight(block: PostArtworkBlock, style: PostArtworkMvpStyle) {
  if (block.type !== 'mvp_general') return style.cardHeight
  const count = Math.max(1, (block.dataEnd || 10) - (block.dataStart || 1) + 1)
  const tableCount = style.layoutMode === 'table_only' ? count : Math.max(0, count - 1)
  const tableHeight = tableCount * style.tableRowHeight + Math.max(0, tableCount - 1) * style.tableRowGap
  return style.layoutMode === 'table_only' ? tableHeight : Math.max(style.cardHeight, tableHeight)
}

function gameOptionsFromApi(jogos: ApiPayload['jogos'], fases: ApiPayload['fases'] = []): GameOption[] {
  const faseNames = new Map((fases || []).map((fase: any) => [String(fase.id || ''), String(fase.nome || 'Fase')]))
  return (jogos || []).map((game: any) => ({
    id: String(game.id || ''),
    nome: String(game.nome || 'Jogo'),
    faseId: String(game.fase_id || ''),
    faseNome: faseNames.get(String(game.fase_id || '')) || 'Fase',
    grupoNome: Array.isArray(game.grupos) ? game.grupos.map((rel: any) => String(rel?.campeonato_grupos?.nome || rel?.nome || '')).filter(Boolean).join(' + ') : '',
    numeroPartidas: Number(game.numero_partidas || 0),
    status: String(game.status || ''),
    mataMata: Boolean(game.mata_mata),
    classificamQuantidade: game.classificam_quantidade == null ? null : Number(game.classificam_quantidade),
  })).filter((game) => game.id)
}

function resolveBlockForGame(block: PostArtworkBlock, game?: GameOption | null): PostArtworkBlock {
  if (!game || !(block.type === 'table_day' || block.type === 'qualified_teams' || block.type === 'booyahs_day' || block.type === 'mvp_day' || block.type === 'kills_leaders')) return { ...block, style: structuredClone(block.style || {}) }
  return {
    ...block,
    source: { jogoId: game.id, jogoName: game.nome },
    ...(block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0 } : {}),
    style: structuredClone(block.style || {}),
  }
}

function resolveProjectForGame(project: PostArtworkProject, game?: GameOption | null): PostArtworkProject {
  return { ...cloneDraft(project), blocks: project.blocks.map((block) => resolveBlockForGame(block, game)) }
}

const GAME_DATA_BLOCK_TYPES = new Set<PostArtworkBlock['type']>(['table_day', 'qualified_teams', 'booyahs_day', 'mvp_day', 'kills_leaders'])

function projectRequiresGame(project?: PostArtworkProject | null) {
  return Boolean(project?.blocks.some((block) => GAME_DATA_BLOCK_TYPES.has(block.type)))
}

function stripDynamicGameSources(project: PostArtworkProject): PostArtworkProject {
  return {
    ...cloneDraft(project),
    blocks: project.blocks.map((block) => GAME_DATA_BLOCK_TYPES.has(block.type)
      ? { ...block, source: {}, ...(block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: 0 } : {}) }
      : { ...block, style: structuredClone(block.style || {}) }),
  }
}

const PROJECT_SETTINGS_BLOCK_ID = '__post_artwork_project_settings__'
const DEFAULT_PROJECT_PALETTE = ['#8FCE00', '#15171C', '#FFFFFF']

function projectPalette(project?: PostArtworkProject | null): string[] {
  if (!project) return DEFAULT_PROJECT_PALETTE
  const settings = project.blocks.find((block) => block.id === PROJECT_SETTINGS_BLOCK_ID)
  const raw = Array.isArray((settings?.style as any)?.palette) ? (settings?.style as any).palette : []
  const colors = raw.map((value: unknown) => String(value || '').toUpperCase()).filter((value: string) => /^#[0-9A-F]{6}$/.test(value))
  return colors.length ? colors.slice(0, 6) : DEFAULT_PROJECT_PALETTE
}

function withProjectPalette(project: PostArtworkProject, colors: string[]): PostArtworkProject {
  const palette = [...new Set(colors.map((value) => value.toUpperCase()).filter((value) => /^#[0-9A-F]{6}$/.test(value)))].slice(0, 6)
  const settings: PostArtworkBlock = {
    id: PROJECT_SETTINGS_BLOCK_ID,
    type: 'text',
    name: 'Configurações do projeto',
    x: 0,
    y: 0,
    width: 0,
    visible: false,
    style: { palette },
  }
  return { ...project, blocks: [...project.blocks.filter((block) => block.id !== PROJECT_SETTINGS_BLOCK_ID), settings] }
}

function userBlocks(project?: PostArtworkProject | null) {
  return (project?.blocks || []).filter((block) => block.id !== PROJECT_SETTINGS_BLOCK_ID)
}

function replaceColorDeep(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') return value.toUpperCase() === from.toUpperCase() ? to : value
  if (Array.isArray(value)) return value.map((entry) => replaceColorDeep(entry, from, to))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, replaceColorDeep(entry, from, to)]))
  return value
}

function replaceProjectColor(project: PostArtworkProject, from: string, to: string) {
  const palette = projectPalette(project).map((color) => color.toUpperCase() === from.toUpperCase() ? to.toUpperCase() : color)
  const replaced = replaceColorDeep(project, from, to) as PostArtworkProject
  return withProjectPalette(replaced, palette)
}

function generationCaptionForGame(campeonatoNome: string, game?: GameOption | null) {
  if (!game) return ''
  const parts = [campeonatoNome, game.faseNome, game.nome, game.grupoNome].map((value) => String(value || '').trim()).filter(Boolean)
  return [...new Set(parts.map((value) => value.toUpperCase()))].join(' - ')
}

function rowsForBlock(block: PostArtworkBlock, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>) {
  if (block.type === 'table_day' || block.type === 'qualified_teams') return dayRows[block.source?.jogoId || ''] || []
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

function movementLabel(value: number) {
  if (value > 0) return `▲ ${value}`
  if (value < 0) return `▼ ${Math.abs(value)}`
  return '—'
}

function movementClass(value: number) {
  return value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-same'
}

function cellValue(row: PostArtworkTeamRow, key: PostArtworkTableColumnKey) {
  if (key === 'rank') return String(row.rank)
  if (key === 'movement') return movementLabel(row.movement)
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

async function drawQualifiedCard(ctx: CanvasRenderingContext2D, row: PostArtworkTeamRow, style: PostArtworkQualifiedStyle, x: number, y: number) {
  if (style.backgroundType === 'color') {
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(x, y, style.cardWidth, style.cardHeight)
  } else if (style.backgroundType === 'image' && style.backgroundUrl) {
    await drawCover(ctx, style.backgroundUrl, x, y, style.cardWidth, style.cardHeight)
  }
  if (!row.logo) return
  try {
    const logo = await loadImage(row.logo)
    const size = Math.min(style.cardWidth, style.cardHeight) * style.logoScale
    ctx.drawImage(logo, x + (style.cardWidth - size) / 2, y + (style.cardHeight - size) / 2, size, size)
  } catch {}
}

async function drawQualifiedSection(ctx: CanvasRenderingContext2D, rows: PostArtworkTeamRow[], style: PostArtworkQualifiedStyle, startX: number, startY: number, title: string) {
  let y = startY
  if (style.showTitles) {
    ctx.fillStyle = style.titleColor
    ctx.font = `${style.titleFontWeight} ${style.titleFontSize}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(title, startX, y)
    y += style.titleFontSize + 12
  }
  for (let index = 0; index < rows.length; index += 1) {
    const column = index % style.columns
    const line = Math.floor(index / style.columns)
    const x = startX + column * (style.cardWidth + style.gap)
    const cardY = y + line * (style.cardHeight + style.gap)
    await drawQualifiedCard(ctx, rows[index], style, x, cardY)
  }
  return y + qualifiedGridHeight(style, rows.length)
}

async function drawMvpTable(ctx: CanvasRenderingContext2D, rows: PostArtworkPlayerRow[], style: PostArtworkMvpStyle, x: number, y: number) {
  const killsWidth = 90
  const nickWidth = Math.max(100, style.tableWidth - style.tableRankWidth - style.tableTeamWidth - killsWidth)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowY = y + index * (style.tableRowHeight + style.tableRowGap)
    if (style.tableBackgroundType === 'color') {
      ctx.fillStyle = style.tableBackgroundColor
      ctx.fillRect(x, rowY, style.tableWidth, style.tableRowHeight)
    } else if (style.tableBackgroundType === 'image' && style.tableBackgroundUrl) {
      await drawCover(ctx, style.tableBackgroundUrl, x, rowY, style.tableWidth, style.tableRowHeight)
    }
    ctx.fillStyle = style.tableTextColor
    ctx.font = `800 ${style.tableFontSize}px Arial`
    ctx.textBaseline = 'middle'
    const cy = rowY + style.tableRowHeight / 2
    ctx.textAlign = 'center'
    ctx.fillText(String(row.rank), x + style.tableRankWidth / 2, cy, style.tableRankWidth - 8)
    ctx.textAlign = 'left'
    ctx.fillText(row.nick, x + style.tableRankWidth + 10, cy, nickWidth - 16)
    ctx.fillText(row.team || '', x + style.tableRankWidth + nickWidth + 10, cy, style.tableTeamWidth - 16)
    ctx.textAlign = 'center'
    ctx.fillText(String(row.kills), x + style.tableWidth - killsWidth / 2, cy, killsWidth - 8)
  }
}

async function drawMvpCard(ctx: CanvasRenderingContext2D, player: PostArtworkPlayerRow | null, style: PostArtworkMvpStyle, x: number, startY: number) {
  let y = startY
  if (style.backgroundType === 'color') {
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(x, y, style.cardWidth, style.cardHeight)
  } else if (style.backgroundType === 'image' && style.backgroundUrl) {
    await drawCover(ctx, style.backgroundUrl, x, y, style.cardWidth, style.cardHeight)
  }
  if (!player) return
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

const MAX_EXPORT_RENDER_PIXELS = 40_000_000

function resolveExportRenderScale(width: number, height: number) {
  const basePixels = Math.max(1, width * height)
  const safeScale = Math.sqrt(MAX_EXPORT_RENDER_PIXELS / basePixels)
  return Math.max(1, Math.min(2, safeScale))
}

async function renderArtworkCanvas(project: PostArtworkProject, generalRows: PostArtworkTeamRow[], dayRows: Record<string, PostArtworkTeamRow[]>, mvpGeneralRows: PostArtworkPlayerRow[], mvpDayRows: Record<string, PostArtworkPlayerRow[]>, booyahRows: Record<string, PostArtworkBooyahRow[]> = {}, killLeaderRows: Record<string, PostArtworkPlayerRow[]> = {}, renderScale = 1, exportCaption = '', exportCaptionColor = '#FFFFFF') {
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

  for (const block of project.blocks.filter((item) => item.visible && item.type === 'qualified_teams')) {
    const style = normalizeQualifiedStyle(block)
    const rows = rowsForBlock(block, generalRows, dayRows)
    const limit = Math.max(0, Number(block.dataEnd || 0))
    const qualifiedRows = limit > 0 ? rows.slice(0, limit) : []
    const eliminatedRows = limit > 0 ? rows.slice(limit) : []
    let y = block.y
    y = await drawQualifiedSection(ctx, qualifiedRows, style, block.x, y, style.qualifiedTitle)
    y += style.sectionGap + style.eliminatedOffsetY
    await drawQualifiedSection(ctx, eliminatedRows, style, block.x + style.eliminatedOffsetX, y, style.eliminatedTitle)
    block.width = qualifiedVisualWidth(style)
  }

  for (const block of project.blocks.filter((item) => item.visible && (item.type === 'table_general' || item.type === 'table_day'))) {
    const style = normalizeTableStyle(block)
    const blockRows = sliceRows(rowsForBlock(block, generalRows, dayRows), block)
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
        ctx.font = `${style.headerFontWeight} ${style.headerFontSize}px ${style.headerFontFamily}`
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
          ctx.fillStyle = column.key === 'movement' ? (row.movement > 0 ? '#55E59A' : row.movement < 0 ? '#FF7777' : '#D9B84C') : column.color
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

  for (const block of project.blocks.filter((item) => item.visible && item.type === 'booyahs_day')) {
    const style = normalizeBooyahStyle(block)
    const rows = (booyahRows[block.source?.jogoId || ''] || []).slice(Math.max(0, (block.dataStart || 1) - 1), Math.max(1, block.dataEnd || 12))
    const cardWidth = booyahCardWidth(style, rows.length)
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const x = block.x + index * (cardWidth + style.gap)
      const y = block.y
      const mediaHeight = style.cardHeight * .55
      const titleHeight = style.cardHeight * .2
      const statsHeight = style.cardHeight - mediaHeight - titleHeight
      ctx.fillStyle = style.backgroundColor
      ctx.fillRect(x, y, cardWidth, style.cardHeight)
      const mediaSource = style.mediaBackgroundUrl || row.mapImage
      if (mediaSource) {
        await drawCover(ctx, mediaSource, x, y, cardWidth, mediaHeight)
        ctx.fillStyle = 'rgba(0,0,0,.34)'
        ctx.fillRect(x, y, cardWidth, mediaHeight)
      }
      if (row.logo) {
        try {
          const logo = await loadImage(row.logo)
          const logoSize = Math.min(cardWidth * style.logoScale, style.cardHeight * .34)
          ctx.drawImage(logo, x + (cardWidth - logoSize) / 2, y + 10, logoSize, logoSize)
        } catch {}
      }
      const titleY = y + mediaHeight
      if (style.titleBackgroundUrl) await drawCover(ctx, style.titleBackgroundUrl, x, titleY, cardWidth, titleHeight)
      else {
        ctx.fillStyle = style.accentColor
        ctx.fillRect(x, titleY, cardWidth, titleHeight)
      }
      const statsY = titleY + titleHeight
      if (style.statsBackgroundUrl) await drawCover(ctx, style.statsBackgroundUrl, x, statsY, cardWidth, statsHeight)
      else {
        ctx.fillStyle = style.backgroundColor
        ctx.fillRect(x, statsY, cardWidth, statsHeight)
      }
      ctx.fillStyle = style.textColor
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = `900 ${style.teamFontSize}px Arial`
      ctx.fillText(row.mapName || 'Sem mapa', x + cardWidth / 2, titleY + titleHeight / 2, Math.max(30, cardWidth - 14))
      ctx.font = `900 ${style.statsFontSize}px Arial`
      ctx.textAlign = 'left'; ctx.fillText(`${row.points} PTS`, x + 10, statsY + statsHeight / 2, Math.max(20, cardWidth * .48 - 12))
      ctx.textAlign = 'right'; ctx.fillText(`${row.kills} ABT`, x + cardWidth - 10, statsY + statsHeight / 2, Math.max(20, cardWidth * .48 - 12))
    }
    block.width = style.totalWidth
  }

  for (const block of project.blocks.filter((item) => item.visible && (item.type === 'mvp_general' || item.type === 'mvp_general_card' || item.type === 'mvp_day' || item.type === 'kills_leaders'))) {
    const style = normalizeMvpStyle(block)
    const rows = playerRowsForBlock(block, mvpGeneralRows, mvpDayRows, killLeaderRows)
    if (block.type === 'mvp_general') {
      if (style.layoutMode === 'table_only') {
        await drawMvpTable(ctx, rows, style, block.x, block.y)
      } else {
        await drawMvpCard(ctx, rows[0] || null, style, block.x, block.y)
        if (rows.length > 1) await drawMvpTable(ctx, rows.slice(1), style, block.x + style.cardWidth + style.gap, block.y)
      }
      block.width = mvpVisualWidth(block, style)
      continue
    }
    const player = playerForBlock(block, mvpGeneralRows, mvpDayRows, killLeaderRows)
    await drawMvpCard(ctx, player, style, block.x, block.y)
    block.width = style.cardWidth
  }
  if (exportCaption.trim()) {
    const fontSize = Math.max(18, Math.round(project.width * 0.022))
    ctx.fillStyle = exportCaptionColor
    ctx.font = `900 ${fontSize}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(exportCaption.trim(), project.width * 0.03, project.height * 0.075, project.width * 0.94)
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

type PostArtworkAssetUsage = { artworkId: string; artworkName: string; location: string }

function collectAssetUsages(items: PostArtworkProject[], url: string): PostArtworkAssetUsage[] {
  const usages: PostArtworkAssetUsage[] = []
  const scan = (value: unknown, path: string[], item: PostArtworkProject, blockName?: string) => {
    if (typeof value === 'string') {
      if (value !== url) return
      const joined = path.join('.')
      let location = blockName || 'Bloco'
      if (joined === 'background_url') location = 'Fundo do projeto'
      else if (joined.endsWith('headerBackgroundUrl')) location = `${blockName || 'Tabela'} · Fundo da legenda`
      else if (joined.includes('.columns.') && joined.endsWith('.backgroundUrl')) {
        const columnIndex = Number(path[path.indexOf('columns') + 1])
        const block = item.blocks.find((candidate) => candidate.name === blockName)
        const rawColumns = Array.isArray((block?.style as any)?.columns) ? (block?.style as any).columns : []
        const label = rawColumns[columnIndex]?.label || rawColumns[columnIndex]?.key || 'coluna'
        location = `${blockName || 'Tabela'} · Coluna ${label}`
      } else if (joined.endsWith('backgroundUrl')) location = `${blockName || 'Bloco'} · Fundo`
      usages.push({ artworkId: item.id, artworkName: item.name, location })
      return
    }
    if (Array.isArray(value)) { value.forEach((entry, index) => scan(entry, [...path, String(index)], item, blockName)); return }
    if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value as Record<string, unknown>)) scan(entry, [...path, key], item, blockName)
  }
  for (const item of items) {
    scan(item.background_url, ['background_url'], item)
    for (const block of item.blocks) scan(block.style || {}, ['blocks', block.id, 'style'], item, block.name)
  }
  return usages
}

export function PostArtworkWorkspace({ campeonatoId, mode = 'edit', initialArtworkId }: { campeonatoId: string; mode?: 'edit' | 'generate' | 'manage' | 'library'; initialArtworkId?: string }) {
  const [items, setItems] = useState<PostArtworkProject[]>([])
  const [activeId, setActiveId] = useState('')
  const [draft, setDraft] = useState<PostArtworkProject | null>(null)
  const [campeonatoNome, setCampeonatoNome] = useState('Campeonato')
  const [standings, setStandings] = useState<PostArtworkTeamRow[]>([])
  const [games, setGames] = useState<GameOption[]>([])
  const [generationPhaseId, setGenerationPhaseId] = useState('')
  const [generationGameId, setGenerationGameId] = useState('')
  const [generationCaption, setGenerationCaption] = useState('')
  const [generationCaptionColor, setGenerationCaptionColor] = useState('#FFFFFF')
  const [editorReferenceGameId, setEditorReferenceGameId] = useState('')
  const [artworkSearch, setArtworkSearch] = useState('')
  const [artworkFilter, setArtworkFilter] = useState<'all' | 'tables' | 'mvp' | 'qualified' | 'other'>('all')
  const [quickPreviewUrl, setQuickPreviewUrl] = useState('')
  const [quickPreviewLoading, setQuickPreviewLoading] = useState(false)
  const [dayStandings, setDayStandings] = useState<Record<string, PostArtworkTeamRow[]>>({})
  const [mvpGeneral, setMvpGeneral] = useState<PostArtworkPlayerRow[]>([])
  const [mvpDay, setMvpDay] = useState<Record<string, PostArtworkPlayerRow[]>>({})
  const [booyahDay, setBooyahDay] = useState<Record<string, PostArtworkBooyahRow[]>>({})
  const [killLeaders, setKillLeaders] = useState<Record<string, PostArtworkPlayerRow[]>>({})
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
  const [libraryKindFilter, setLibraryKindFilter] = useState<'all' | PostArtworkAssetKind>('all')
  const [libraryUploadKind, setLibraryUploadKind] = useState<PostArtworkAssetKind>('background')
  const [usageAssetId, setUsageAssetId] = useState('')
  const [replacingAssetId, setReplacingAssetId] = useState('')
  const [uploadingLibrary, setUploadingLibrary] = useState(false)
  const [librarySection, setLibrarySection] = useState<'images' | 'colors'>('images')
  const [colorInventory, setColorInventory] = useState<PostArtworkColorInventory[]>([])
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({})
  const [usageColor, setUsageColor] = useState('')
  const [replacingColor, setReplacingColor] = useState('')
  const [shareModal, setShareModal] = useState<'share' | 'import' | ''>('')
  const [shareScope, setShareScope] = useState<'all' | 'selected'>('all')
  const [shareIncludeAssets, setShareIncludeAssets] = useState(true)
  const [shareToken, setShareToken] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [importPreview, setImportPreview] = useState<PostArtworkSharePreview | null>(null)
  const [importComplete, setImportComplete] = useState<{ artworks: number; assets: number } | null>(null)
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

  async function reloadColors() {
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/colors`)
      const colors = body.colors || []
      setColorInventory(colors)
      setColorDrafts((current) => Object.fromEntries(colors.map((entry) => [entry.color, current[entry.color] || entry.color])))
    } catch (e: any) {
      setLibraryError(e?.message || 'Não foi possível carregar as cores usadas nas artes.')
    }
  }

  async function replaceLibraryColor(color: PostArtworkColorInventory) {
    const nextColor = String(colorDrafts[color.color] || color.color).trim().toUpperCase()
    if (!/^#[0-9A-F]{6}$/.test(nextColor)) { setLibraryError('Escolha uma cor válida no formato #RRGGBB.'); return }
    if (nextColor === color.color.toUpperCase()) return
    if (!window.confirm(`Substituir ${color.color} por ${nextColor} em ${color.references} uso(s) de ${color.artworks} arte(s)?`)) return
    setReplacingColor(color.color); setLibraryError(''); setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/colors`, { method: 'PUT', body: JSON.stringify({ from: color.color, to: nextColor }) })
      await reload(activeId)
      await reloadColors()
      setUsageColor('')
      setFeedback(`Cor substituída em ${body.updated_references || 0} uso(s) de ${body.updated_artworks || 0} arte(s).`)
    } catch (e: any) { setLibraryError(e?.message || 'Não foi possível substituir esta cor.') }
    finally { setReplacingColor('') }
  }

  async function rememberAsset(url: string, name: string, kind: PostArtworkAssetKind) {
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets`, { method: 'POST', body: JSON.stringify({ url, name, kind }) })
      if (body.asset) setAssets((current) => [body.asset!, ...current.filter((item) => item.id !== body.asset!.id)])
      return body.asset || null
    } catch (e: any) {
      setLibraryError(e?.message || 'Imagem enviada, mas não foi possível salvá-la na biblioteca.')
      return null
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
    if (assetTarget === 'qualified' && selectedQualifiedStyle) patchQualifiedStyle({ backgroundType: 'image', backgroundUrl: asset.url })
    if (assetTarget === 'booyah-media' && selectedBooyahStyle) patchBooyahStyle({ mediaBackgroundUrl: asset.url })
    if (assetTarget === 'booyah-title' && selectedBooyahStyle) patchBooyahStyle({ titleBackgroundUrl: asset.url })
    if (assetTarget === 'booyah-stats' && selectedBooyahStyle) patchBooyahStyle({ statsBackgroundUrl: asset.url })
    setLibraryOpen(false)
  }

  async function deleteLibraryAsset(assetId: string) {
    try {
      await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' })
      setAssets((current) => current.filter((item) => item.id !== assetId))
    } catch (e: any) { setLibraryError(e?.message || 'Não foi possível remover a imagem da biblioteca.') }
  }

  async function uploadLibraryAsset(file?: File | null) {
    if (!file) return
    setUploadingLibrary(true); setLibraryError(''); setFeedback('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      const asset = await rememberAsset(url, file.name || 'Imagem', libraryUploadKind)
      if (asset) setFeedback('Imagem adicionada à biblioteca.')
    } catch (e: any) { setLibraryError(e?.message || 'Não foi possível enviar a imagem para a biblioteca.') }
    finally { setUploadingLibrary(false) }
  }

  async function replaceLibraryAsset(asset: PostArtworkAsset, file?: File | null) {
    if (!file) return
    const uses = collectAssetUsages(items, asset.url)
    const message = uses.length ? `Substituir “${asset.name}” em ${uses.length} uso(s) de ${new Set(uses.map((use) => use.artworkId)).size} arte(s)?` : `Substituir “${asset.name}” na biblioteca?`
    if (!window.confirm(message)) return
    setReplacingAssetId(asset.id); setLibraryError(''); setFeedback('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/assets/${encodeURIComponent(asset.id)}`, { method: 'PUT', body: JSON.stringify({ url, name: file.name || asset.name }) })
      if (body.asset) setAssets((current) => current.map((currentAsset) => currentAsset.id === asset.id ? body.asset! : currentAsset))
      await reload(activeId)
      setFeedback(`Imagem substituída em ${body.updated_references || 0} uso(s) de ${body.updated_artworks || 0} arte(s).`)
    } catch (e: any) { setLibraryError(e?.message || 'Não foi possível substituir esta imagem.') }
    finally { setReplacingAssetId('') }
  }

  async function downloadLibraryAsset(asset: PostArtworkAsset) {
    setLibraryError('')
    try {
      const response = await fetch(asset.url)
      if (!response.ok) throw new Error('download')
      downloadBlob(await response.blob(), asset.name || 'imagem')
    } catch {
      window.open(asset.url, '_blank', 'noopener,noreferrer')
    }
  }

  async function reload(preferredId?: string) {
    setLoading(true)
    setError('')
    try {
      const [body, ranking, mvpRanking, gamesPayload, structurePayload] = await Promise.all([
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`),
        loadPostArtworkGeneralStandings(campeonatoId).catch(() => []),
        loadPostArtworkGeneralMvp(campeonatoId).catch(() => []),
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/jogos`).catch(() => ({} as ApiPayload)),
        authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estrutura`).catch(() => ({} as ApiPayload)),
      ])
      const next = body.items || []
      setItems(next)
      setStandings(ranking)
      setMvpGeneral(mvpRanking)
      const nextGames = gameOptionsFromApi(gamesPayload.jogos, structurePayload.fases)
      setGames(nextGames)
      setGenerationPhaseId((current) => current || nextGames[0]?.faseId || '')
      setGenerationGameId((current) => current && nextGames.some((game) => game.id === current) ? current : '')
      setCampeonatoNome(body.campeonato?.nome || 'Campeonato')
      const nextId = preferredId || initialArtworkId || activeId || next[0]?.id || ''
      setActiveId(nextId)
      const selected = next.find((item) => item.id === nextId) || null
      setDraft(selected ? cloneDraft(selected) : null)
      setSelectedBlockId(selected?.blocks[0]?.id || '')
    } catch (e: any) {
      setError(e?.message || 'Erro ao abrir as artes para postagem.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void reload(initialArtworkId); void reloadAssets(); void reloadColors() }, [campeonatoId, initialArtworkId])

  const generationPhases = useMemo(() => {
    const seen = new Map<string, string>()
    for (const game of games) if (game.faseId && !seen.has(game.faseId)) seen.set(game.faseId, game.faseNome)
    return [...seen.entries()].map(([id, nome]) => ({ id, nome }))
  }, [games])
  const generationGames = useMemo(() => games.filter((game) => !generationPhaseId || game.faseId === generationPhaseId), [games, generationPhaseId])
  const generationGame = useMemo(() => games.find((game) => game.id === generationGameId) || null, [games, generationGameId])
  const editorReferenceGame = useMemo(() => games.find((game) => game.id === editorReferenceGameId) || null, [games, editorReferenceGameId])

  useEffect(() => {
    setGenerationCaption(generationCaptionForGame(campeonatoNome, generationGame))
  }, [campeonatoNome, generationGame])
  const renderDraft = useMemo(() => draft ? ((mode === 'generate' || mode === 'manage') ? resolveProjectForGame(draft, generationGame) : mode === 'edit' && editorReferenceGame ? resolveProjectForGame(draft, editorReferenceGame) : draft) : null, [draft, editorReferenceGame, generationGame, mode])

  const dayGameKey = useMemo(() => {
    if (!renderDraft) return ''
    return [...new Set(renderDraft.blocks.filter((block) => block.type === 'table_day' || block.type === 'qualified_teams').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [renderDraft])

  useEffect(() => {
    const ids = dayGameKey ? dayGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setDayStandings({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameStandings(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setDayStandings(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, dayGameKey])

  const booyahGameKey = useMemo(() => {
    if (!renderDraft) return ''
    return [...new Set(renderDraft.blocks.filter((block) => block.type === 'booyahs_day').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [renderDraft])

  useEffect(() => {
    const ids = booyahGameKey ? booyahGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setBooyahDay({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameBooyahs(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setBooyahDay(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, booyahGameKey])

  const mvpGameKey = useMemo(() => {
    if (!renderDraft) return ''
    return [...new Set(renderDraft.blocks.filter((block) => block.type === 'mvp_day').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [renderDraft])

  useEffect(() => {
    const ids = mvpGameKey ? mvpGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setMvpDay({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameMvp(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setMvpDay(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, mvpGameKey])

  const killLeadersGameKey = useMemo(() => {
    if (!renderDraft) return ''
    return [...new Set(renderDraft.blocks.filter((block) => block.type === 'kills_leaders').map((block) => block.source?.jogoId).filter(Boolean))].sort().join('|')
  }, [renderDraft])

  useEffect(() => {
    const ids = killLeadersGameKey ? killLeadersGameKey.split('|').filter(Boolean) : []
    if (!ids.length) { setKillLeaders({}); return }
    let active = true
    Promise.all(ids.map(async (jogoId) => [jogoId, await loadPostArtworkGameKillLeaders(campeonatoId, jogoId).catch(() => [])] as const))
      .then((entries) => { if (active) setKillLeaders(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [campeonatoId, killLeadersGameKey])

  function artworkKind(item: PostArtworkProject) {
    const types = new Set(item.blocks.map((block) => block.type))
    if (types.has('qualified_teams')) return 'qualified' as const
    if (types.has('mvp_general') || types.has('mvp_general_card') || types.has('mvp_general_table') || types.has('mvp_day') || types.has('kills_leaders')) return 'mvp' as const
    if (types.has('table_general') || types.has('table_day') || types.has('booyahs_day')) return 'tables' as const
    return 'other' as const
  }

  const managedItems = useMemo(() => {
    const search = artworkSearch.trim().toLocaleLowerCase('pt-BR')
    return items.filter((item) => {
      if (artworkFilter !== 'all' && artworkKind(item) !== artworkFilter) return false
      return !search || item.name.toLocaleLowerCase('pt-BR').includes(search)
    })
  }, [items, artworkFilter, artworkSearch])

  const filteredAssets = useMemo(() => assets.filter((asset) => libraryKindFilter === 'all' || asset.kind === libraryKindFilter), [assets, libraryKindFilter])
  const selectedUsageAsset = useMemo(() => assets.find((asset) => asset.id === usageAssetId) || null, [assets, usageAssetId])
  const selectedAssetUsages = useMemo(() => selectedUsageAsset ? collectAssetUsages(items, selectedUsageAsset.url) : [], [items, selectedUsageAsset])
  const selectedUsageColor = useMemo(() => colorInventory.find((entry) => entry.color === usageColor) || null, [colorInventory, usageColor])

  function closeShareModal() {
    setShareModal('')
    setShareBusy(false)
    setImportPreview(null)
    setImportComplete(null)
  }

  async function copyShareToken() {
    if (!shareToken) return
    try {
      await navigator.clipboard.writeText(shareToken)
      setFeedback('Token copiado. Envie este código para quem vai importar o modelo.')
    } catch {
      window.prompt('Copie o token de compartilhamento', shareToken)
    }
  }

  async function generateShareToken() {
    if (!items.length) return
    const artworkIds = shareScope === 'selected' && draft ? [draft.id] : items.map((item) => item.id)
    setShareBusy(true); setError(''); setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/share`, {
        method: 'POST',
        body: JSON.stringify({ artwork_ids: artworkIds, include_assets: shareIncludeAssets, name: `${campeonatoNome} · Artes` }),
      })
      if (!body.share?.token) throw new Error('O servidor não retornou o token.')
      setShareToken(body.share.token)
      setFeedback(`Pacote criado com ${body.share.artworks} arte(s) e ${body.share.assets} imagem(ns).`)
    } catch (e: any) { setError(e?.message || 'Erro ao gerar token de compartilhamento.') }
    finally { setShareBusy(false) }
  }

  async function previewImportToken() {
    const token = shareToken.trim()
    if (!token) { setError('Cole o token de compartilhamento para continuar.'); return }
    setShareBusy(true); setError(''); setFeedback(''); setImportComplete(null)
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/import`, {
        method: 'POST',
        body: JSON.stringify({ token, preview: true }),
      })
      if (!body.preview) throw new Error('Não foi possível visualizar este pacote.')
      setImportPreview(body.preview)
    } catch (e: any) { setImportPreview(null); setError(e?.message || 'Token inválido ou indisponível.') }
    finally { setShareBusy(false) }
  }

  async function importSharedPackage() {
    if (!importPreview) return
    setShareBusy(true); setError(''); setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/import`, {
        method: 'POST',
        body: JSON.stringify({ token: importPreview.token }),
      })
      const result = body.imported || { artworks: 0, assets: 0, ids: [] }
      setImportComplete({ artworks: result.artworks, assets: result.assets })
      await reload(result.ids?.[0])
      await reloadAssets()
      await reloadColors()
      setFeedback(`${result.artworks} arte(s) importada(s). Agora você pode trocar cores e imagens em poucos cliques.`)
    } catch (e: any) { setError(e?.message || 'Erro ao importar pacote de artes.') }
    finally { setShareBusy(false) }
  }

  async function renameProject(item: PostArtworkProject) {
    const name = window.prompt('Novo nome da arte', item.name)?.trim()
    if (!name || name === item.name) return
    setSaving(true); setError(''); setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify({ ...item, name }) })
      if (body.item) {
        setItems((current) => current.map((currentItem) => currentItem.id === item.id ? body.item! : currentItem))
        if (draft?.id === item.id) setDraft(cloneDraft(body.item))
        setFeedback('Arte renomeada.')
      }
    } catch (e: any) { setError(e?.message || 'Erro ao renomear arte.') } finally { setSaving(false) }
  }

  async function duplicateProject(item: PostArtworkProject) {
    setSaving(true); setError(''); setFeedback('')
    try {
      const created = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`, { method: 'POST', body: JSON.stringify({ name: `${item.name} cópia` }) })
      if (!created.item) return
      const copied = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(created.item.id)}`, { method: 'PUT', body: JSON.stringify({ ...item, id: created.item.id, name: `${item.name} cópia` }) })
      await reload(copied.item?.id || created.item.id)
      setFeedback('Arte duplicada. O layout foi copiado sem alterar a original.')
    } catch (e: any) { setError(e?.message || 'Erro ao duplicar arte.') } finally { setSaving(false) }
  }

  async function deleteManagedProject(item: PostArtworkProject) {
    if (!window.confirm(`Excluir a arte “${item.name}”?`)) return
    setSaving(true); setError(''); setFeedback('')
    try {
      await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const next = items.filter((current) => current.id !== item.id)
      setItems(next)
      if (activeId === item.id) {
        const first = next[0] || null
        setActiveId(first?.id || '')
        setDraft(first ? cloneDraft(first) : null)
      }
      setFeedback('Arte excluída.')
    } catch (e: any) { setError(e?.message || 'Erro ao excluir arte.') } finally { setSaving(false) }
  }

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

  async function createProjectAndEdit() {
    setSaving(true)
    setError('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem`, { method: 'POST', body: JSON.stringify({ name: `Arte ${items.length + 1}` }) })
      if (body.item) window.location.href = `/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/editor?artwork=${encodeURIComponent(body.item.id)}`
    } catch (e: any) { setError(e?.message || 'Erro ao criar arte.') } finally { setSaving(false) }
  }

  function openEditor(artworkId?: string) {
    const suffix = artworkId ? `?artwork=${encodeURIComponent(artworkId)}` : ''
    window.location.href = `/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/editor${suffix}`
  }

  async function saveProject() {
    if (!draft) return
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const body = await authFetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/artes-postagem/${encodeURIComponent(draft.id)}`, { method: 'PUT', body: JSON.stringify(stripDynamicGameSources(draft)) })
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
    const game = editorReferenceGame || undefined
    const block = createDayTableBlock(draft.blocks.filter((item) => item.type === 'table_day').length, game)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addMvpGeneral() {
    if (!draft) return
    const block = createMvpGeneralCardBlock(draft.blocks.filter((item) => item.type === 'mvp_general_card').length)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addMvpGeneralTable() {
    if (!draft) return
    const block = createMvpGeneralTableBlock(draft.blocks.filter((item) => item.type === 'mvp_general_table').length)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addMvpDay() {
    if (!draft) return
    const block = createMvpBlock('mvp_day', draft.blocks.filter((item) => item.type === 'mvp_day').length, editorReferenceGame || undefined)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }


  function addQualifiedTeams() {
    if (!draft) return
    const block = createQualifiedTeamsBlock(draft.blocks.filter((item) => item.type === 'qualified_teams').length, editorReferenceGame || undefined)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addBooyahsDay() {
    if (!draft) return
    const game = editorReferenceGame || undefined
    const block = createBooyahsDayBlock(draft.blocks.filter((item) => item.type === 'booyahs_day').length, game)
    setDraft({ ...draft, blocks: [...draft.blocks, block] })
    setSelectedBlockId(block.id)
  }

  function addKillLeaders() {
    if (!draft) return
    const game = editorReferenceGame || undefined
    const block = createMvpBlock('mvp_general', draft.blocks.filter((item) => item.type === 'kills_leaders').length)
    const next = { ...block, id: uid('kills-leaders'), type: 'kills_leaders' as const, name: `Líder de Abates do Jogo ${draft.blocks.filter((item) => item.type === 'kills_leaders').length + 1}`, source: game ? { jogoId: game.id, jogoName: game.nome } : {} }
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
  const selectedTableStyle = selectedBlock && (selectedBlock.type === 'table_general' || selectedBlock.type === 'table_day' || selectedBlock.type === 'mvp_general_table') ? normalizeTableStyle(selectedBlock) : null
  const selectedBooyahStyle = selectedBlock?.type === 'booyahs_day' ? normalizeBooyahStyle(selectedBlock) : null
  const currentPalette = useMemo(() => projectPalette(draft), [draft])

  function updatePaletteColor(index: number, nextColor: string) {
    if (!draft || !/^#[0-9a-f]{6}$/i.test(nextColor)) return
    const from = currentPalette[index]
    setDraft(replaceProjectColor(draft, from, nextColor.toUpperCase()))
  }

  function addPaletteColor() {
    if (!draft || currentPalette.length >= 6) return
    setDraft(withProjectPalette(draft, [...currentPalette, '#808080']))
  }

  function removePaletteColor(index: number) {
    if (!draft || currentPalette.length <= 1) return
    setDraft(withProjectPalette(draft, currentPalette.filter((_, colorIndex) => colorIndex !== index)))
  }

  const selectedQualifiedStyle = selectedBlock?.type === 'qualified_teams' ? normalizeQualifiedStyle(selectedBlock) : null
  const selectedMvpStyle = selectedBlock && (selectedBlock.type === 'mvp_general' || selectedBlock.type === 'mvp_general_card' || selectedBlock.type === 'mvp_day' || selectedBlock.type === 'kills_leaders') ? normalizeMvpStyle(selectedBlock) : null
  const selectedColumn = selectedTableStyle?.columns.find((column) => column.key === selectedColumnKey) || null

  function patchTableStyle(patch: Partial<PostArtworkTableStyle>) {
    if (!selectedBlock || !selectedTableStyle) return
    const next = { ...selectedTableStyle, ...patch }
    patchBlock(selectedBlock.id, { style: next as unknown as Record<string, unknown>, width: tableVisualWidth(next) })
  }

  function patchBooyahStyle(patch: Partial<PostArtworkBooyahStyle>) {
    if (!selectedBlock || !selectedBooyahStyle) return
    const next = { ...selectedBooyahStyle, ...patch }
    patchBlock(selectedBlock.id, { style: next as unknown as Record<string, unknown>, width: next.totalWidth })
  }

  function patchColumn(key: PostArtworkTableColumnKey, patch: Partial<PostArtworkTableColumnStyle>) {
    if (!selectedTableStyle) return
    const columns = selectedTableStyle.columns.map((column) => column.key === key ? { ...column, ...patch } : column)
    patchTableStyle({ columns })
  }

  function patchQualifiedStyle(patch: Partial<PostArtworkQualifiedStyle>) {
    if (!selectedBlock || !selectedQualifiedStyle) return
    const next = { ...selectedQualifiedStyle, ...patch }
    patchBlock(selectedBlock.id, { style: { ...(selectedBlock.style || {}), ...next } as Record<string, unknown>, width: qualifiedVisualWidth(next) })
  }

  function patchMvpStyle(patch: Partial<PostArtworkMvpStyle>) {
    if (!selectedBlock || !selectedMvpStyle) return
    const next = { ...selectedMvpStyle, ...patch }
    patchBlock(selectedBlock.id, { style: next as unknown as Record<string, unknown>, width: mvpVisualWidth(selectedBlock, next) })
  }

  async function uploadQualifiedBackground(file?: File | null) {
    if (!file || !selectedBlock || !selectedQualifiedStyle) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchQualifiedStyle({ backgroundType: 'image', backgroundUrl: url })
      void rememberAsset(url, file.name || 'Fundo dos cards classificados', 'card')
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo dos cards classificados.') }
    finally { setUploadingCell(false) }
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


  async function uploadBooyahSectionBackground(section: 'mediaBackgroundUrl' | 'titleBackgroundUrl' | 'statsBackgroundUrl', file?: File | null) {
    if (!file || !selectedBlock || !selectedBooyahStyle) return
    setUploadingCell(true); setError('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId })
      patchBooyahStyle({ [section]: url } as Partial<PostArtworkBooyahStyle>)
      const label = section === 'mediaBackgroundUrl' ? 'Fundo da área do mapa' : section === 'titleBackgroundUrl' ? 'Fundo da faixa do mapa' : 'Fundo das estatísticas do booyah'
      void rememberAsset(url, file.name || label, 'card')
    } catch (e: any) { setError(e?.message || 'Não foi possível enviar o fundo desta seção do booyah.') }
    finally { setUploadingCell(false) }
  }

  async function exportArtwork(project: PostArtworkProject | null = renderDraft) {
    if (!project || exporting) return
    setExporting(true); setError('')
    try {
      const [latestRows, latestMvpGeneral] = await Promise.all([loadPostArtworkGeneralStandings(campeonatoId), loadPostArtworkGeneralMvp(campeonatoId)])
      const dayIds = [...new Set(project.blocks.filter((block) => block.type === 'table_day' || block.type === 'qualified_teams').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestDayEntries = await Promise.all(dayIds.map(async (jogoId) => [jogoId, await loadPostArtworkGameStandings(campeonatoId, jogoId)] as const))
      const latestDayRows = Object.fromEntries(latestDayEntries)
      const booyahDayIds = [...new Set(project.blocks.filter((block) => block.type === 'booyahs_day').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestBooyahEntries = await Promise.all(booyahDayIds.map(async (jogoId) => [jogoId, await loadPostArtworkGameBooyahs(campeonatoId, jogoId)] as const))
      const latestBooyahRows = Object.fromEntries(latestBooyahEntries)
      const killLeaderDayIds = [...new Set(project.blocks.filter((block) => block.type === 'kills_leaders').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestKillLeaderEntries = await Promise.all(killLeaderDayIds.map(async (jogoId) => [jogoId, await loadPostArtworkGameKillLeaders(campeonatoId, jogoId)] as const))
      const latestKillLeaders = Object.fromEntries(latestKillLeaderEntries)
      const mvpDayIds = [...new Set(project.blocks.filter((block) => block.type === 'mvp_day').map((block) => block.source?.jogoId).filter(Boolean))] as string[]
      const latestMvpDayEntries = await Promise.all(mvpDayIds.map(async (jogoId) => [jogoId, await loadPostArtworkGameMvp(campeonatoId, jogoId)] as const))
      const latestMvpDayRows = Object.fromEntries(latestMvpDayEntries)
      setStandings(latestRows); setDayStandings(latestDayRows); setMvpGeneral(latestMvpGeneral); setMvpDay(latestMvpDayRows); setBooyahDay(latestBooyahRows); setKillLeaders(latestKillLeaders)
      const renderScale = resolveExportRenderScale(project.width, project.height)
      const board = await renderArtworkCanvas(project, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders, renderScale, mode === 'edit' ? '' : generationCaption, generationCaptionColor)
      const extension = project.output_format
      if (project.slice_count === 1) {
        const finalCanvas = createDownsampledCanvas(board, project.width, project.height)
        downloadBlob(await canvasBlob(finalCanvas, extension), `${project.name || 'arte'}.${extension}`)
        return
      }
      const zip = new JSZip()
      for (let index = 0; index < project.slice_count; index += 1) {
        const sx = (project.slice_direction === 'horizontal' ? project.slice_width * index : 0) * renderScale
        const sy = (project.slice_direction === 'vertical' ? project.slice_height * index : 0) * renderScale
        const sw = project.slice_width * renderScale
        const sh = project.slice_height * renderScale
        const slice = createDownsampledCanvas(board, project.slice_width, project.slice_height, sx, sy, sw, sh)
        zip.file(`${project.name || 'arte'}-${String(index + 1).padStart(2, '0')}.${extension}`, await canvasBlob(slice, extension))
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${project.name || 'arte'}-carrossel.zip`)
    } catch (e: any) { setError(e?.message || 'Não foi possível gerar as imagens.') }
    finally { setExporting(false) }
  }

  useEffect(() => {
    if (mode === 'edit' || !renderDraft) { setQuickPreviewUrl(''); return }
    let active = true
    let objectUrl = ''
    setQuickPreviewLoading(true)
    ;(async () => {
      try {
        const previewScale = Math.min(1, 1400 / Math.max(renderDraft.width, renderDraft.height))
        const board = await renderArtworkCanvas(renderDraft, standings, dayStandings, mvpGeneral, mvpDay, booyahDay, killLeaders, previewScale, generationCaption, generationCaptionColor)
        const blob = await canvasBlob(board, 'png')
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setQuickPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return objectUrl })
      } catch { if (active) setQuickPreviewUrl('') }
      finally { if (active) setQuickPreviewLoading(false) }
    })()
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [mode, renderDraft, standings, dayStandings, mvpGeneral, mvpDay, booyahDay, killLeaders, generationCaption, generationCaptionColor])

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
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id: block.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: block.x, y: block.y }
    setSelectedBlockId(block.id)
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      dragRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    patchBlock(current.id, { x: Math.round(current.x + (event.clientX - current.startX) / previewScale), y: Math.round(current.y + (event.clientY - current.startY) / previewScale) })
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (loading) return <div className="post-artworks-state"><Loader2 className="spin" /> Carregando artes…</div>

  if (mode === 'library') {
    return <div className="post-artworks-page post-artworks-generate-page post-artworks-library-page">
      <header className="post-artworks-header post-artworks-generate-header">
        <div><a href={`/campeonatos/${campeonatoId}`}><ArrowLeft size={14} /> Voltar ao campeonato</a><small>ARTES · {campeonatoNome}</small><h1>Biblioteca visual</h1><p>Gerencie imagens e as cores usadas nos templates. Uma substituição pode atualizar todas as artes do campeonato sem abrir o editor.</p></div>
        <div className="post-artworks-header-actions">{librarySection === 'images' ? <label className="post-artworks-primary post-artworks-library-upload-main">{uploadingLibrary ? <Loader2 className="spin" size={15} /> : <ImagePlus size={15} />} Adicionar imagem<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadLibraryAsset(event.target.files?.[0])} /></label> : null}</div>
      </header>
      <nav className="post-artworks-generate-nav" aria-label="Navegação de artes"><a href={`/campeonatos/${campeonatoId}/artes-postagem`}>Gerar artes</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/salvas`}>Artes salvas</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/editor`}>Editor de artes</a><a className="active" href={`/campeonatos/${campeonatoId}/artes-postagem/biblioteca`}>Biblioteca de imagens</a></nav>
      {error ? <div className="post-artworks-alert error">{error}</div> : null}
      {libraryError ? <div className="post-artworks-alert error">{libraryError}</div> : null}
      {feedback ? <div className="post-artworks-alert success">{feedback}</div> : null}
      <div className="post-artworks-library-sections" aria-label="Biblioteca visual"><button type="button" className={librarySection === 'images' ? 'active' : ''} onClick={() => setLibrarySection('images')}>Imagens <small>{assets.length}</small></button><button type="button" className={librarySection === 'colors' ? 'active' : ''} onClick={() => setLibrarySection('colors')}>Cores <small>{colorInventory.length}</small></button></div>
      {librarySection === 'images' ? <>
        <section className="post-artworks-library-toolbar">
          <div className="post-artworks-library-filter"><strong>Mostrar</strong>{([['all','Todas'],['background','Fundos'],['cell','Células'],['card','Cards'],['other','Outras']] as const).map(([key,label]) => <button type="button" key={key} className={libraryKindFilter === key ? 'active' : ''} onClick={() => setLibraryKindFilter(key)}>{label}</button>)}</div>
          <label><span>Tipo do próximo upload</span><select value={libraryUploadKind} onChange={(event) => setLibraryUploadKind(event.target.value as PostArtworkAssetKind)}><option value="background">Fundo de arte</option><option value="cell">Fundo de célula</option><option value="card">Fundo de card</option><option value="other">Outra imagem</option></select></label>
        </section>
        <section className="post-artworks-smart-library-grid">
          {filteredAssets.map((asset) => {
            const uses = collectAssetUsages(items, asset.url)
            const artworkCount = new Set(uses.map((use) => use.artworkId)).size
            return <article key={asset.id}>
              <div className="post-artworks-smart-library-thumb" style={{ backgroundImage: `url(${JSON.stringify(asset.url)})` }} />
              <div className="post-artworks-smart-library-copy"><b>{asset.name}</b><span>{asset.kind === 'background' ? 'Fundo de arte' : asset.kind === 'cell' ? 'Fundo de célula' : asset.kind === 'card' ? 'Fundo de card' : 'Imagem'}</span><small>{uses.length ? `${uses.length} uso(s) em ${artworkCount} arte(s)` : 'Ainda não usada nas artes'}</small></div>
              <div className="post-artworks-smart-library-actions"><button type="button" onClick={() => void downloadLibraryAsset(asset)}><Download size={13} /> Baixar</button><button type="button" onClick={() => setUsageAssetId(asset.id)}>Ver usos</button><label>{replacingAssetId === asset.id ? <Loader2 className="spin" size={13} /> : <ImagePlus size={13} />} Substituir em todas<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={Boolean(replacingAssetId)} onChange={(event) => void replaceLibraryAsset(asset, event.target.files?.[0])} /></label>{!uses.length ? <button type="button" className="danger" onClick={() => void deleteLibraryAsset(asset.id)}><Trash2 size={13} /> Remover</button> : null}</div>
            </article>
          })}
          {!filteredAssets.length ? <div className="post-artworks-empty"><Images size={30} /><strong>Nenhuma imagem nesta categoria</strong><span>Adicione um arquivo aqui ou faça upload pelo editor. Tudo fica disponível para reutilização no campeonato.</span></div> : null}
        </section>
      </> : <>
        <section className="post-artworks-colors-intro"><div><strong>Cores usadas nas artes</strong><span>O sistema detecta automaticamente as cores configuradas nos templates. Troque uma cor aqui e todos os usos dela são atualizados de uma vez.</span></div><button type="button" onClick={() => void reloadColors()}>Atualizar cores</button></section>
        <section className="post-artworks-color-grid">
          {colorInventory.map((entry) => <article key={entry.color}>
            <div className="post-artworks-color-swatch" style={{ backgroundColor: entry.color }}><span>{entry.color}</span></div>
            <div className="post-artworks-color-copy"><b>{entry.color}</b><span>{entry.references} uso(s) em {entry.artworks} arte(s)</span></div>
            <label className="post-artworks-color-picker"><span>Nova cor</span><div><input type="color" value={colorDrafts[entry.color] || entry.color} onChange={(event) => setColorDrafts((current) => ({ ...current, [entry.color]: event.target.value.toUpperCase() }))} /><input value={colorDrafts[entry.color] || entry.color} maxLength={7} onChange={(event) => setColorDrafts((current) => ({ ...current, [entry.color]: event.target.value.toUpperCase() }))} /></div></label>
            <div className="post-artworks-color-actions"><button type="button" onClick={() => setUsageColor(entry.color)}>Ver usos</button><button type="button" className="primary" disabled={replacingColor === entry.color || (colorDrafts[entry.color] || entry.color).toUpperCase() === entry.color.toUpperCase()} onClick={() => void replaceLibraryColor(entry)}>{replacingColor === entry.color ? <Loader2 className="spin" size={13} /> : null} Substituir em todas</button></div>
          </article>)}
          {!colorInventory.length ? <div className="post-artworks-empty"><strong>Nenhuma cor detectada</strong><span>As cores configuradas no fundo, legendas, colunas e cards das artes aparecerão aqui automaticamente.</span></div> : null}
        </section>
      </>}
      {selectedUsageAsset ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setUsageAssetId('') }}><section className="post-artworks-library post-artworks-usage-modal"><header><div><small>ONDE ESTA IMAGEM É USADA</small><strong>{selectedUsageAsset.name}</strong><span>{selectedAssetUsages.length} referência(s) encontrada(s).</span></div><button type="button" onClick={() => setUsageAssetId('')} aria-label="Fechar usos"><X size={18} /></button></header><div className="post-artworks-usage-list">{selectedAssetUsages.map((use, index) => <article key={`${use.artworkId}-${use.location}-${index}`}><div><b>{use.artworkName}</b><span>{use.location}</span></div><a href={`/campeonatos/${campeonatoId}/artes-postagem/editor?artwork=${encodeURIComponent(use.artworkId)}`}>Editar arte</a></article>)}{!selectedAssetUsages.length ? <div className="post-artworks-library-empty"><strong>Sem usos</strong><span>Esta imagem está guardada na biblioteca, mas nenhum template atual aponta para ela.</span></div> : null}</div></section></div> : null}
      {selectedUsageColor ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setUsageColor('') }}><section className="post-artworks-library post-artworks-usage-modal"><header><div><small>ONDE ESTA COR É USADA</small><strong>{selectedUsageColor.color}</strong><span>{selectedUsageColor.references} referência(s) em {selectedUsageColor.artworks} arte(s).</span></div><button type="button" onClick={() => setUsageColor('')} aria-label="Fechar usos da cor"><X size={18} /></button></header><div className="post-artworks-usage-list">{selectedUsageColor.uses.map((use) => <article key={use.artworkId}><div><b>{use.artworkName}</b><span>{use.count} uso(s) desta cor</span></div><a href={`/campeonatos/${campeonatoId}/artes-postagem/editor?artwork=${encodeURIComponent(use.artworkId)}`}>Editar arte</a></article>)}</div></section></div> : null}
    </div>
  }

  if (mode === 'manage') {
    return (
      <div className="post-artworks-page post-artworks-manage-page">
        <header className="post-artworks-header post-artworks-generate-header">
          <div><a href={`/campeonatos/${campeonatoId}`}><ArrowLeft size={15} /> Voltar ao campeonato</a><small>ARTES SALVAS</small><h1>{campeonatoNome}</h1><p>Organize os templates do campeonato sem entrar no editor. Crie, encontre, visualize, renomeie, duplique ou exclua uma arte.</p></div>
          <div className="post-artworks-header-actions"><a className="post-artworks-secondary" href={`/campeonatos/${campeonatoId}/artes-postagem`}>Gerar artes</a><button type="button" className="post-artworks-secondary" onClick={() => { setShareToken(''); setImportPreview(null); setImportComplete(null); setShareModal('import') }}>Importar modelo</button><button type="button" className="post-artworks-secondary" onClick={() => { setShareToken(''); setShareScope('all'); setImportPreview(null); setImportComplete(null); setShareModal('share') }} disabled={!items.length}>Compartilhar modelo</button><button type="button" className="post-artworks-primary" onClick={() => void createProjectAndEdit()} disabled={saving}><Plus size={15} /> Criar arte</button></div>
        </header>

        <nav className="post-artworks-generate-nav" aria-label="Navegação de artes"><a href={`/campeonatos/${campeonatoId}/artes-postagem`}>Gerar artes</a><a className="active" href={`/campeonatos/${campeonatoId}/artes-postagem/salvas`}>Artes salvas</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/editor`}>Editor de artes</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/biblioteca`}>Biblioteca de imagens</a></nav>

        {error ? <div className="post-artworks-alert error">{error}</div> : null}
        {feedback ? <div className="post-artworks-alert success">{feedback}</div> : null}

        <section className="post-artworks-generate-filter post-artworks-manage-game-filter">
          <div className="post-artworks-panel-title"><strong>Gerar com dados do jogo</strong><small>Escolha o jogo uma vez. A prévia e os downloads usam os dados desse jogo sem alterar o template salvo.</small></div>
          <div className="post-artworks-generate-filter-grid">
            <label>Fase<select value={generationPhaseId} onChange={(event) => { const faseId = event.target.value; setGenerationPhaseId(faseId); setGenerationGameId('') }}><option value="">Selecione a fase</option>{generationPhases.map((fase) => <option key={fase.id} value={fase.id}>{fase.nome}</option>)}</select></label>
            <label>Jogo<select value={generationGameId} onChange={(event) => setGenerationGameId(event.target.value)} disabled={!generationPhaseId}><option value="">Selecione o jogo</option>{generationGames.map((game) => <option key={game.id} value={game.id}>{game.nome}{game.grupoNome ? ` · ${game.grupoNome}` : ''}</option>)}</select></label>
            <label className="post-artworks-generation-caption">Informação do jogo<input value={generationCaption} onChange={(event) => setGenerationCaption(event.target.value)} placeholder="Ex.: RW LEAGUE - SÉRIE C - R2 - GRUPO C" /><small>Este texto entra somente na imagem gerada. O template salvo não é alterado.</small></label>
            <div className="post-artworks-generation-caption-color"><PaletteColorField label="Cor do texto final" value={generationCaptionColor} palette={currentPalette} onChange={setGenerationCaptionColor} /></div>
            <div className="post-artworks-generate-filter-actions"><button type="button" className="post-artworks-secondary" onClick={() => void reload(activeId)}>Atualizar dados</button></div>
          </div>
          {generationGame ? <div className="post-artworks-game-summary"><strong>{generationGame.nome}</strong><span>{generationGame.faseNome}{generationGame.grupoNome ? ` · ${generationGame.grupoNome}` : ''}</span><span>{generationGame.mataMata ? `Mata-mata · Top ${generationGame.classificamQuantidade || '—'} classifica` : 'Pontos corridos · sem eliminação'}</span></div> : <div className="post-artworks-game-summary muted">Selecione um jogo para gerar os templates com Tabela do Jogo, Classificados, MVP, Booyahs e Líderes de Abates atualizados.</div>}
        </section>

        <section className="post-artworks-manage-toolbar">
          <label className="post-artworks-manage-search"><span>Buscar arte</span><input value={artworkSearch} onChange={(event) => setArtworkSearch(event.target.value)} placeholder="Ex.: tabela geral, MVP, classificados" /></label>
          <div className="post-artworks-manage-filters" aria-label="Filtrar artes">
            <button type="button" className={artworkFilter === 'all' ? 'active' : ''} onClick={() => setArtworkFilter('all')}>Todas <small>{items.length}</small></button>
            <button type="button" className={artworkFilter === 'tables' ? 'active' : ''} onClick={() => setArtworkFilter('tables')}>Tabelas</button>
            <button type="button" className={artworkFilter === 'mvp' ? 'active' : ''} onClick={() => setArtworkFilter('mvp')}>MVP / destaques</button>
            <button type="button" className={artworkFilter === 'qualified' ? 'active' : ''} onClick={() => setArtworkFilter('qualified')}>Classificados</button>
            <button type="button" className={artworkFilter === 'other' ? 'active' : ''} onClick={() => setArtworkFilter('other')}>Outras</button>
          </div>
        </section>

        <section className="post-artworks-manage-content">
          <div className="post-artworks-manage-list">
            <div className="post-artworks-generate-section-head"><div><strong>Templates do campeonato</strong><small>{managedItems.length} de {items.length} arte(s)</small></div><button type="button" className="post-artworks-primary" onClick={() => void createProjectAndEdit()} disabled={saving}><Plus size={15} /> Criar arte</button></div>
            <div className="post-artworks-manage-cards">
              {managedItems.map((item) => <article key={item.id} className={item.id === activeId ? 'active' : ''}>
                <button type="button" className="post-artworks-manage-card-preview" onClick={() => selectItem(item.id)} style={{ backgroundColor: item.background_color, backgroundImage: item.background_url ? `url(${JSON.stringify(item.background_url)})` : undefined }} aria-label={`Visualizar ${item.name}`} />
                <div className="post-artworks-manage-card-copy"><b>{item.name}</b><span>{item.slice_width} × {item.slice_height}{item.slice_count > 1 ? ` · ${item.slice_count} fatias` : ''}</span><small>{item.output_format.toUpperCase()} · {userBlocks(item).length} bloco(s)</small></div>
                <div className="post-artworks-manage-card-actions"><button type="button" onClick={() => selectItem(item.id)}>Visualizar</button><button type="button" onClick={() => void exportArtwork(resolveProjectForGame(item, generationGame))} disabled={exporting || (projectRequiresGame(item) && !generationGame)}>{exporting && item.id === activeId ? 'Gerando…' : projectRequiresGame(item) && !generationGame ? 'Selecione o jogo' : 'Baixar'}</button><button type="button" onClick={() => openEditor(item.id)}>Editar</button><button type="button" onClick={() => void renameProject(item)} disabled={saving}>Renomear</button><button type="button" onClick={() => void duplicateProject(item)} disabled={saving}><Copy size={13} /> Duplicar</button><button type="button" className="danger" onClick={() => void deleteManagedProject(item)} disabled={saving}><Trash2 size={13} /> Excluir</button></div>
              </article>)}
              {!managedItems.length ? <div className="post-artworks-empty"><strong>{items.length ? 'Nenhuma arte encontrada' : 'Nenhuma arte criada'}</strong><span>{items.length ? 'Limpe a busca ou escolha outro filtro.' : 'Crie a primeira arte para começar a montar os templates deste campeonato.'}</span></div> : null}
            </div>
          </div>

          <aside className="post-artworks-generate-preview-panel post-artworks-manage-preview-panel">
            <div className="post-artworks-generate-section-head"><div><strong>{draft?.name || 'Pré-visualização'}</strong><small>{draft ? `${draft.slice_count} ${draft.slice_count === 1 ? 'imagem' : 'imagens'} · ${draft.output_format.toUpperCase()}${generationGame ? ` · Dados: ${generationGame.nome}` : ''}` : 'Selecione um template'}</small></div>{draft ? <button type="button" className="post-artworks-secondary" onClick={() => openEditor(draft.id)}>Editar arte</button> : null}</div>
            <div className="post-artworks-generate-preview">{quickPreviewLoading ? <div className="post-artworks-state"><Loader2 className="spin" /> Gerando prévia…</div> : quickPreviewUrl ? <img src={quickPreviewUrl} alt={`Prévia de ${draft?.name || 'arte'}`} /> : <div className="post-artworks-empty"><strong>Selecione uma arte</strong><span>Confira o template antes de abrir o editor.</span></div>}</div>
            {draft ? <div className="post-artworks-manage-preview-actions"><button type="button" className="post-artworks-primary" onClick={() => void exportArtwork()} disabled={exporting || (projectRequiresGame(draft) && !generationGame)}>{exporting ? <Loader2 className="spin" size={15} /> : <Download size={15} />} {projectRequiresGame(draft) && !generationGame ? 'Selecione o jogo' : draft.slice_count > 1 ? 'Baixar carrossel' : `Baixar ${draft.output_format.toUpperCase()}`}</button><button type="button" className="post-artworks-secondary" onClick={() => openEditor(draft.id)}>Editar arte</button><button type="button" className="post-artworks-secondary" onClick={() => void duplicateProject(draft)} disabled={saving}><Copy size={14} /> Duplicar</button></div> : null}
          </aside>
        </section>

        {shareModal ? <div className="post-artworks-library-backdrop post-artworks-share-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeShareModal() }}>
          <section className="post-artworks-share-modal">
            <header><div><small>{shareModal === 'share' ? 'COMPARTILHAR MODELO' : 'IMPORTAR MODELO'}</small><strong>{shareModal === 'share' ? 'Pacote de artes por token' : 'Reutilizar artes de outro campeonato'}</strong><span>{shareModal === 'share' ? 'O pacote leva estrutura, cores e, se você quiser, referências das imagens. Resultados, equipes e jogadores não são compartilhados.' : 'Cole um token, confira tudo antes de importar e depois personalize cores e imagens sem abrir o editor.'}</span></div><button type="button" onClick={closeShareModal} aria-label="Fechar compartilhamento"><X size={18} /></button></header>
            {shareModal === 'share' ? <div className="post-artworks-share-body">
              <div className="post-artworks-share-options">
                <label><input type="radio" checked={shareScope === 'all'} onChange={() => setShareScope('all')} /> <span><b>Todas as artes</b><small>{items.length} template(s) do campeonato</small></span></label>
                <label className={!draft ? 'disabled' : ''}><input type="radio" checked={shareScope === 'selected'} disabled={!draft} onChange={() => setShareScope('selected')} /> <span><b>Somente a arte selecionada</b><small>{draft?.name || 'Selecione uma arte primeiro'}</small></span></label>
                <label><input type="checkbox" checked={shareIncludeAssets} onChange={(event) => setShareIncludeAssets(event.target.checked)} /> <span><b>Incluir imagens da biblioteca</b><small>O campeonato de destino recebe as referências e poderá substituir todas depois.</small></span></label>
              </div>
              {shareToken ? <div className="post-artworks-share-token"><span>Token gerado</span><code>{shareToken}</code><button type="button" className="post-artworks-primary" onClick={() => void copyShareToken()}><Copy size={14} /> Copiar token</button></div> : <button type="button" className="post-artworks-primary post-artworks-share-main-action" onClick={() => void generateShareToken()} disabled={shareBusy}>{shareBusy ? <Loader2 className="spin" size={15} /> : null} Gerar token</button>}
            </div> : <div className="post-artworks-share-body">
              <label className="post-artworks-token-input"><span>Token de compartilhamento</span><input value={shareToken} onChange={(event) => { setShareToken(event.target.value.toUpperCase()); setImportPreview(null); setImportComplete(null) }} placeholder="DZART-XXXX-XXXX-XX" /></label>
              {!importPreview ? <button type="button" className="post-artworks-primary post-artworks-share-main-action" onClick={() => void previewImportToken()} disabled={shareBusy || !shareToken.trim()}>{shareBusy ? <Loader2 className="spin" size={15} /> : null} Conferir modelo</button> : null}
              {importPreview ? <div className="post-artworks-import-preview">
                <div className="post-artworks-import-summary"><div><small>ORIGEM</small><b>{importPreview.source_name}</b></div><div><small>ARTES</small><b>{importPreview.artworks.length}</b></div><div><small>IMAGENS</small><b>{importPreview.assets.length}</b></div><div><small>CORES</small><b>{importPreview.colors.length}</b></div></div>
                <div className="post-artworks-import-artworks"><strong>Artes do pacote</strong>{importPreview.artworks.map((artwork, index) => <span key={`${artwork.name}-${index}`}><b>{artwork.name}</b><small>{artwork.width} × {artwork.height}{artwork.slices > 1 ? ` · ${artwork.slices} fatias` : ''}</small></span>)}</div>
                {importPreview.colors.length ? <div className="post-artworks-import-palette"><strong>Cores principais</strong><div>{importPreview.colors.slice(0, 6).map((entry) => <span key={entry.color} title={`${entry.references} uso(s)`} style={{ background: entry.color }}><i>{entry.color}</i></span>)}</div></div> : null}
                {importComplete ? <div className="post-artworks-import-complete"><b>Importação concluída</b><span>{importComplete.artworks} arte(s) importada(s) · {importComplete.assets} nova(s) imagem(ns) adicionada(s).</span><div><a className="post-artworks-primary" href={`/campeonatos/${campeonatoId}/artes-postagem/biblioteca`}>Personalizar cores e imagens</a><button type="button" className="post-artworks-secondary" onClick={closeShareModal}>Ver artes importadas</button></div></div> : <button type="button" className="post-artworks-primary post-artworks-share-main-action" onClick={() => void importSharedPackage()} disabled={shareBusy}>{shareBusy ? <Loader2 className="spin" size={15} /> : null} Importar {importPreview.artworks.length} arte(s)</button>}
              </div> : null}
            </div>}
          </section>
        </div> : null}

        {libraryOpen ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryOpen(false) }}><section className="post-artworks-library"><header><div><small>BIBLIOTECA DO CAMPEONATO</small><strong>Imagens reutilizáveis</strong><span>Consulte os assets usados nos templates sem abrir o editor.</span></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Fechar biblioteca"><X size={18} /></button></header>{libraryError ? <div className="post-artworks-library-error">{libraryError}</div> : null}<div className="post-artworks-library-grid">{assets.map((asset) => <article key={asset.id}><div className="post-artworks-library-pick"><span className="post-artworks-library-thumb" style={{ backgroundImage: `url(${JSON.stringify(asset.url)})` }} /><b>{asset.name}</b><small>{asset.kind === 'background' ? 'Fundo de arte' : asset.kind === 'cell' ? 'Fundo de célula' : asset.kind === 'card' ? 'Fundo de card' : 'Imagem'}</small></div></article>)}{!assets.length ? <div className="post-artworks-library-empty"><Images size={28} /><strong>Nenhuma imagem salva ainda</strong><span>Os uploads usados nas artes aparecem aqui.</span></div> : null}</div></section></div> : null}
      </div>
    )
  }

  if (mode === 'generate') {
    return (
      <div className="post-artworks-page post-artworks-generate-page">
        <header className="post-artworks-header post-artworks-generate-header">
          <div><a href={`/campeonatos/${campeonatoId}`}><ArrowLeft size={15} /> Voltar ao campeonato</a><small>CENTRAL DE ARTES</small><h1>{campeonatoNome}</h1><p>Selecione o jogo, confira as artes prontas com os dados atualizados e baixe. O editor só é necessário quando você quiser mudar o layout.</p></div>
          <div className="post-artworks-header-actions"><a className="post-artworks-secondary" href={`/campeonatos/${campeonatoId}/artes-postagem/biblioteca`}><Images size={15} /> Biblioteca de imagens</a><button type="button" className="post-artworks-primary" onClick={() => void createProjectAndEdit()} disabled={saving}><Plus size={15} /> Criar arte</button></div>
        </header>

        <nav className="post-artworks-generate-nav" aria-label="Navegação de artes"><a className="active" href={`/campeonatos/${campeonatoId}/artes-postagem`}>Gerar artes</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/salvas`}>Artes salvas</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/editor`}>Editor de artes</a><a href={`/campeonatos/${campeonatoId}/artes-postagem/biblioteca`}>Biblioteca de imagens</a></nav>

        {error ? <div className="post-artworks-alert error">{error}</div> : null}
        <section className="post-artworks-generate-filter">
          <div className="post-artworks-panel-title"><strong>Selecione a fase e o jogo</strong><small>O jogo escolhido alimenta Tabela do Jogo, Classificados, MVP, Booyahs e Líderes de Abates.</small></div>
          <div className="post-artworks-generate-filter-grid">
            <label>Fase<select value={generationPhaseId} onChange={(event) => { const faseId = event.target.value; setGenerationPhaseId(faseId); setGenerationGameId('') }}><option value="">Selecione a fase</option>{generationPhases.map((fase) => <option key={fase.id} value={fase.id}>{fase.nome}</option>)}</select></label>
            <label>Jogo<select value={generationGameId} onChange={(event) => setGenerationGameId(event.target.value)} disabled={!generationPhaseId}><option value="">Selecione o jogo</option>{generationGames.map((game) => <option key={game.id} value={game.id}>{game.nome}{game.grupoNome ? ` · ${game.grupoNome}` : ''}</option>)}</select></label>
            <label className="post-artworks-generation-caption">Informação do jogo<input value={generationCaption} onChange={(event) => setGenerationCaption(event.target.value)} placeholder="Ex.: RW LEAGUE - SÉRIE C - R2 - GRUPO C" /><small>Este texto entra somente na imagem gerada. O template salvo não é alterado.</small></label>
            <div className="post-artworks-generation-caption-color"><PaletteColorField label="Cor do texto final" value={generationCaptionColor} palette={currentPalette} onChange={setGenerationCaptionColor} /></div>
            <div className="post-artworks-generate-filter-actions"><a className={`post-artworks-secondary${generationGame ? '' : ' disabled'}`} href={generationGame ? `/campeonatos/${campeonatoId}/pontuador/${generationGame.id}` : '#'}>Abrir pontuador</a><button type="button" className="post-artworks-secondary" onClick={() => void reload(activeId)}>Atualizar dados</button></div>
          </div>
          {generationGame ? <div className="post-artworks-game-summary"><strong>{generationGame.nome}</strong><span>{generationGame.faseNome}{generationGame.grupoNome ? ` · ${generationGame.grupoNome}` : ''}</span><span>{generationGame.numeroPartidas || '—'} quedas</span><span>{generationGame.mataMata ? `Mata-mata · Top ${generationGame.classificamQuantidade || '—'} classifica` : 'Pontos corridos · sem eliminação'}</span></div> : <div className="post-artworks-game-summary muted">Selecione um jogo para atualizar automaticamente os blocos vinculados a jogo.</div>}
        </section>

        <section className="post-artworks-generate-content">
          <div className="post-artworks-generate-gallery" id="artes-salvas">
            <div className="post-artworks-generate-section-head"><div><strong>Artes salvas</strong><small>{items.length} template(s) prontos para gerar</small></div><button type="button" className="post-artworks-primary" onClick={() => void createProjectAndEdit()} disabled={saving}><Plus size={15} /> Criar arte</button></div>
            <div className="post-artworks-generate-cards">{items.map((item) => <article key={item.id} className={item.id === activeId ? 'active' : ''}><button type="button" className="post-artworks-generate-card-main" onClick={() => selectItem(item.id)}><span className="post-artworks-generate-card-preview" style={{ backgroundColor: item.background_color, backgroundImage: item.background_url ? `url(${JSON.stringify(item.background_url)})` : undefined }} /><b>{item.name}</b><span>{item.width} × {item.height}</span><small>{item.slice_count} {item.slice_count === 1 ? 'imagem' : 'imagens'} · {item.output_format.toUpperCase()}</small></button><div className="post-artworks-generate-card-actions"><button type="button" onClick={() => selectItem(item.id)}>Visualizar</button><button type="button" onClick={() => void exportArtwork(resolveProjectForGame(item, generationGame))} disabled={exporting || (projectRequiresGame(item) && !generationGame)}>{exporting && item.id === activeId ? 'Gerando…' : projectRequiresGame(item) && !generationGame ? 'Selecione o jogo' : 'Baixar'}</button><button type="button" onClick={() => openEditor(item.id)}>Editar</button></div></article>)}{!items.length ? <div className="post-artworks-empty"><strong>Nenhuma arte criada</strong><span>Crie a primeira arte; depois ela fica disponível aqui para gerar durante todo o campeonato.</span></div> : null}</div>
          </div>

          <aside className="post-artworks-generate-preview-panel">
            <div className="post-artworks-generate-section-head"><div><strong>{draft?.name || 'Pré-visualização'}</strong><small>{generationGame ? `Dados: ${generationGame.nome}` : 'Selecione um jogo para conferir dados específicos'}</small></div>{draft ? <button type="button" className="post-artworks-secondary" onClick={() => openEditor(draft.id)}>Editar arte</button> : null}</div>
            <div className="post-artworks-generate-preview">{quickPreviewLoading ? <div className="post-artworks-state"><Loader2 className="spin" /> Atualizando prévia…</div> : quickPreviewUrl ? <img src={quickPreviewUrl} alt={`Prévia de ${draft?.name || 'arte'}`} /> : <div className="post-artworks-empty"><strong>Selecione uma arte</strong><span>A prévia aparecerá aqui sem abrir o editor.</span></div>}</div>
            {draft ? <div className="post-artworks-generate-download"><button type="button" className="post-artworks-primary" onClick={() => void exportArtwork()} disabled={exporting || (projectRequiresGame(draft) && !generationGame)}>{exporting ? <Loader2 className="spin" size={15} /> : <Download size={15} />} {projectRequiresGame(draft) && !generationGame ? 'Selecione o jogo' : draft.slice_count > 1 ? 'Baixar carrossel' : `Baixar ${draft.output_format.toUpperCase()}`}</button><button type="button" className="post-artworks-secondary" onClick={() => openEditor(draft.id)}>Editar arte</button></div> : null}
          </aside>
        </section>

        {libraryOpen ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryOpen(false) }}><section className="post-artworks-library"><header><div><small>BIBLIOTECA DO CAMPEONATO</small><strong>Imagens reutilizáveis</strong><span>Visualize os assets do campeonato. A substituição global entra na etapa de biblioteca inteligente.</span></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Fechar biblioteca"><X size={18} /></button></header>{libraryError ? <div className="post-artworks-library-error">{libraryError}</div> : null}<div className="post-artworks-library-grid">{assets.map((asset) => <article key={asset.id}><div className="post-artworks-library-pick"><span className="post-artworks-library-thumb" style={{ backgroundImage: `url(${JSON.stringify(asset.url)})` }} /><b>{asset.name}</b><small>{asset.kind === 'background' ? 'Fundo de arte' : asset.kind === 'cell' ? 'Fundo de célula' : asset.kind === 'card' ? 'Fundo de card' : 'Imagem'}</small></div></article>)}{!assets.length ? <div className="post-artworks-library-empty"><Images size={28} /><strong>Nenhuma imagem salva ainda</strong><span>Os uploads usados nas artes aparecem aqui.</span></div> : null}</div></section></div> : null}
      </div>
    )
  }

  return (
    <div className="post-artworks-page">
      <header className="post-artworks-header">
        <div><a href={`/campeonatos/${campeonatoId}/artes-postagem`}><ArrowLeft size={15} /> Voltar para gerar artes</a><small>ARTES PARA POSTAR</small><h1>{campeonatoNome}</h1><p>Templates de redes sociais independentes da transmissão. O layout fica salvo; os dados são atualizados na hora de baixar.</p></div>
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
            <label>Jogo de referência da prévia<select value={editorReferenceGameId} onChange={(event) => setEditorReferenceGameId(event.target.value)}><option value="">Selecione um jogo para a prévia</option>{games.map((game) => <option key={game.id} value={game.id}>{game.nome}{game.grupoNome ? ` · ${game.grupoNome}` : ''}{game.mataMata && game.classificamQuantidade ? ` · Top ${game.classificamQuantidade} passa` : ''}</option>)}</select><small>Disponível mesmo com um bloco selecionado. Serve apenas para pré-visualizar o modelo; o jogo não fica preso ao template.</small></label>
            {!selectedBlock ? <>
              <label>Nome da arte<input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} /></label>
              <div className="post-artworks-grid2"><label>Largura da fatia<EditableNumberInput value={draft.slice_width} min={240} max={7680} onCommit={(value) => patchSlices({ slice_width: value })} /></label><label>Altura da fatia<EditableNumberInput value={draft.slice_height} min={240} max={7680} onCommit={(value) => patchSlices({ slice_height: value })} /></label><label>Quantidade de fatias<EditableNumberInput value={draft.slice_count} min={1} max={10} onCommit={(value) => patchSlices({ slice_count: value })} /></label><label>Direção<select value={draft.slice_direction} onChange={(event) => patchSlices({ slice_direction: event.target.value as PostArtworkSliceDirection })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label></div>
              <div className="post-artworks-summary"><span>Área total</span><strong>{draft.width} × {draft.height}</strong><small>{draft.slice_count} fatia(s) de {draft.slice_width} × {draft.slice_height}</small></div>
              <label>Formato<select value={draft.output_format} onChange={(event) => patchDraft({ output_format: event.target.value as PostArtworkProject['output_format'] })}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
              <PaletteColorField label="Cor base" value={draft.background_color} palette={currentPalette} onChange={(value) => patchDraft({ background_color: value })} />
              <div className="post-artworks-project-palette"><div className="post-artworks-subtitle"><strong>Paleta do projeto</strong><small>Use poucas cores oficiais para evitar variações acidentais. Ao trocar uma cor aqui, todos os usos iguais no template acompanham.</small></div><div className="post-artworks-project-palette-grid">{currentPalette.map((color, index) => <div key={`${color}-${index}`} className="post-artworks-project-palette-item"><input type="color" value={color} onChange={(event) => updatePaletteColor(index, event.target.value)} /><input value={color} onChange={(event) => { const value = event.target.value.toUpperCase(); if (/^#[0-9A-F]{6}$/.test(value)) updatePaletteColor(index, value) }} aria-label={`Cor ${index + 1} da paleta`} /><button type="button" onClick={() => removePaletteColor(index)} disabled={currentPalette.length <= 1} aria-label={`Remover cor ${index + 1}`}>×</button></div>)}</div>{currentPalette.length < 6 ? <button type="button" className="post-artworks-secondary" onClick={addPaletteColor}>+ Adicionar cor à paleta</button> : null}</div>
              <label className="post-artworks-upload">{uploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {draft.background_url ? 'Trocar fundo da arte' : 'Enviar fundo da arte'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('project')}><Images size={14} /> Escolher da biblioteca</button>
              {draft.background_url ? <button type="button" className="post-artworks-secondary" onClick={() => patchDraft({ background_url: null })}>Remover fundo</button> : null}
            </> : <>
              <label>Nome do bloco<input value={selectedBlock.name} onChange={(event) => patchBlock(selectedBlock.id, { name: event.target.value })} /></label>
              {GAME_DATA_BLOCK_TYPES.has(selectedBlock.type) ? <div className="post-artworks-summary"><span>Fonte dos dados</span><strong>Jogo dinâmico</strong><small>Use “Dados de pré-visualização” para montar o modelo. Na geração, o jogo escolhido substitui a referência sem ficar preso ao template.</small></div> : null}
              <div className="post-artworks-grid2"><label>X<EditableNumberInput value={selectedBlock.x} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { x: value })} /></label><label>Y<EditableNumberInput value={selectedBlock.y} min={-20000} max={20000} onCommit={(value) => patchBlock(selectedBlock.id, { y: value })} /></label>{selectedBlock.type === 'qualified_teams' ? <label>Top que classifica<input value={selectedBlock.dataEnd && selectedBlock.dataEnd > 0 ? `Top ${selectedBlock.dataEnd}` : 'Definido pelo jogo'} readOnly /></label> : selectedBlock.type === 'mvp_general' ? <label>Até posição<EditableNumberInput value={selectedBlock.dataEnd || 10} min={2} max={50} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: 1, dataEnd: value })} /></label> : selectedMvpStyle ? <label>Posição no ranking<EditableNumberInput value={selectedBlock.dataStart || 1} min={1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: value, dataEnd: value })} /></label> : <><label>Do item<EditableNumberInput value={selectedBlock.dataStart || 1} min={1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataStart: value, dataEnd: Math.max(value, selectedBlock.dataEnd || value) })} /></label><label>Até<EditableNumberInput value={selectedBlock.dataEnd || 12} min={selectedBlock.dataStart || 1} max={999} onCommit={(value) => patchBlock(selectedBlock.id, { dataEnd: value })} /></label></>}</div>
              {selectedBooyahStyle ? <><div className="post-artworks-subtitle"><strong>Cards de Booyah</strong><small>Um card por queda. A largura de cada card muda automaticamente conforme a quantidade de quedas, mantendo a largura geral definida.</small></div><div className="post-artworks-grid2"><label>Altura dos cards<EditableNumberInput value={selectedBooyahStyle.cardHeight} min={100} max={1200} onCommit={(value) => patchBooyahStyle({ cardHeight: value })} /></label><label>Largura geral<EditableNumberInput value={selectedBooyahStyle.totalWidth} min={180} max={5000} onCommit={(value) => patchBooyahStyle({ totalWidth: value })} /></label><label>Espaço entre cards<EditableNumberInput value={selectedBooyahStyle.gap} min={0} max={120} onCommit={(value) => patchBooyahStyle({ gap: value })} /></label><label>Tamanho da logo (%)<EditableNumberInput value={Math.round(selectedBooyahStyle.logoScale * 100)} min={15} max={80} onCommit={(value) => patchBooyahStyle({ logoScale: value / 100 })} /></label><label>Fonte do nome do mapa<EditableNumberInput value={selectedBooyahStyle.teamFontSize} min={8} max={120} onCommit={(value) => patchBooyahStyle({ teamFontSize: value })} /></label><label>Fonte estatísticas<EditableNumberInput value={selectedBooyahStyle.statsFontSize} min={8} max={100} onCommit={(value) => patchBooyahStyle({ statsFontSize: value })} /></label></div><PaletteColorField label="Fundo base do card" value={selectedBooyahStyle.backgroundColor} palette={currentPalette} onChange={(value) => patchBooyahStyle({ backgroundColor: value })} /><PaletteColorField label="Cor da faixa do mapa" value={selectedBooyahStyle.accentColor} palette={currentPalette} onChange={(value) => patchBooyahStyle({ accentColor: value })} /><PaletteColorField label="Cor do texto" value={selectedBooyahStyle.textColor} palette={currentPalette} onChange={(value) => patchBooyahStyle({ textColor: value })} /><div className="post-artworks-subtitle"><strong>Fundos por seção</strong><small>Você pode aplicar uma imagem diferente na área do mapa, na faixa do nome do mapa e na parte das estatísticas.</small></div><div className="post-artworks-grid2"><div><small>ÁREA DO MAPA</small><div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedBooyahStyle.mediaBackgroundUrl ? 'Trocar fundo do mapa' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBooyahSectionBackground('mediaBackgroundUrl', event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('booyah-media')}><Images size={13} /> Biblioteca</button></div></div><div><small>FAIXA DO NOME DO MAPA</small><div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedBooyahStyle.titleBackgroundUrl ? 'Trocar faixa do mapa' : 'Upload da faixa'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBooyahSectionBackground('titleBackgroundUrl', event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('booyah-title')}><Images size={13} /> Biblioteca</button></div></div><div><small>ÁREA DAS ESTATÍSTICAS</small><div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedBooyahStyle.statsBackgroundUrl ? 'Trocar fundo das estatísticas' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBooyahSectionBackground('statsBackgroundUrl', event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('booyah-stats')}><Images size={13} /> Biblioteca</button></div></div></div></> : null}
              {selectedTableStyle ? <><div className="post-artworks-subtitle"><strong>Tabela</strong><small>Uma coluna de ranking por bloco.</small></div><div className="post-artworks-grid2"><label>Altura da linha<EditableNumberInput value={selectedTableStyle.rowHeight} min={20} max={300} onCommit={(value) => patchTableStyle({ rowHeight: value })} /></label><label>Espaço entre linhas<EditableNumberInput value={selectedTableStyle.rowGap} min={0} max={100} onCommit={(value) => patchTableStyle({ rowGap: value })} /></label><label>Gap entre células<EditableNumberInput value={selectedTableStyle.cellGap} min={0} max={100} onCommit={(value) => patchTableStyle({ cellGap: value })} /></label><label>Altura da legenda<EditableNumberInput value={selectedTableStyle.headerHeight} min={20} max={150} onCommit={(value) => patchTableStyle({ headerHeight: value })} /></label></div><label className="post-artworks-check"><input type="checkbox" checked={selectedTableStyle.showHeader} onChange={(event) => patchTableStyle({ showHeader: event.target.checked })} /> Exibir legenda</label>{selectedTableStyle.showHeader ? <><label>Fundo da legenda<select value={selectedTableStyle.headerBackgroundType} onChange={(event) => patchTableStyle({ headerBackgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedTableStyle.headerBackgroundType === 'color' ? <PaletteColorField label="Cor da legenda" value={selectedTableStyle.headerBackgroundColor} palette={currentPalette} onChange={(value) => patchTableStyle({ headerBackgroundColor: value })} /> : null}{selectedTableStyle.headerBackgroundType === 'image' ? <div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedTableStyle.headerBackgroundUrl ? 'Trocar imagem da legenda' : 'Upload da legenda'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadHeaderBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('header')}><Images size={13} /> Biblioteca</button></div> : null}<div className="post-artworks-grid2"><label>Tamanho da fonte da legenda<EditableNumberInput value={selectedTableStyle.headerFontSize} min={8} max={120} onCommit={(value) => patchTableStyle({ headerFontSize: value })} /></label><label>Peso da fonte da legenda<EditableNumberInput value={selectedTableStyle.headerFontWeight} min={100} max={900} step={100} bigStep={100} onCommit={(value) => patchTableStyle({ headerFontWeight: value })} /></label><label>Fonte da legenda<select value={selectedTableStyle.headerFontFamily} onChange={(event) => patchTableStyle({ headerFontFamily: event.target.value })}><option value="Arial">Arial</option><option value="Impact">Impact</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Georgia">Georgia</option></select></label><PaletteColorField label="Cor do texto da legenda" value={selectedTableStyle.headerColor} palette={currentPalette} onChange={(value) => patchTableStyle({ headerColor: value })} /></div></> : null}</> : null}
              {selectedQualifiedStyle ? <><div className="post-artworks-subtitle"><strong>Cards de classificados</strong><small>Somente as logos: classificados em cima e eliminados embaixo.</small></div><div className="post-artworks-grid2"><label>Largura do card<EditableNumberInput value={selectedQualifiedStyle.cardWidth} min={60} max={600} onCommit={(value) => patchQualifiedStyle({ cardWidth: value })} /></label><label>Altura do card<EditableNumberInput value={selectedQualifiedStyle.cardHeight} min={60} max={600} onCommit={(value) => patchQualifiedStyle({ cardHeight: value })} /></label><label>Cards por linha<EditableNumberInput value={selectedQualifiedStyle.columns} min={1} max={12} onCommit={(value) => patchQualifiedStyle({ columns: value })} /></label><label>Espaçamento<EditableNumberInput value={selectedQualifiedStyle.gap} min={0} max={120} onCommit={(value) => patchQualifiedStyle({ gap: value })} /></label><label>Espaço entre grupos<EditableNumberInput value={selectedQualifiedStyle.sectionGap} min={0} max={300} onCommit={(value) => patchQualifiedStyle({ sectionGap: value })} /></label><label>Deslocamento X eliminados<EditableNumberInput value={selectedQualifiedStyle.eliminatedOffsetX} min={-1200} max={1200} onCommit={(value) => patchQualifiedStyle({ eliminatedOffsetX: value })} /></label><label>Deslocamento Y eliminados<EditableNumberInput value={selectedQualifiedStyle.eliminatedOffsetY} min={-600} max={1200} onCommit={(value) => patchQualifiedStyle({ eliminatedOffsetY: value })} /></label><label>Tamanho da logo (%)<EditableNumberInput value={Math.round(selectedQualifiedStyle.logoScale * 100)} min={10} max={100} onCommit={(value) => patchQualifiedStyle({ logoScale: value / 100 })} /></label></div><label className="post-artworks-check"><input type="checkbox" checked={selectedQualifiedStyle.showTitles} onChange={(event) => patchQualifiedStyle({ showTitles: event.target.checked })} /> Exibir títulos Classificados / Eliminados</label>{selectedQualifiedStyle.showTitles ? <><div className="post-artworks-grid2"><label>Título classificados<input value={selectedQualifiedStyle.qualifiedTitle} onChange={(event) => patchQualifiedStyle({ qualifiedTitle: event.target.value })} /></label><label>Título eliminados<input value={selectedQualifiedStyle.eliminatedTitle} onChange={(event) => patchQualifiedStyle({ eliminatedTitle: event.target.value })} /></label><label>Tamanho do título<EditableNumberInput value={selectedQualifiedStyle.titleFontSize} min={10} max={160} onCommit={(value) => patchQualifiedStyle({ titleFontSize: value })} /></label><PaletteColorField label="Cor do título" value={selectedQualifiedStyle.titleColor} palette={currentPalette} onChange={(value) => patchQualifiedStyle({ titleColor: value })} /></div></> : null}<label>Fundo dos cards<select value={selectedQualifiedStyle.backgroundType} onChange={(event) => patchQualifiedStyle({ backgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedQualifiedStyle.backgroundType === 'color' ? <PaletteColorField label="Cor do fundo" value={selectedQualifiedStyle.backgroundColor} palette={currentPalette} onChange={(value) => patchQualifiedStyle({ backgroundColor: value })} /> : null}{selectedQualifiedStyle.backgroundType === 'image' ? <div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedQualifiedStyle.backgroundUrl ? 'Trocar fundo dos cards' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadQualifiedBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('qualified')}><Images size={13} /> Biblioteca</button></div> : null}</> : null}
              {selectedMvpStyle ? <><div className="post-artworks-subtitle"><strong>{selectedBlock.type === 'kills_leaders' ? 'Card de líder de abates' : selectedBlock.type === 'mvp_general_card' ? 'Card MVP Top 1' : selectedBlock.type === 'mvp_general' ? 'MVP Geral' : 'Card MVP'}</strong><small>{selectedBlock.type === 'mvp_general' ? 'Escolha Top 1 destacado + tabela ou somente tabela.' : 'Um jogador por bloco, independente da transmissão.'}</small></div>{selectedBlock.type === 'mvp_general' ? <label>Layout do MVP Geral<select value={selectedMvpStyle.layoutMode} onChange={(event) => patchMvpStyle({ layoutMode: event.target.value as 'card_table' | 'table_only' })}><option value="card_table">Top 1 em card + tabela</option><option value="table_only">Somente tabela</option></select></label> : null}<div className="post-artworks-grid2"><label>Largura do card<EditableNumberInput value={selectedMvpStyle.cardWidth} min={180} max={1600} onCommit={(value) => patchMvpStyle({ cardWidth: value })} /></label><label>Altura do card<EditableNumberInput value={selectedMvpStyle.cardHeight} min={220} max={2000} onCommit={(value) => patchMvpStyle({ cardHeight: value })} /></label><label>Tamanho da foto<EditableNumberInput value={selectedMvpStyle.imageSize} min={40} max={1000} onCommit={(value) => patchMvpStyle({ imageSize: value })} /></label><label>Espaçamento<EditableNumberInput value={selectedMvpStyle.gap} min={0} max={120} onCommit={(value) => patchMvpStyle({ gap: value })} /></label></div><div className="post-artworks-mvp-checks"><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showPhoto} onChange={(event) => patchMvpStyle({ showPhoto: event.target.checked })} /> Foto</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showTeam} onChange={(event) => patchMvpStyle({ showTeam: event.target.checked })} /> Equipe</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showKills} onChange={(event) => patchMvpStyle({ showKills: event.target.checked })} /> Abates</label><label className="post-artworks-check"><input type="checkbox" checked={selectedMvpStyle.showDrops} onChange={(event) => patchMvpStyle({ showDrops: event.target.checked })} /> Quedas</label></div>{selectedBlock.type === 'mvp_general' ? <><div className="post-artworks-subtitle"><strong>Tabela do ranking</strong><small>{selectedMvpStyle.layoutMode === 'card_table' ? 'Exibe do Top 2 até a posição escolhida.' : 'Exibe do Top 1 até a posição escolhida.'}</small></div><div className="post-artworks-grid2"><label>Largura da tabela<EditableNumberInput value={selectedMvpStyle.tableWidth} min={260} max={1800} onCommit={(value) => patchMvpStyle({ tableWidth: value })} /></label><label>Altura da linha<EditableNumberInput value={selectedMvpStyle.tableRowHeight} min={24} max={180} onCommit={(value) => patchMvpStyle({ tableRowHeight: value })} /></label><label>Espaço entre linhas<EditableNumberInput value={selectedMvpStyle.tableRowGap} min={0} max={80} onCommit={(value) => patchMvpStyle({ tableRowGap: value })} /></label><label>Tamanho do texto<EditableNumberInput value={selectedMvpStyle.tableFontSize} min={8} max={80} onCommit={(value) => patchMvpStyle({ tableFontSize: value })} /></label><PaletteColorField label="Cor do texto" value={selectedMvpStyle.tableTextColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ tableTextColor: value })} /></div><label>Fundo das linhas<select value={selectedMvpStyle.tableBackgroundType} onChange={(event) => patchMvpStyle({ tableBackgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedMvpStyle.tableBackgroundType === 'color' ? <PaletteColorField label="Cor das linhas" value={selectedMvpStyle.tableBackgroundColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ tableBackgroundColor: value })} /> : null}</> : null}</> : null}
            </>}
            <div className="post-artworks-actions"><button type="button" className="post-artworks-primary" onClick={() => void saveProject()} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar template</button><button type="button" className="post-artworks-download" onClick={() => void exportArtwork()} disabled={exporting}>{exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />} {draft.slice_count > 1 ? 'Baixar carrossel' : 'Baixar imagem'}</button>{selectedBlock ? <button type="button" className="post-artworks-secondary" onClick={() => setSelectedBlockId('')}>Editar projeto</button> : null}<button type="button" className="post-artworks-danger" onClick={() => void deleteProject()} disabled={saving}><Trash2 size={14} /> Excluir arte</button></div>
          </section>

          <main className="post-artworks-preview-panel">
            <div className="post-artworks-panel-title post-artworks-preview-toolbar"><div><strong>Área de trabalho</strong><small>Arraste os blocos. Scroll dá zoom no ponto do mouse; arraste o fundo para mover a tela.</small></div><div className="post-artworks-zoom-actions"><button type="button" onClick={() => changePreviewZoom(100)}>100%</button><button type="button" onClick={() => changePreviewZoom(previewZoom - 10)}>-</button><b>{previewZoom}%</b><button type="button" onClick={() => changePreviewZoom(previewZoom + 10)}>+</button><button type="button" onClick={() => changePreviewZoom(Math.round((1 / fitPreviewScale) * 100))}>Ajustar</button></div></div>
            <div ref={previewShellRef} className="post-artworks-preview-shell" onWheel={handlePreviewWheel} onPointerDown={beginPan} onPointerMove={panPreview} onPointerUp={endPan} onPointerCancel={endPan}>
              <div className="post-artworks-preview" style={{ width: draft.width * previewScale, height: draft.height * previewScale, backgroundColor: draft.background_color, backgroundImage: draft.background_url ? `url(${JSON.stringify(draft.background_url)})` : undefined }}>
                {Array.from({ length: Math.max(0, draft.slice_count - 1) }, (_, index) => <span key={index} className={`post-artworks-slice-line ${draft.slice_direction}`} style={draft.slice_direction === 'horizontal' ? { left: draft.slice_width * (index + 1) * previewScale } : { top: draft.slice_height * (index + 1) * previewScale }} />)}
                {draft.blocks.filter((block) => block.visible && block.type === 'qualified_teams').map((rawBlock) => {
                  const block = resolveBlockForGame(rawBlock, editorReferenceGame)
                  const style = normalizeQualifiedStyle(block)
                  const rows = rowsForBlock(block, standings, dayStandings)
                  const limit = Math.max(0, Number(block.dataEnd || 0))
                  const qualifiedRows = limit > 0 ? rows.slice(0, limit) : []
                  const eliminatedRows = limit > 0 ? rows.slice(limit) : []
                  const cardStyle = {
                    width: style.cardWidth * previewScale,
                    height: style.cardHeight * previewScale,
                    backgroundColor: style.backgroundType === 'color' ? style.backgroundColor : 'transparent',
                    backgroundImage: style.backgroundType === 'image' && style.backgroundUrl ? `url(${JSON.stringify(style.backgroundUrl)})` : undefined,
                  }
                  const renderCards = (items: PostArtworkTeamRow[]) => <div className="post-artworks-qualified-grid" style={{ gridTemplateColumns: `repeat(${style.columns}, ${style.cardWidth * previewScale}px)`, gap: style.gap * previewScale }}>{items.map((row) => <div key={`${block.id}-${row.rank}`} className="post-artworks-qualified-card" style={cardStyle}>{row.logo ? <img src={row.logo} alt="" draggable={false} style={{ width: `${style.logoScale * 100}%`, height: `${style.logoScale * 100}%` }} /> : null}</div>)}</div>
                  return <div key={block.id} className={`post-artworks-qualified-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: qualifiedVisualWidth(style) * previewScale, height: qualifiedVisualHeight(style, qualifiedRows.length, eliminatedRows.length) * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { dragRef.current = null }}>
                    {style.showTitles ? <strong className="post-artworks-qualified-title" style={{ color: style.titleColor, fontSize: Math.max(8, style.titleFontSize * previewScale), fontWeight: style.titleFontWeight, marginBottom: 12 * previewScale }}>{style.qualifiedTitle}</strong> : null}
                    {renderCards(qualifiedRows)}
                    <div className="post-artworks-qualified-eliminated" style={{ marginTop: (style.sectionGap + style.eliminatedOffsetY) * previewScale, marginLeft: style.eliminatedOffsetX * previewScale }}>{style.showTitles ? <strong className="post-artworks-qualified-title" style={{ color: style.titleColor, fontSize: Math.max(8, style.titleFontSize * previewScale), fontWeight: style.titleFontWeight, marginBottom: 12 * previewScale }}>{style.eliminatedTitle}</strong> : null}{renderCards(eliminatedRows)}</div>
                    {!rows.length ? <div className="post-artworks-no-data">{!block.source?.jogoId ? 'Selecione o jogo classificatório' : 'Sem classificação para este jogo'}</div> : null}
                  </div>
                })}
                {draft.blocks.filter((block) => block.visible && (block.type === 'table_general' || block.type === 'table_day')).map((rawBlock) => {
                  const block = resolveBlockForGame(rawBlock, editorReferenceGame)
                  const style = normalizeTableStyle(block)
                  const blockRows = sliceRows(rowsForBlock(block, standings, dayStandings), block)
                  const columns = style.columns.filter((column) => column.enabled)
                  return <div key={block.id} className={`post-artworks-table-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: tableVisualWidth(style) * previewScale, height: tableVisualHeight(style, blockRows.length) * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {style.showHeader ? <div className="post-artworks-table-row header" style={{ height: style.headerHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale, backgroundColor: style.headerBackgroundType === 'color' ? style.headerBackgroundColor : 'transparent', backgroundImage: style.headerBackgroundType === 'image' && style.headerBackgroundUrl ? `url(${JSON.stringify(style.headerBackgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>{columns.map((column) => <div key={column.key} style={{ width: column.width * previewScale, background: 'transparent', color: style.headerColor, fontSize: Math.max(7, style.headerFontSize * previewScale), fontWeight: style.headerFontWeight, fontFamily: style.headerFontFamily }}>{column.label}</div>)}</div> : null}
                    {blockRows.map((row) => <div key={`${block.id}-${row.rank}`} className="post-artworks-table-row" style={{ height: style.rowHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} className={`cell align-${column.align}`} style={{ width: column.width * previewScale, color: column.color, fontSize: Math.max(7, column.fontSize * previewScale), fontWeight: column.fontWeight, backgroundColor: column.backgroundType === 'color' ? column.backgroundColor : 'transparent', backgroundImage: column.backgroundType === 'image' && column.backgroundUrl ? `url(${JSON.stringify(column.backgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>{column.key === 'logo' ? (row.logo ? <img src={row.logo} alt="" draggable={false} /> : null) : column.key === 'movement' ? <span className={`post-artworks-movement ${movementClass(row.movement)}`}>{movementLabel(row.movement)}</span> : cellValue(row, column.key)}</div>)}</div>)}
                    {!blockRows.length ? <div className="post-artworks-no-data">{(block.type === 'table_day' || block.type === 'booyahs_day') && !block.source?.jogoId ? 'Selecione o jogo do bloco' : 'Sem dados nessa faixa'}</div> : null}
                  </div>
                })}
                {draft.blocks.filter((block) => block.visible && block.type === 'booyahs_day').map((rawBlock) => {
                  const block = resolveBlockForGame(rawBlock, editorReferenceGame)
                  const style = normalizeBooyahStyle(block)
                  const rows = (booyahDay[block.source?.jogoId || ''] || []).slice(Math.max(0, (block.dataStart || 1) - 1), Math.max(1, block.dataEnd || 12))
                  const cardWidth = booyahCardWidth(style, rows.length || 1)
                  return <div key={block.id} className={`post-artworks-booyah-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: style.totalWidth * previewScale, height: style.cardHeight * previewScale, gap: style.gap * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
                    {rows.map((row) => {
                      const mediaHeight = style.cardHeight * .55 * previewScale
                      const titleHeight = style.cardHeight * .2 * previewScale
                      const statsHeight = style.cardHeight * .25 * previewScale
                      const mediaBackground = style.mediaBackgroundUrl || row.mapImage
                      return <div key={row.partidaId} className="post-artworks-booyah-card" style={{ width: cardWidth * previewScale, height: style.cardHeight * previewScale, backgroundColor: style.backgroundColor, color: style.textColor }}><div className="post-artworks-booyah-media" style={{ height: mediaHeight, backgroundImage: mediaBackground ? `linear-gradient(rgba(0,0,0,.34),rgba(0,0,0,.34)),url(${JSON.stringify(mediaBackground)})` : undefined }}>{row.logo ? <img src={row.logo} alt="" draggable={false} style={{ maxWidth: cardWidth * style.logoScale * previewScale, maxHeight: style.cardHeight * .34 * previewScale }} /> : null}</div><strong style={{ height: titleHeight, backgroundColor: style.titleBackgroundUrl ? 'transparent' : style.accentColor, backgroundImage: style.titleBackgroundUrl ? `url(${JSON.stringify(style.titleBackgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', fontSize: Math.max(7, style.teamFontSize * previewScale) }}>{row.mapName}</strong><div className="post-artworks-booyah-stats" style={{ height: statsHeight, backgroundColor: style.statsBackgroundUrl ? 'transparent' : style.backgroundColor, backgroundImage: style.statsBackgroundUrl ? `url(${JSON.stringify(style.statsBackgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', fontSize: Math.max(6, style.statsFontSize * previewScale) }}><b>{row.points} PTS</b><b>{row.kills} ABT</b></div></div>
                    })}
                    {!rows.length ? <div className="post-artworks-no-data">{!block.source?.jogoId ? 'Selecione o jogo do bloco' : 'Sem booyah registrado nas quedas deste jogo'}</div> : null}
                  </div>
                })}
                {draft.blocks.filter((block) => block.visible && block.type === 'mvp_general_table').map((block) => {
                  const style = normalizeTableStyle(block)
                  const rows = mvpGeneral.slice(Math.max(0, (block.dataStart || 2) - 1), Math.max(1, block.dataEnd || 10))
                  const columns = style.columns.filter((column) => column.enabled)
                  return <div key={block.id} className={`post-artworks-table-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: tableVisualWidth(style) * previewScale, height: tableVisualHeight(style, rows.length) * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>{style.showHeader ? <div className="post-artworks-table-row header" style={{ height: style.headerHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} style={{ width: column.width * previewScale, color: style.headerColor, fontSize: Math.max(7, style.headerFontSize * previewScale), fontWeight: style.headerFontWeight, fontFamily: style.headerFontFamily }}>{column.label}</div>)}</div> : null}{rows.map((row) => <div key={`${block.id}-${row.rank}`} className="post-artworks-table-row" style={{ height: style.rowHeight * previewScale, gap: style.cellGap * previewScale, marginBottom: style.rowGap * previewScale }}>{columns.map((column) => <div key={column.key} className={`cell align-${column.align}`} style={{ width: column.width * previewScale, color: column.color, fontSize: Math.max(7, column.fontSize * previewScale), fontWeight: column.fontWeight, backgroundColor: column.backgroundType === 'color' ? column.backgroundColor : 'transparent', backgroundImage: column.backgroundType === 'image' && column.backgroundUrl ? `url(${JSON.stringify(column.backgroundUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>{mvpTableCellValue(row, column.key)}</div>)}</div>)}</div>
                })}
                {draft.blocks.filter((block) => block.visible && (block.type === 'mvp_general' || block.type === 'mvp_general_card' || block.type === 'mvp_day' || block.type === 'kills_leaders')).map((rawBlock) => {
                  const block = resolveBlockForGame(rawBlock, editorReferenceGame)
                  const style = normalizeMvpStyle(block)
                  const rows = playerRowsForBlock(block, mvpGeneral, mvpDay, killLeaders)
                  const player = playerForBlock(block, mvpGeneral, mvpDay, killLeaders)
                  const card = (cardPlayer: PostArtworkPlayerRow | null) => <div className="post-artworks-mvp-card-inner" style={{ width: style.cardWidth * previewScale, height: style.cardHeight * previewScale, gap: style.gap * previewScale, backgroundColor: style.backgroundType === 'color' ? style.backgroundColor : 'transparent', backgroundImage: style.backgroundType === 'image' && style.backgroundUrl ? `url(${JSON.stringify(style.backgroundUrl)})` : undefined }}>{cardPlayer ? <>{style.showPhoto ? <div className="post-artworks-mvp-photo" style={{ width: style.imageSize * previewScale, height: style.imageSize * previewScale, borderRadius: style.imageRadius * previewScale }}>{cardPlayer.photo ? <img src={cardPlayer.photo} alt="" draggable={false} /> : <span>{cardPlayer.nick.slice(0, 1)}</span>}</div> : null}<strong style={{ color: style.nameColor, fontSize: Math.max(8, style.nameFontSize * previewScale), fontWeight: style.nameFontWeight }}>{cardPlayer.nick}</strong>{style.showTeam && cardPlayer.team ? <small style={{ color: style.teamColor, fontSize: Math.max(7, style.teamFontSize * previewScale) }}>{cardPlayer.team}</small> : null}<div className="post-artworks-mvp-stats" style={{ color: style.statsColor, fontSize: Math.max(7, style.statsFontSize * previewScale) }}>{style.showKills ? <b>{cardPlayer.kills}<small>ABATES</small></b> : null}{style.showDrops ? <b>{cardPlayer.drops}<small>QUEDAS</small></b> : null}</div></> : null}</div>
                  const table = (tableRows: PostArtworkPlayerRow[]) => <div className="post-artworks-mvp-ranking-table" style={{ width: style.tableWidth * previewScale, gap: style.tableRowGap * previewScale }}>{tableRows.map((row) => <div key={`${block.id}-rank-${row.rank}`} className="post-artworks-mvp-ranking-row" style={{ height: style.tableRowHeight * previewScale, color: style.tableTextColor, fontSize: Math.max(7, style.tableFontSize * previewScale), backgroundColor: style.tableBackgroundType === 'color' ? style.tableBackgroundColor : 'transparent', backgroundImage: style.tableBackgroundType === 'image' && style.tableBackgroundUrl ? `url(${JSON.stringify(style.tableBackgroundUrl)})` : undefined }}><b style={{ width: style.tableRankWidth * previewScale }}>{row.rank}</b><strong>{row.nick}</strong><span style={{ width: style.tableTeamWidth * previewScale }}>{row.team}</span><em>{row.kills}</em></div>)}</div>
                  if (block.type === 'mvp_general') return <div key={block.id} className={`post-artworks-mvp-block post-artworks-mvp-general${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: mvpVisualWidth(block, style) * previewScale, height: mvpVisualHeight(block, style) * previewScale, gap: style.gap * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>{style.layoutMode === 'table_only' ? table(rows) : <>{card(rows[0] || null)}{rows.length > 1 ? table(rows.slice(1)) : null}</>}{!rows.length ? <div className="post-artworks-no-data">Sem dados de MVP</div> : null}</div>
                  return <div key={block.id} className={`post-artworks-mvp-block${block.id === selectedBlockId ? ' active' : ''}`} style={{ left: block.x * previewScale, top: block.y * previewScale, width: style.cardWidth * previewScale, height: style.cardHeight * previewScale }} onPointerDown={(event) => beginDrag(event, block)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>{card(player)}{!player ? <div className="post-artworks-no-data">{(block.type === 'mvp_day' || block.type === 'kills_leaders') && !block.source?.jogoId ? 'Selecione o jogo do bloco' : 'Sem dados de MVP'}</div> : null}</div>
                })}
                {!userBlocks(draft).length ? <div className="post-artworks-canvas-empty"><strong>Adicione um bloco de estatística</strong><span>Use Tabela Geral para o acumulado ou selecione um jogo nos blocos específicos.</span></div> : null}
              </div>
            </div>
          </main>

          <aside className="post-artworks-blocks-panel">
            <div className="post-artworks-panel-title"><strong>Blocos da arte</strong><small>Independentes da transmissão</small></div>
            <div className="post-artworks-add-blocks"><button type="button" className="post-artworks-add-block" onClick={addGeneralTable}><Plus size={14} /> Tabela Geral</button><button type="button" className="post-artworks-add-block" onClick={addDayTable}><Plus size={14} /> Tabela do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addQualifiedTeams}><Plus size={14} /> Classificados</button><button type="button" className="post-artworks-add-block" onClick={addBooyahsDay}><Plus size={14} /> Booyahs do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addMvpGeneral}><Plus size={14} /> Card MVP Top 1</button><button type="button" className="post-artworks-add-block" onClick={addMvpGeneralTable}><Plus size={14} /> Tabela MVP</button><button type="button" className="post-artworks-add-block" onClick={addMvpDay}><Plus size={14} /> MVP do Jogo</button><button type="button" className="post-artworks-add-block" onClick={addKillLeaders}><Plus size={14} /> Líderes de Abates</button></div>
            <div className="post-artworks-block-list">{userBlocks(draft).map((rawBlock) => {
              const block = resolveBlockForGame(rawBlock, editorReferenceGame)
              const isGameDataBlock = GAME_DATA_BLOCK_TYPES.has(block.type)
              return <article key={rawBlock.id} className={rawBlock.id === selectedBlockId ? 'active' : ''}><button type="button" className="post-artworks-block-select" onClick={() => setSelectedBlockId(rawBlock.id)}><small>{block.type === 'table_day' ? 'TABELA DO JOGO' : block.type === 'qualified_teams' ? 'CLASSIFICADOS' : block.type === 'booyahs_day' ? 'BOOYAHS DO JOGO' : block.type === 'mvp_day' ? 'MVP DO JOGO' : block.type === 'kills_leaders' ? 'LÍDERES DE ABATES' : block.type === 'mvp_general_card' ? 'CARD MVP TOP 1' : block.type === 'mvp_general_table' ? 'TABELA MVP' : block.type === 'mvp_general' ? 'MVP GERAL' : 'TABELA GERAL'}</small><strong>{rawBlock.name}</strong><span>{isGameDataBlock ? `${editorReferenceGame ? `Prévia: ${editorReferenceGame.nome}` : 'Prévia sem jogo'} · ` : ''}{block.type === 'qualified_teams' ? (block.dataEnd && block.dataEnd > 0 ? `Top ${block.dataEnd} passam` : 'Quantidade definida pelo jogo') : block.type === 'mvp_general' ? `Top 1–${block.dataEnd || 10}` : block.type === 'mvp_day' || block.type === 'kills_leaders' ? `Top ${block.dataStart || 1}` : `Top ${block.dataStart || 1}–${block.dataEnd || 12}`}</span></button><div><button type="button" title="Duplicar e avançar a faixa" onClick={() => duplicateBlock(rawBlock)}><Copy size={13} /></button><button type="button" title="Excluir bloco" onClick={() => deleteBlock(rawBlock.id)}><Trash2 size={13} /></button></div></article>
            })}</div>
            {selectedBlock && selectedMvpStyle ? <div className="post-artworks-column-editor"><div className="post-artworks-subtitle"><strong>{selectedBlock.type === 'kills_leaders' ? 'Visual do líder de abates' : 'Visual do MVP'}</strong><small>Fundo, foto e textos do card.</small></div><label>Fundo<select value={selectedMvpStyle.backgroundType} onChange={(event) => patchMvpStyle({ backgroundType: event.target.value as 'color' | 'image' })}><option value="color">Cor</option><option value="image">Imagem</option></select></label>{selectedMvpStyle.backgroundType === 'color' ? <PaletteColorField label="Cor do fundo" value={selectedMvpStyle.backgroundColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ backgroundColor: value })} /> : null}<div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedMvpStyle.backgroundUrl ? 'Trocar fundo do card' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadMvpBackground(event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('mvp')}><Images size={13} /> Biblioteca</button></div><div className="post-artworks-grid2"><label>Nome<EditableNumberInput value={selectedMvpStyle.nameFontSize} min={8} max={160} onCommit={(value) => patchMvpStyle({ nameFontSize: value })} /></label><label>Equipe<EditableNumberInput value={selectedMvpStyle.teamFontSize} min={8} max={120} onCommit={(value) => patchMvpStyle({ teamFontSize: value })} /></label><label>Estatísticas<EditableNumberInput value={selectedMvpStyle.statsFontSize} min={8} max={140} onCommit={(value) => patchMvpStyle({ statsFontSize: value })} /></label><label>Raio da foto<EditableNumberInput value={selectedMvpStyle.imageRadius} min={0} max={500} onCommit={(value) => patchMvpStyle({ imageRadius: value })} /></label></div><div className="post-artworks-grid2"><PaletteColorField label="Cor do nome" value={selectedMvpStyle.nameColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ nameColor: value })} /><PaletteColorField label="Cor da equipe" value={selectedMvpStyle.teamColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ teamColor: value })} /><PaletteColorField label="Cor dos números" value={selectedMvpStyle.statsColor} palette={currentPalette} onChange={(value) => patchMvpStyle({ statsColor: value })} /></div></div> : null}
            {selectedBlock && selectedTableStyle ? <div className="post-artworks-column-editor"><div className="post-artworks-subtitle"><strong>Colunas</strong><small>Ative, dimensione e aplique fundo por célula.</small></div><div className="post-artworks-column-tabs">{selectedTableStyle.columns.map((column) => <button type="button" key={column.key} className={selectedColumnKey === column.key ? 'active' : ''} onClick={() => setSelectedColumnKey(column.key)}>{TABLE_COLUMN_META[column.key].label || 'LOGO'}</button>)}</div>{selectedColumn ? <><label className="post-artworks-check"><input type="checkbox" checked={selectedColumn.enabled} onChange={(event) => patchColumn(selectedColumn.key, { enabled: event.target.checked })} /> Exibir coluna</label><label>Largura<EditableNumberInput value={selectedColumn.width} min={30} max={1000} onCommit={(value) => patchColumn(selectedColumn.key, { width: value })} /></label><label>Legenda<input value={selectedColumn.label} onChange={(event) => patchColumn(selectedColumn.key, { label: event.target.value })} /></label><div className="post-artworks-palette-shortcuts"><small>CORES DO PROJETO</small><div>{currentPalette.map((color) => <button key={color} type="button" title={`Usar ${color} no fundo`} style={{ background: color }} onClick={() => patchColumn(selectedColumn.key, { backgroundType: 'color', backgroundColor: color })} />)}</div></div><label>Fundo<select value={selectedColumn.backgroundType} onChange={(event) => patchColumn(selectedColumn.key, { backgroundType: event.target.value as 'color' | 'image' | 'none' })}><option value="color">Cor</option><option value="image">Imagem</option><option value="none">Sem fundo</option></select></label>{selectedColumn.backgroundType === 'color' ? <PaletteColorField label="Cor do fundo" value={selectedColumn.backgroundColor} palette={currentPalette} onChange={(value) => patchColumn(selectedColumn.key, { backgroundColor: value })} /> : null}<div className="post-artworks-inline-actions"><label className="post-artworks-upload">{uploadingCell ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {selectedColumn.backgroundUrl ? 'Trocar fundo das células' : 'Upload do fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadColumnBackground(selectedColumn.key, event.target.files?.[0])} /></label><button type="button" className="post-artworks-secondary post-artworks-library-button" onClick={() => openAssetLibrary('column')}><Images size={13} /> Biblioteca</button></div>{selectedColumn.key !== 'logo' ? <div className="post-artworks-grid2"><label>Tamanho do texto<EditableNumberInput value={selectedColumn.fontSize} min={8} max={120} onCommit={(value) => patchColumn(selectedColumn.key, { fontSize: value })} /></label><label>Peso<EditableNumberInput value={selectedColumn.fontWeight} min={100} max={900} onCommit={(value) => patchColumn(selectedColumn.key, { fontWeight: value })} /></label><PaletteColorField label="Cor do texto" value={selectedColumn.color} palette={currentPalette} onChange={(value) => patchColumn(selectedColumn.key, { color: value })} /><label>Alinhamento<select value={selectedColumn.align} onChange={(event) => patchColumn(selectedColumn.key, { align: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div> : null}</> : null}</div> : null}
          </aside>
        </> : <section className="post-artworks-welcome"><strong>Crie ou selecione uma arte</strong><span>O editor de redes sociais é independente da transmissão.</span></section>}
      </div>
      {libraryOpen ? <div className="post-artworks-library-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLibraryOpen(false) }}><section className="post-artworks-library"><header><div><small>BIBLIOTECA DO CAMPEONATO</small><strong>Imagens reutilizáveis</strong><span>Uploads de fundo, células e cards ficam disponíveis aqui para outras artes.</span></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Fechar biblioteca"><X size={18} /></button></header>{libraryError ? <div className="post-artworks-library-error">{libraryError}</div> : null}<div className="post-artworks-library-grid">{assets.map((asset) => <article key={asset.id}><button type="button" className="post-artworks-library-pick" onClick={() => applyLibraryAsset(asset)}><span className="post-artworks-library-thumb" style={{ backgroundImage: `url(${JSON.stringify(asset.url)})` }} /><b>{asset.name}</b><small>{asset.kind === 'background' ? 'Fundo de arte' : asset.kind === 'cell' ? 'Fundo de célula' : asset.kind === 'card' ? 'Fundo de card' : 'Imagem'}</small></button><button type="button" className="post-artworks-library-delete" title="Remover da biblioteca" onClick={() => void deleteLibraryAsset(asset.id)}><Trash2 size={13} /></button></article>)}{!assets.length ? <div className="post-artworks-library-empty"><Images size={28} /><strong>Nenhuma imagem salva ainda</strong><span>Envie um fundo na arte, numa coluna ou num card MVP. O arquivo entra automaticamente na biblioteca.</span></div> : null}</div></section></div> : null}
    </div>
  )
}
