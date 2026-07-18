import { supabase } from '@/lib/supabase-browser'
import type {
  StreamOverlay,
  StreamSheetFilters,
  StreamSheetId,
  StreamSheetRow,
} from '../types/stream.types'
import { resolveSheetId } from '../types/stream.types'
import { migrateOverlay } from '../utils/migrate-overlay'

async function authFetch(url: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Falha ao carregar dados do stream.')
  return payload
}

function text(value: unknown) {
  if (value == null) return ''
  return String(value)
}

/** Só a letra do grupo (A, B, C…). */
export function grupoLetter(raw: unknown): string {
  const s = text(raw).trim()
  if (!s) return ''
  const m = s.match(/\b([A-Za-z])\b/) || s.match(/([A-Za-z])/)
  return (m?.[1] || s.charAt(0)).toUpperCase()
}

/** Cidade a partir de localidade (corta estado). */
export function onlyCity(localidade: unknown): string {
  const s = text(localidade).trim()
  if (!s) return ''
  return s.split(/[-–,|/]/)[0].trim()
}

const MAP_IMAGES: Record<string, string> = {
  bermuda: '/images/maps/bermuda.png',
  purgatorio: '/images/maps/purgatorio.png',
  purgatório: '/images/maps/purgatorio.png',
  'nova terra': '/images/maps/nova-terra.png',
  'nova-terra': '/images/maps/nova-terra.png',
  kalahari: '/images/maps/kalahari.png',
  alpine: '/images/maps/alpine.png',
  solara: '/images/maps/solara.png',
  misterioso: '/images/maps/misterioso.png',
}

export function mapImageFor(name: string) {
  const key = String(name || '').toLowerCase()
  const hit = Object.entries(MAP_IMAGES).find(([k]) => key.includes(k))
  return hit?.[1] || '/images/maps/bermuda.png'
}

function formatDelta(delta: number): string {
  if (!delta) return '0 ='
  if (delta > 0) return `+${delta} ▲`
  return `${delta} ▼`
}

function qs(filters?: StreamSheetFilters) {
  if (!filters) return ''
  const p = new URLSearchParams()
  if (filters.mapa_codigo) p.set('mapa_codigo', filters.mapa_codigo)
  if (filters.jogo_id) p.set('jogo_id', filters.jogo_id)
  if (filters.fase_id) p.set('fase_id', filters.fase_id)
  if (filters.grupo_id) p.set('grupo_id', filters.grupo_id)
  if (filters.partida_id) p.set('partida_id', filters.partida_id)
  const s = p.toString()
  return s ? `?${s}` : ''
}

type MetaTeam = {
  id: string
  nome: string
  tag: string
  logo: string
  grupo: string
  grupoId: string
}

async function loadTeamMeta(campeonatoId: string): Promise<Map<string, MetaTeam>> {
  const map = new Map<string, MetaTeam>()
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/equipes`)
    const vagas = Array.isArray(payload.vagas) ? payload.vagas : []
    for (const v of vagas) {
      const ce = v.campeonato_equipe || {}
      const id = text(ce.id || v.campeonato_equipe_id || '')
      if (!id) continue
      map.set(id, {
        id,
        nome: text(v.line_nome || ce.line_nome || ce.nome_exibicao || ''),
        tag: text(v.line_tag || ce.line_tag || ''),
        logo: text(v.line_logo_url || ce.line_logo_url || ''),
        grupo: grupoLetter(v.grupo?.nome || v.grupo_nome || ce.grupo_nome || ''),
        grupoId: text(v.grupo?.id || v.grupo_id || ce.grupo_id || ''),
      })
    }
  } catch {
    // ignore
  }
  return map
}

type PlayerMeta = {
  nick: string
  foto: string
  funcao: string
  cidade: string
  equipeId: string
  logo: string
  tag: string
  grupo: string
}

async function loadPlayerMeta(campeonatoId: string): Promise<Map<string, PlayerMeta>> {
  const byNick = new Map<string, PlayerMeta>()
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogadores`)
    const parts = Array.isArray(payload.participacoes) ? payload.participacoes : []
    for (const line of parts) {
      const logo = text(line.line?.logo_url || line.equipe?.logo_url || '')
      const tag = text(line.line?.tag || line.equipe?.tag || '')
      const grupo = grupoLetter(line.grupo_nome || line.grupo?.nome || '')
      const equipeId = text(line.id || '')
      for (const p of line.jogadores || []) {
        const nick = text(p.nick || '').toLowerCase()
        if (!nick) continue
        byNick.set(nick, {
          nick: text(p.nick),
          foto: text(p.foto_url || p.avatar_url || ''),
          funcao: text(p.funcao || ''),
          cidade: onlyCity(p.localidade),
          equipeId,
          logo,
          tag,
          grupo,
        })
      }
    }
  } catch {
    // ignore
  }
  return byNick
}

type FlatPartida = {
  id: string
  jogoId: string
  jogoNome: string
  faseId: string
  numero: number
  mapa: string
  mapaCodigo: string
  status: string
  horario: string
}

type FlatPartidaEx = FlatPartida & { mapaImagem?: string }

/** Partidas/quedas via API stream (service_role) — fonte confiável do pontuador. */
async function loadPartidasFlat(campeonatoId: string): Promise<FlatPartidaEx[]> {
  // 1) endpoint dedicado stream (lê campeonato_partidas_com_mapa direto)
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/data?sheet=partidas`)
    const list = Array.isArray(payload.partidas) ? payload.partidas : []
    if (list.length) {
      return list.map((p: any) => ({
        id: text(p.id),
        jogoId: text(p.jogoId || p.jogo_id),
        jogoNome: text(p.jogoNome || p.jogo_nome || ''),
        faseId: text(p.faseId || p.fase_id || ''),
        numero: Number(p.numero || p.numero_partida || 0),
        mapa: text(p.mapa || p.mapa_nome || p.mapaCodigo || '—'),
        mapaCodigo: text(p.mapaCodigo || p.mapa_codigo || ''),
        mapaImagem: text(p.mapaImagem || p.mapa_imagem || ''),
        status: text(p.status || ''),
        horario: text(p.horario || ''),
      })).filter((p: FlatPartidaEx) => p.id)
    }
  } catch {
    // fallback abaixo
  }

  // 2) fallback: /jogos + quedas aninhadas ou por jogo
  let jogos: any[] = []
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogos`)
    jogos = Array.isArray(payload.jogos) ? payload.jogos : []
  } catch {
    try {
      const payload = await authFetch(`/api/campeonatos/${campeonatoId}/pontuador/jogos`)
      jogos = Array.isArray(payload.jogos) ? payload.jogos : []
    } catch {
      jogos = []
    }
  }

  const out: FlatPartidaEx[] = []
  for (const jogo of jogos) {
    let quedas = Array.isArray(jogo.quedas) ? jogo.quedas : []
    if (!quedas.length && jogo.id) {
      try {
        const q = await authFetch(`/api/campeonatos/${campeonatoId}/jogos/${jogo.id}/quedas`)
        quedas = Array.isArray(q.quedas) ? q.quedas : []
      } catch {
        try {
          const d = await authFetch(`/api/campeonatos/${campeonatoId}/jogos/${jogo.id}`)
          quedas = Array.isArray(d.quedas) ? d.quedas : []
        } catch {
          quedas = []
        }
      }
    }
    for (const q of quedas) {
      const id = text(q.id || q.partida_id)
      if (!id) continue
      const mapa = text(q.mapa_nome || q.mapa_codigo || q.nome_mapa || '—')
      out.push({
        id,
        jogoId: text(jogo.id || q.jogo_id),
        jogoNome: text(jogo.nome || ''),
        faseId: text(jogo.fase_id || q.fase_id || ''),
        numero: Number(q.numero_partida ?? q.numero ?? 0),
        mapa,
        mapaCodigo: text(q.mapa_codigo || mapa),
        mapaImagem: text(q.mapa_imagem_url || q.imagem_url || ''),
        status: text(q.status || ''),
        horario: text(q.horario || jogo.horario || ''),
      })
    }
  }
  return out
}

async function loadEquipeStats(campeonatoId: string, filters?: StreamSheetFilters) {
  const payload = await authFetch(`/api/campeonatos/${campeonatoId}/estatisticas/equipes${qs(filters)}`)
  return Array.isArray(payload.equipes) ? payload.equipes : []
}

async function loadMvpStats(campeonatoId: string, filters?: StreamSheetFilters) {
  const payload = await authFetch(`/api/campeonatos/${campeonatoId}/estatisticas/mvp${qs(filters)}`)
  return Array.isArray(payload.jogadores) ? payload.jogadores : []
}

/** Compara colocação atual vs anterior (positivo = subiu no ranking). */
function deltaMap(current: Array<{ id: string; pos: number }>, previous: Array<{ id: string; pos: number }>) {
  const prev = new Map(previous.map((r) => [r.id, r.pos]))
  const out = new Map<string, number>()
  for (const row of current) {
    const before = prev.get(row.id)
    if (before == null) out.set(row.id, 0)
    else out.set(row.id, before - row.pos)
  }
  return out
}

async function previousPartidaId(partidas: FlatPartida[], currentPartidaId?: string): Promise<string | null> {
  if (!partidas.length) return null
  if (currentPartidaId) {
    const idx = partidas.findIndex((p) => p.id === currentPartidaId)
    if (idx > 0) return partidas[idx - 1].id
    return null
  }
  // última finalizada vs penúltima
  const done = partidas.filter((p) => /finaliz|conclu|encerr|done|finished/i.test(p.status) || p.status === 'finalizada')
  if (done.length >= 2) return done[done.length - 2].id
  if (partidas.length >= 2) return partidas[partidas.length - 2].id
  return null
}

function buildEquipeRows(
  equipes: any[],
  meta: Map<string, MetaTeam>,
  deltas: Map<string, number>,
  withDeathPos: boolean,
): StreamSheetRow[] {
  return equipes.map((row: any, index: number) => {
    const id = text(row.campeonato_equipe_id || row.id || `eq-${index}`)
    const m = meta.get(id)
    const pos = Number(row.colocacao ?? index + 1)
    const posMorte = text(row.melhor_posicao ?? row.posicao ?? pos)
    const d = deltas.get(id) ?? 0
    return {
      id,
      cells: {
        pos: text(pos),
        delta: formatDelta(d),
        logo: text(row.logo_url || m?.logo || ''),
        nome: text(row.nome || row.line_nome || m?.nome || '—'),
        grupo: text(m?.grupo || grupoLetter(row.grupo || row.grupo_nome || '')),
        quedas: text(row.quedas ?? 0),
        booyahs: text(row.booyahs ?? row.booyah ?? 0),
        abates: text(row.abates ?? 0),
        pontos: text(row.pontos_total ?? row.pontos ?? 0),
        ...(withDeathPos ? { pos_morte: posMorte } : {}),
      },
    }
  })
}

async function loadEquipesScoped(
  campeonatoId: string,
  filters: StreamSheetFilters | undefined,
  withDeathPos: boolean,
): Promise<StreamSheetRow[]> {
  const [meta, equipes, partidas] = await Promise.all([
    loadTeamMeta(campeonatoId),
    loadEquipeStats(campeonatoId, filters),
    loadPartidasFlat(campeonatoId).catch(() => [] as FlatPartida[]),
  ])

  const prevId = await previousPartidaId(partidas, filters?.partida_id)
  let deltas = new Map<string, number>()
  if (prevId) {
    try {
      const prevFilters: StreamSheetFilters = filters?.partida_id
        ? { partida_id: prevId }
        : { ...filters, partida_id: undefined }
      // para geral/mapa/jogo: compara ranking atual com ranking só até partida anterior
      // simplificado: ranking da partida anterior isolada
      const prevStats = await loadEquipeStats(
        campeonatoId,
        filters?.partida_id || filters?.mapa_codigo || filters?.jogo_id
          ? { ...filters, partida_id: prevId }
          : { partida_id: prevId },
      )
      const currRank = equipes.map((r: any, i: number) => ({
        id: text(r.campeonato_equipe_id || r.id),
        pos: Number(r.colocacao ?? i + 1),
      }))
      const prevRank = prevStats.map((r: any, i: number) => ({
        id: text(r.campeonato_equipe_id || r.id),
        pos: Number(r.colocacao ?? i + 1),
      }))
      deltas = deltaMap(currRank, prevRank)
    } catch {
      deltas = new Map()
    }
  }

  return buildEquipeRows(equipes, meta, deltas, withDeathPos)
}

async function loadMvpRows(campeonatoId: string, filters?: StreamSheetFilters): Promise<StreamSheetRow[]> {
  const [players, metaP, partidas] = await Promise.all([
    loadMvpStats(campeonatoId, filters),
    loadPlayerMeta(campeonatoId),
    loadPartidasFlat(campeonatoId).catch(() => [] as FlatPartida[]),
  ])

  const prevId = await previousPartidaId(partidas, filters?.partida_id)
  let deltas = new Map<string, number>()
  if (prevId) {
    try {
      const prev = await loadMvpStats(campeonatoId, { ...filters, partida_id: prevId })
      deltas = deltaMap(
        players.map((r: any, i: number) => ({
          id: text(r.campeonato_jogador_id || r.nick || i),
          pos: Number(r.colocacao ?? i + 1),
        })),
        prev.map((r: any, i: number) => ({
          id: text(r.campeonato_jogador_id || r.nick || i),
          pos: Number(r.colocacao ?? i + 1),
        })),
      )
    } catch {
      deltas = new Map()
    }
  }

  return players.map((row: any, index: number) => {
    const id = text(row.campeonato_jogador_id || `mvp-${index}`)
    const nick = text(row.nick || '—')
    const pm = metaP.get(nick.toLowerCase())
    const abates = Number(row.abates || 0)
    const quedas = Math.max(1, Number(row.quedas || 1))
    const kd = (abates / quedas).toFixed(1).replace('.', ',')
    const d = deltas.get(id) ?? 0
    return {
      id,
      cells: {
        pos: text(row.colocacao ?? index + 1),
        delta: formatDelta(d),
        foto: text(row.foto_url || pm?.foto || ''),
        logo: text(pm?.logo || ''),
        tag: text(pm?.tag || ''),
        nick,
        funcao: text(pm?.funcao || ''),
        cidade: text(pm?.cidade || ''),
        grupo: text(pm?.grupo || ''),
        quedas: text(row.quedas ?? 0),
        kd,
        abates: text(abates),
      },
    }
  })
}

async function loadMapasRows(campeonatoId: string): Promise<StreamSheetRow[]> {
  // Preferência: API stream monta mapas + booyah já no servidor
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/data?sheet=mapas`)
    if (Array.isArray(payload.rows) && payload.rows.length) {
      return payload.rows.map((r: any) => ({
        id: text(r.id),
        cells: {
          imagem: text(r.cells?.imagem || ''),
          nome: text(r.cells?.nome || ''),
          booyah_logo: text(r.cells?.booyah_logo || ''),
          booyah_nome: text(r.cells?.booyah_nome || '—'),
          pontos: text(r.cells?.pontos ?? 0),
          abates: text(r.cells?.abates ?? 0),
          jogo: text(r.cells?.jogo || ''),
          queda: text(r.cells?.queda || ''),
        },
      }))
    }
    // API ok mas 0 partidas cadastradas
    if (Array.isArray(payload.rows)) return []
  } catch {
    // fallback client-side
  }

  const partidas = await loadPartidasFlat(campeonatoId)
  const rows: StreamSheetRow[] = []
  for (const p of partidas) {
    if (!p.id) continue
    let winner: any = null
    let hasStats = false
    try {
      const stats = await loadEquipeStats(campeonatoId, { partida_id: p.id })
      hasStats = stats.length > 0
      winner =
        stats.find((e: any) => Number(e.booyahs) > 0)
        || stats.find((e: any) => Number(e.melhor_posicao) === 1)
        || stats[0]
        || null
    } catch {
      winner = null
    }
    rows.push({
      id: p.id,
      cells: {
        imagem: text((p as FlatPartidaEx).mapaImagem || mapImageFor(p.mapa)),
        nome: p.mapa.toUpperCase(),
        booyah_logo: text(winner?.logo_url || ''),
        booyah_nome: text(winner?.nome || winner?.line_nome || (hasStats ? '—' : 'sem pontuação')),
        pontos: text(winner?.pontos_total ?? 0),
        abates: text(winner?.abates ?? 0),
        jogo: p.jogoNome,
        queda: text(p.numero),
      },
    })
  }
  return rows
}

function pickCurrentAndNext(partidas: FlatPartida[]) {
  if (!partidas.length) return { current: null as FlatPartida | null, next: null as FlatPartida | null }
  // Prioridade: queda marcada como atual no pontuador (status em_andamento)
  const liveIdx = partidas.findIndex((p) => /em_andamento|andamento|live|ao.?vivo|em_jogo/i.test(p.status || ''))
  if (liveIdx >= 0) {
    return { current: partidas[liveIdx], next: partidas[liveIdx + 1] || null }
  }
  let lastDoneIdx = -1
  for (let i = 0; i < partidas.length; i++) {
    if (/finaliz|conclu|encerr|done|finished/i.test(partidas[i].status || '')) lastDoneIdx = i
  }
  if (lastDoneIdx >= 0) {
    return { current: partidas[lastDoneIdx], next: partidas[lastDoneIdx + 1] || null }
  }
  // nenhuma finalizada: 1ª é atual, 2ª é próxima
  return { current: partidas[0], next: partidas[1] || null }
}

async function loadPartidaAtual(campeonatoId: string): Promise<StreamSheetRow[]> {
  const partidas = await loadPartidasFlat(campeonatoId)
  const { current } = pickCurrentAndNext(partidas)
  if (!current) {
    return [{
      id: 'empty',
      cells: {
        mapa_nome: '—',
        mapa_img: '',
        queda_atual: '0',
        quedas_totais: text(partidas.length),
        jogo: '',
        status: 'sem partidas',
      },
    }]
  }
  const sameJogo = partidas.filter((p) => p.jogoId === current.jogoId)
  return [{
    id: current.id,
    cells: {
      mapa_nome: current.mapa.toUpperCase(),
      mapa_img: mapImageFor(current.mapa),
      queda_atual: text(current.numero || sameJogo.indexOf(current) + 1),
      quedas_totais: text(sameJogo.length || partidas.length),
      jogo: current.jogoNome,
      status: current.status || '—',
    },
  }]
}

async function loadProximaQueda(campeonatoId: string): Promise<StreamSheetRow[]> {
  const partidas = await loadPartidasFlat(campeonatoId)
  const { next } = pickCurrentAndNext(partidas)
  if (!next) {
    return [{
      id: 'empty-next',
      cells: {
        mapa_nome: '—',
        mapa_img: '',
        queda_numero: '',
        jogo: '',
        eq_nome: '',
        eq_logo: '',
        eq_pts: '',
        eq_abates: '',
        eq_booyahs: '',
        pl_nick: '',
        pl_abates: '',
        pl_kd: '',
      },
    }]
  }

  const mapaFilter = next.mapaCodigo || next.mapa
  const [eqStats, plStats] = await Promise.all([
    loadEquipeStats(campeonatoId, { mapa_codigo: mapaFilter }).catch(() => []),
    loadMvpStats(campeonatoId, { mapa_codigo: mapaFilter }).catch(() => []),
  ])

  const max = Math.max(eqStats.length, plStats.length, 1)
  const rows: StreamSheetRow[] = []
  for (let i = 0; i < max; i++) {
    const eq = eqStats[i]
    const pl = plStats[i]
    const abates = Number(pl?.abates || 0)
    const quedas = Math.max(1, Number(pl?.quedas || 1))
    const kd = pl ? (abates / quedas).toFixed(1).replace('.', ',') : ''
    rows.push({
      id: `next-${i}`,
      cells: {
        mapa_nome: i === 0 ? next.mapa.toUpperCase() : '',
        mapa_img: i === 0 ? mapImageFor(next.mapa) : '',
        queda_numero: i === 0 ? text(next.numero) : '',
        jogo: i === 0 ? next.jogoNome : '',
        eq_nome: text(eq?.nome || ''),
        eq_logo: text(eq?.logo_url || ''),
        eq_pts: eq ? text(eq.pontos_total ?? 0) : '',
        eq_abates: eq ? text(eq.abates ?? 0) : '',
        eq_booyahs: eq ? text(eq.booyahs ?? 0) : '',
        pl_nick: text(pl?.nick || ''),
        pl_abates: pl ? text(abates) : '',
        pl_kd: kd,
      },
    })
  }
  return rows
}

/** Opções de filtro para a UI da planilha. */
export async function loadStreamFilterOptions(campeonatoId: string) {
  const partidas = await loadPartidasFlat(campeonatoId).catch(() => [] as FlatPartida[])
  const mapas = new Map<string, string>()
  const jogos = new Map<string, string>()
  const fases = new Map<string, string>()
  for (const p of partidas) {
    if (p.mapaCodigo || p.mapa) mapas.set(p.mapaCodigo || p.mapa, p.mapa)
    if (p.jogoId) jogos.set(p.jogoId, p.jogoNome || p.jogoId)
    if (p.faseId) fases.set(p.faseId, p.faseId)
  }
  const meta = await loadTeamMeta(campeonatoId)
  const grupos = new Map<string, string>()
  for (const t of meta.values()) {
    if (t.grupoId) grupos.set(t.grupoId, t.grupo || t.grupoId)
    else if (t.grupo) grupos.set(t.grupo, t.grupo)
  }

  return {
    mapas: [...mapas.entries()].map(([value, label]) => ({ value, label })),
    jogos: [...jogos.entries()].map(([value, label]) => ({ value, label })),
    fases: [...fases.entries()].map(([value, label]) => ({ value, label: `Fase ${label.slice(0, 8)}` })),
    grupos: [...grupos.entries()].map(([value, label]) => ({ value, label })),
    partidas: partidas.map((p) => ({
      value: p.id,
      label: `${p.jogoNome || 'Jogo'} · Q${p.numero} · ${p.mapa}`,
    })),
  }
}

/** Converte payload de APIs existentes em linhas da planilha Stream. */
export async function loadStreamSheet(
  campeonatoId: string,
  sheetId: StreamSheetId,
  filters?: StreamSheetFilters,
): Promise<StreamSheetRow[]> {
  const id = resolveSheetId(sheetId)

  if (id === 'equipes_geral') return loadEquipesScoped(campeonatoId, undefined, false)
  if (id === 'equipes_mapa') return loadEquipesScoped(campeonatoId, { mapa_codigo: filters?.mapa_codigo }, false)
  if (id === 'equipes_jogo') return loadEquipesScoped(campeonatoId, { jogo_id: filters?.jogo_id }, false)
  if (id === 'equipes_fase') return loadEquipesScoped(campeonatoId, { fase_id: filters?.fase_id }, false)
  if (id === 'equipes_grupo') return loadEquipesScoped(campeonatoId, { grupo_id: filters?.grupo_id }, false)
  if (id === 'equipes_partida') return loadEquipesScoped(campeonatoId, { partida_id: filters?.partida_id }, true)

  if (id === 'mvp') return loadMvpRows(campeonatoId, filters)
  if (id === 'mapas') return loadMapasRows(campeonatoId)
  if (id === 'partida_atual') return loadPartidaAtual(campeonatoId)
  if (id === 'proxima_queda') return loadProximaQueda(campeonatoId)

  // legado
  if (sheetId === 'jogadores') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogadores`)
    const lines = Array.isArray(payload.participacoes) ? payload.participacoes : []
    const rows: StreamSheetRow[] = []
    for (const line of lines) {
      for (const p of line.jogadores || []) {
        rows.push({
          id: text(p.id || `${line.id}-${p.nick}`),
          cells: {
            nick: text(p.nick),
            id_jogo: text(p.id_jogo),
            line: text(line.line?.nome || line.nome_exibicao),
            funcao: text(p.funcao),
            slot: text(line.vaga?.slot_letra || ''),
            status: text(p.status || ''),
          },
        })
      }
    }
    return rows
  }

  if (sheetId === 'jogos') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogos`)
    const jogos = Array.isArray(payload.jogos) ? payload.jogos : []
    return jogos.map((jogo: any, index: number) => {
      const quedas = Array.isArray(jogo.quedas) ? jogo.quedas : []
      return {
        id: text(jogo.id || `jogo-${index}`),
        cells: {
          nome: text(jogo.nome || `Jogo ${index + 1}`),
          data: text(jogo.data_jogo || ''),
          horario: text(jogo.horario || ''),
          status: text(jogo.status || ''),
          quedas: text(quedas.length),
          mapas: quedas.map((q: any) => q.mapa_nome || q.mapa_codigo || '').filter(Boolean).join(', '),
        },
      }
    })
  }

  return []
}

const OVERLAY_KEY = (campeonatoId: string) => `dropzone_stream_overlays_${campeonatoId}`

export function listLocalOverlays(campeonatoId: string): StreamOverlay[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OVERLAY_KEY(campeonatoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateOverlay).filter(Boolean) as StreamOverlay[]
  } catch {
    return []
  }
}

export function saveLocalOverlays(campeonatoId: string, overlays: StreamOverlay[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(OVERLAY_KEY(campeonatoId), JSON.stringify(overlays))
}

export function getLocalOverlay(campeonatoId: string, overlayId: string) {
  return listLocalOverlays(campeonatoId).find((item) => item.id === overlayId) || null
}

export function upsertLocalOverlay(campeonatoId: string, overlay: StreamOverlay) {
  const list = listLocalOverlays(campeonatoId)
  const index = list.findIndex((item) => item.id === overlay.id)
  if (index >= 0) list[index] = overlay
  else list.unshift(overlay)
  saveLocalOverlays(campeonatoId, list)
  return overlay
}

export function removeLocalOverlay(campeonatoId: string, overlayId: string) {
  const list = listLocalOverlays(campeonatoId).filter((item) => item.id !== overlayId)
  saveLocalOverlays(campeonatoId, list)
}

export type OverlayListResult = {
  overlays: StreamOverlay[]
  source: 'api' | 'local'
  missing_table?: boolean
}

export async function listOverlays(campeonatoId: string): Promise<OverlayListResult> {
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays`)
    if (payload.missing_table) {
      return { overlays: listLocalOverlays(campeonatoId), source: 'local', missing_table: true }
    }
    const overlays = (Array.isArray(payload.overlays) ? payload.overlays : [])
      .map(migrateOverlay)
      .filter(Boolean) as StreamOverlay[]
    saveLocalOverlays(campeonatoId, overlays)
    return { overlays, source: 'api', missing_table: false }
  } catch {
    return { overlays: listLocalOverlays(campeonatoId), source: 'local' }
  }
}

export async function fetchOverlay(campeonatoId: string, overlayId: string): Promise<StreamOverlay | null> {
  try {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays/${overlayId}`)
    if (payload.overlay) {
      const migrated = migrateOverlay(payload.overlay)
      if (migrated) upsertLocalOverlay(campeonatoId, migrated)
      return migrated
    }
  } catch {
    // fallback local
  }
  return getLocalOverlay(campeonatoId, overlayId)
}

export async function saveOverlayRemote(
  campeonatoId: string,
  overlay: StreamOverlay,
  options?: { isNew?: boolean },
): Promise<{ overlay: StreamOverlay; source: 'api' | 'local'; missing_table?: boolean; warning?: string }> {
  const body = {
    name: overlay.name,
    template: overlay.template,
    blocks: overlay.blocks,
    frameW: overlay.frameW,
    frameH: overlay.frameH,
  }

  try {
    if (options?.isNew || !overlay.id || overlay.id.startsWith('ov-')) {
      const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (payload.missing_table) {
        const local = upsertLocalOverlay(campeonatoId, overlay)
        return { overlay: local, source: 'local', missing_table: true, warning: 'Salvo só neste navegador (rode o SQL de stream no Supabase).' }
      }
      const saved = migrateOverlay(payload.overlay) || overlay
      upsertLocalOverlay(campeonatoId, saved)
      return { overlay: saved, source: 'api' }
    }

    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays/${overlay.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (payload.missing_table) {
      const local = upsertLocalOverlay(campeonatoId, overlay)
      return { overlay: local, source: 'local', missing_table: true, warning: 'Salvo só neste navegador (rode o SQL de stream no Supabase).' }
    }
    const saved = migrateOverlay(payload.overlay) || overlay
    upsertLocalOverlay(campeonatoId, saved)
    return { overlay: saved, source: 'api' }
  } catch {
    const local = upsertLocalOverlay(campeonatoId, overlay)
    return { overlay: local, source: 'local', warning: 'Sem conexão com API — salvo localmente.' }
  }
}

export async function deleteOverlayRemote(campeonatoId: string, overlayId: string) {
  try {
    await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays/${overlayId}`, { method: 'DELETE' })
  } catch {
    // local still
  }
  removeLocalOverlay(campeonatoId, overlayId)
}
