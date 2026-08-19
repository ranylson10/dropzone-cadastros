import { NextRequest, NextResponse } from 'next/server'
import { getAccountsByUserId, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

type DashboardPeriod = 'today' | '7d' | '30d' | 'month' | 'year' | 'all'

type TeamResultRow = {
  campeonato_id: string
  campeonato_equipe_id: string
  partida_id: string
  numero_partida?: number | null
  mapa_codigo?: string | null
  mapa_nome?: string | null
  line_id?: string | null
  line_nome?: string | null
  posicao?: number | null
  abates?: number | null
  pontos_total?: number | null
  booyah?: boolean | null
  updated_at?: string | null
}

type PlayerResultRow = {
  campeonato_id: string
  campeonato_equipe_id: string
  partida_id: string
  mapa_codigo?: string | null
  mapa_nome?: string | null
  line_id?: string | null
  campeonato_jogador_id?: string | null
  jogador_id?: string | null
  jogador_temporario_id?: string | null
  nick?: string | null
  id_jogo?: string | null
  foto_url?: string | null
  abates?: number | null
  dano?: number | null
  assistencias?: number | null
  revives?: number | null
  updated_at?: string | null
}

type ChampionshipRow = {
  id: string
  nome?: string | null
  tipo?: string | null
  logo_url?: string | null
  status?: string | null
  created_at?: string | null
}

type ChampionshipConfigRow = {
  campeonato_id: string
  premiacao?: number | string | null
  descricao_premiacao?: string | null
  tipo_premiacao?: string | null
}

type ChampionshipDropRow = {
  id: string
  campeonato_id?: string | null
  data_jogo?: string | null
  mapa_codigo?: string | null
  status?: string | null
}

const DASHBOARD_TIME_ZONE = 'America/Sao_Paulo'

function dateKeyInBrazil(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0))
}

function shiftDateKey(value: string, days: number) {
  const date = parseDateKey(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function periodStart(period: DashboardPeriod, today: string) {
  if (period === 'all') return null
  if (period === 'today') return today
  if (period === '7d') return shiftDateKey(today, -6)
  if (period === '30d') return shiftDateKey(today, -29)
  if (period === 'month') return `${today.slice(0, 7)}-01`
  return `${today.slice(0, 4)}-01-01`
}

function inPeriod(dateKey: string | null, period: DashboardPeriod, today: string) {
  if (period === 'all') return true
  if (!dateKey) return false
  const start = periodStart(period, today)
  return Boolean(start && dateKey >= start && dateKey <= today)
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0
}

function round(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function uniqueCount<T>(rows: T[], keyOf: (row: T) => string) {
  return new Set(rows.map(keyOf).filter(Boolean)).size
}

async function fetchTeamResults(equipeId: string): Promise<TeamResultRow[]> {
  const rows: TeamResultRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_estatisticas_equipes_detalhe')
      .select('campeonato_id,campeonato_equipe_id,partida_id,numero_partida,mapa_codigo,mapa_nome,line_id,line_nome,posicao,abates,pontos_total,booyah,updated_at')
      .eq('equipe_id', equipeId)
      .range(from, from + pageSize - 1)
    if (error) throw error
    const page = (data || []) as TeamResultRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

async function fetchPlayerResults(equipeId: string): Promise<PlayerResultRow[]> {
  const rows: PlayerResultRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_estatisticas_mvp_detalhe')
      .select('campeonato_id,campeonato_equipe_id,partida_id,mapa_codigo,mapa_nome,line_id,campeonato_jogador_id,jogador_id,jogador_temporario_id,nick,id_jogo,foto_url,abates,dano,assistencias,revives,updated_at')
      .eq('equipe_id', equipeId)
      .range(from, from + pageSize - 1)
    if (error) throw error
    const page = (data || []) as PlayerResultRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}


function resultDateKey(row: { partida_id?: string | null; updated_at?: string | null }, partidaById: Map<string, any>) {
  const partida = partidaById.get(String(row.partida_id || ''))
  if (partida?.data_jogo) return String(partida.data_jogo).slice(0, 10)
  const updated = String(row.updated_at || '')
  return /^\d{4}-\d{2}-\d{2}/.test(updated) ? updated.slice(0, 10) : null
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12, 0, 0))
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date).replace('.', '')
}

function dayLabel(key: string) {
  const date = parseDateKey(key)
  if (!date) return key
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsByUserId(user.id)
    const equipeId = String(req.nextUrl.searchParams.get('equipe_id') || '').trim()
    if (!equipeId) return NextResponse.json({ error: 'Equipe não informada.' }, { status: 400 })
    await requireEquipeAccess(user.id, accounts, equipeId, 'ver')

    const rawPeriod = String(req.nextUrl.searchParams.get('periodo') || '30d') as DashboardPeriod
    const period: DashboardPeriod = ['today', '7d', '30d', 'month', 'year', 'all'].includes(rawPeriod) ? rawPeriod : '30d'
    const eventoId = String(req.nextUrl.searchParams.get('evento_id') || '').trim()
    const lineId = String(req.nextUrl.searchParams.get('line_id') || '').trim()
    const mapaCodigo = String(req.nextUrl.searchParams.get('mapa') || '').trim().toLowerCase()
    const today = dateKeyInBrazil(new Date())

    const [{ data: equipe, error: equipeError }, { data: participacoes, error: participacoesError }, teamResults, playerResults, { data: currentLines, error: linesError }] = await Promise.all([
      supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').eq('id', equipeId).maybeSingle(),
      supabaseAdmin.from('campeonato_equipes').select('id,campeonato_id,equipe_id,line_id,status,created_at').eq('equipe_id', equipeId).order('created_at', { ascending: false }),
      fetchTeamResults(equipeId),
      fetchPlayerResults(equipeId),
      supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url,status').eq('equipe_id', equipeId),
    ])
    if (equipeError) throw equipeError
    if (participacoesError) throw participacoesError
    if (linesError) throw linesError

    const validParticipacoes = (participacoes || []).filter((row: any) => !['deletado', 'excluido', 'cancelado'].includes(String(row.status || '').toLowerCase()))
    const campeonatoIds = [...new Set([
      ...validParticipacoes.map((row: any) => String(row.campeonato_id || '')),
      ...teamResults.map((row) => String(row.campeonato_id || '')),
    ].filter(Boolean))]
    const partidaIds = [...new Set(teamResults.map((row) => String(row.partida_id || '')).filter(Boolean))]

    const [campeonatosResult, configsResult, partidasResult] = await Promise.all([
      campeonatoIds.length
        ? supabaseAdmin.from('campeonatos').select('id,nome,tipo,logo_url,status,created_at').in('id', campeonatoIds)
        : Promise.resolve({ data: [], error: null } as any),
      campeonatoIds.length
        ? supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,premiacao,descricao_premiacao,tipo_premiacao').in('campeonato_id', campeonatoIds)
        : Promise.resolve({ data: [], error: null } as any),
      partidaIds.length
        ? supabaseAdmin.from('campeonato_partidas').select('id,campeonato_id,data_jogo,mapa_codigo,status').in('id', partidaIds)
        : Promise.resolve({ data: [], error: null } as any),
    ])
    if (campeonatosResult.error) throw campeonatosResult.error
    if (configsResult.error) throw configsResult.error
    if (partidasResult.error) throw partidasResult.error

    const campeonatos = (campeonatosResult.data || []) as ChampionshipRow[]
    const configs = (configsResult.data || []) as ChampionshipConfigRow[]
    const partidas = (partidasResult.data || []) as ChampionshipDropRow[]
    const campeonatoById = new Map<string, ChampionshipRow>(campeonatos.map((row) => [String(row.id), row]))
    const configByCampeonato = new Map<string, ChampionshipConfigRow>(configs.map((row) => [String(row.campeonato_id), row]))
    const partidaById = new Map<string, ChampionshipDropRow>(partidas.map((row) => [String(row.id), row]))

    const matchesDashboardFilter = (row: TeamResultRow | PlayerResultRow) => {
      if (eventoId && String(row.campeonato_id || '') !== eventoId) return false
      if (lineId && String(row.line_id || '') !== lineId) return false
      if (mapaCodigo && String(row.mapa_codigo || '').toLowerCase() !== mapaCodigo) return false
      return inPeriod(resultDateKey(row, partidaById), period, today)
    }

    const filteredTeamRows = teamResults
      .filter(matchesDashboardFilter)
      .filter((row) => String(partidaById.get(String(row.partida_id || ''))?.status || '').toLowerCase() !== 'cancelada')
    const allowedDropKeys = new Set(filteredTeamRows.map((row) => `${row.campeonato_equipe_id}:${row.partida_id}`))
    const filteredPlayerRows = playerResults.filter((row) => matchesDashboardFilter(row) && allowedDropKeys.has(`${row.campeonato_equipe_id}:${row.partida_id}`))

    const positions = filteredTeamRows.map((row) => numberValue(row.posicao)).filter((value) => value > 0)
    const pontosTotal = filteredTeamRows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0)
    const abatesTotal = filteredTeamRows.reduce((sum, row) => sum + numberValue(row.abates), 0)
    const booyahs = filteredTeamRows.filter((row) => Boolean(row.booyah)).length
    const top3 = filteredTeamRows.filter((row) => numberValue(row.posicao) > 0 && numberValue(row.posicao) <= 3).length
    const top5 = filteredTeamRows.filter((row) => numberValue(row.posicao) > 0 && numberValue(row.posicao) <= 5).length

    const currentMonth = today.slice(0, 7)
    const currentYear = today.slice(0, 4)
    const validHistoricalResults = teamResults.filter((row) => String(partidaById.get(String(row.partida_id || ''))?.status || '').toLowerCase() !== 'cancelada')
    const uniquePlayedChampionships = (predicate: (dateKey: string | null) => boolean) => new Set(
      validHistoricalResults
        .filter((row) => predicate(resultDateKey(row, partidaById)))
        .map((row) => String(row.campeonato_id || ''))
        .filter(Boolean),
    ).size

    const activeParticipationRows = validParticipacoes.filter((row: any) => String(row.status || '').toLowerCase() === 'ativo')
    const prizeChampionshipIds = new Set<string>(
      activeParticipationRows
        .filter((row: any) => !lineId || String(row.line_id || '') === lineId)
        .filter((row: any) => !eventoId || String(row.campeonato_id || '') === eventoId)
        .filter((row: any) => String(campeonatoById.get(String(row.campeonato_id || ''))?.status || '').toLowerCase() === 'ativo')
        .map((row: any) => String(row.campeonato_id || '')),
    )
    const prizeRows = [...prizeChampionshipIds].map((id) => ({
      campeonato_id: id,
      nome: String(campeonatoById.get(id)?.nome || 'Campeonato'),
      valor: numberValue(configByCampeonato.get(id)?.premiacao),
      descricao: String(configByCampeonato.get(id)?.descricao_premiacao || '').trim() || null,
    })).filter((row) => row.valor > 0)

    const evolutionMode = period === 'year' || period === 'all' ? 'month' : 'day'
    const evolutionGroups = new Map<string, TeamResultRow[]>()
    for (const row of filteredTeamRows) {
      const dateKey = resultDateKey(row, partidaById)
      if (!dateKey) continue
      const key = evolutionMode === 'month' ? dateKey.slice(0, 7) : dateKey
      evolutionGroups.set(key, [...(evolutionGroups.get(key) || []), row])
    }
    const evolution = [...evolutionGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
      const rowPositions = rows.map((row) => numberValue(row.posicao)).filter((value) => value > 0)
      return {
        chave: key,
        label: evolutionMode === 'month' ? monthLabel(key) : dayLabel(key),
        quedas: rows.length,
        pontos: round(rows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0), 1),
        pontos_media: round(rows.length ? rows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0) / rows.length : 0, 2),
        abates: rows.reduce((sum, row) => sum + numberValue(row.abates), 0),
        colocacao_media: round(average(rowPositions), 2),
        booyahs: rows.filter((row) => Boolean(row.booyah)).length,
      }
    })

    const mapGroups = new Map<string, TeamResultRow[]>()
    for (const row of filteredTeamRows) {
      const key = String(row.mapa_codigo || row.mapa_nome || 'sem_mapa')
      mapGroups.set(key, [...(mapGroups.get(key) || []), row])
    }
    const mapas = [...mapGroups.entries()].map(([codigo, rows]) => {
      const rowPositions = rows.map((row) => numberValue(row.posicao)).filter((value) => value > 0)
      const points = rows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0)
      const kills = rows.reduce((sum, row) => sum + numberValue(row.abates), 0)
      return {
        codigo,
        nome: String(rows.find((row) => row.mapa_nome)?.mapa_nome || codigo || 'Mapa não definido'),
        quedas: rows.length,
        pontos_media: round(rows.length ? points / rows.length : 0, 2),
        abates_media: round(rows.length ? kills / rows.length : 0, 2),
        colocacao_media: round(average(rowPositions), 2),
        booyahs: rows.filter((row) => Boolean(row.booyah)).length,
        top5_percentual: round(percentage(rows.filter((row) => numberValue(row.posicao) > 0 && numberValue(row.posicao) <= 5).length, rows.length), 1),
      }
    }).sort((a, b) => numberValue(b.pontos_media) - numberValue(a.pontos_media) || b.quedas - a.quedas)

    const eventGroups = new Map<string, TeamResultRow[]>()
    for (const row of filteredTeamRows) {
      const key = String(row.campeonato_id || '')
      if (!key) continue
      eventGroups.set(key, [...(eventGroups.get(key) || []), row])
    }
    const eventos = [...eventGroups.entries()].map(([id, rows]) => {
      const championship: ChampionshipRow = campeonatoById.get(id) || { id }
      const rowPositions = rows.map((row) => numberValue(row.posicao)).filter((value) => value > 0)
      const points = rows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0)
      return {
        id,
        nome: String(championship.nome || 'Campeonato'),
        tipo: String(championship.tipo || ''),
        status: String(championship.status || ''),
        logo_url: championship.logo_url || null,
        quedas: rows.length,
        pontos_total: round(points, 1),
        pontos_media: round(rows.length ? points / rows.length : 0, 2),
        abates: rows.reduce((sum, row) => sum + numberValue(row.abates), 0),
        booyahs: rows.filter((row) => Boolean(row.booyah)).length,
        colocacao_media: round(average(rowPositions), 2),
        premiacao: numberValue(configByCampeonato.get(id)?.premiacao),
      }
    }).sort((a, b) => numberValue(b.pontos_media) - numberValue(a.pontos_media) || b.quedas - a.quedas)

    const lineNames = new Map<string, { nome: string; tag: string | null; logo_url: string | null }>()
    for (const line of currentLines || []) {
      if (String((line as any).status || '').toLowerCase() === 'deletado') continue
      lineNames.set(String((line as any).id), { nome: String((line as any).nome || 'Line'), tag: (line as any).tag || null, logo_url: (line as any).logo_url || null })
    }
    for (const row of teamResults) {
      const id = String(row.line_id || '')
      if (id && !lineNames.has(id)) lineNames.set(id, { nome: String(row.line_nome || 'Line'), tag: null, logo_url: null })
    }

    const lineGroups = new Map<string, TeamResultRow[]>()
    for (const row of filteredTeamRows) {
      const key = String(row.line_id || 'sem_line')
      lineGroups.set(key, [...(lineGroups.get(key) || []), row])
    }
    const lines = [...lineGroups.entries()].map(([id, rows]) => {
      const rowPositions = rows.map((row) => numberValue(row.posicao)).filter((value) => value > 0)
      const points = rows.reduce((sum, row) => sum + numberValue(row.pontos_total), 0)
      const line = lineNames.get(id)
      return {
        id,
        nome: line?.nome || String(rows.find((row) => row.line_nome)?.line_nome || 'Sem line'),
        tag: line?.tag || null,
        logo_url: line?.logo_url || null,
        quedas: rows.length,
        pontos_total: round(points, 1),
        pontos_media: round(rows.length ? points / rows.length : 0, 2),
        abates: rows.reduce((sum, row) => sum + numberValue(row.abates), 0),
        abates_media: round(rows.length ? rows.reduce((sum, row) => sum + numberValue(row.abates), 0) / rows.length : 0, 2),
        booyahs: rows.filter((row) => Boolean(row.booyah)).length,
        colocacao_media: round(average(rowPositions), 2),
        top5_percentual: round(percentage(rows.filter((row) => numberValue(row.posicao) > 0 && numberValue(row.posicao) <= 5).length, rows.length), 1),
      }
    }).sort((a, b) => numberValue(b.pontos_media) - numberValue(a.pontos_media) || b.quedas - a.quedas)

    const playerGroups = new Map<string, PlayerResultRow[]>()
    for (const row of filteredPlayerRows) {
      const key = String(row.id_jogo || row.jogador_id || row.jogador_temporario_id || row.campeonato_jogador_id || row.nick || '')
      if (!key) continue
      playerGroups.set(key, [...(playerGroups.get(key) || []), row])
    }
    const jogadores = [...playerGroups.entries()].map(([id, rows]) => {
      const drops = uniqueCount(rows, (row) => String(row.partida_id || ''))
      const kills = rows.reduce((sum, row) => sum + numberValue(row.abates), 0)
      const playerLineIds = [...new Set(rows.map((row) => String(row.line_id || '')).filter(Boolean))]
      const line = playerLineIds.length === 1 ? lineNames.get(playerLineIds[0]) : null
      return {
        id,
        nick: String(rows.find((row) => row.nick)?.nick || 'Jogador'),
        id_jogo: String(rows.find((row) => row.id_jogo)?.id_jogo || '') || null,
        foto_url: rows.find((row) => row.foto_url)?.foto_url || null,
        line_id: playerLineIds.length === 1 ? playerLineIds[0] : null,
        line_nome: playerLineIds.length > 1 ? `${playerLineIds.length} lines` : line?.nome || null,
        quedas: drops,
        abates: kills,
        abates_media: round(drops ? kills / drops : 0, 2),
        dano: rows.reduce((sum, row) => sum + numberValue(row.dano), 0),
        dano_media: round(drops ? rows.reduce((sum, row) => sum + numberValue(row.dano), 0) / drops : 0, 1),
        assistencias: rows.reduce((sum, row) => sum + numberValue(row.assistencias), 0),
        revives: rows.reduce((sum, row) => sum + numberValue(row.revives), 0),
      }
    }).sort((a, b) => b.abates - a.abates || b.dano - a.dano || b.quedas - a.quedas)

    const mapsWithSample = mapas.filter((row) => row.quedas >= 3)
    const linesWithSample = lines.filter((row) => row.quedas >= 3)
    const playerHighlight = [...jogadores]
      .filter((row) => row.quedas >= 3)
      .sort((a, b) => numberValue(b.abates_media) - numberValue(a.abates_media) || b.abates - a.abates)[0] || jogadores[0] || null
    const sortedByDate = [...filteredTeamRows].sort((a, b) => {
      const dateCompare = String(resultDateKey(a, partidaById) || '').localeCompare(String(resultDateKey(b, partidaById) || ''))
      return dateCompare || numberValue(a.numero_partida) - numberValue(b.numero_partida)
    })
    let trend: { percentual: number; direcao: 'alta' | 'queda' | 'estavel'; atual: number; anterior: number } | null = null
    if (sortedByDate.length >= 10) {
      const recent = sortedByDate.slice(-5)
      const previous = sortedByDate.slice(-10, -5)
      const currentAvg = recent.reduce((sum, row) => sum + numberValue(row.pontos_total), 0) / recent.length
      const previousAvg = previous.reduce((sum, row) => sum + numberValue(row.pontos_total), 0) / previous.length
      const delta = previousAvg ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0
      trend = {
        percentual: round(Math.abs(delta), 1) || 0,
        direcao: Math.abs(delta) < 3 ? 'estavel' : delta > 0 ? 'alta' : 'queda',
        atual: round(currentAvg, 2) || 0,
        anterior: round(previousAvg, 2) || 0,
      }
    }

    const filterEvents = validParticipacoes
      .map((row: any) => String(row.campeonato_id || ''))
      .filter(Boolean)
      .filter((id: string, index: number, all: string[]) => all.indexOf(id) === index)
      .map((id: string) => ({
        id,
        nome: String(campeonatoById.get(id)?.nome || 'Campeonato'),
        tipo: String(campeonatoById.get(id)?.tipo || ''),
        status: String(campeonatoById.get(id)?.status || ''),
      }))
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const filterLines = [...lineNames.entries()].map(([id, line]) => ({ id, ...line })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const filterMapByCode = new Map<string, { codigo: string; nome: string }>()
    for (const row of teamResults) {
      const codigo = String(row.mapa_codigo || '').trim()
      if (!codigo) continue
      filterMapByCode.set(codigo, { codigo, nome: String(row.mapa_nome || row.mapa_codigo || codigo) })
    }
    const filterMaps = [...filterMapByCode.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return NextResponse.json({
      equipe: equipe || { id: equipeId, nome: 'Equipe', tag: null, logo_url: null },
      filtro: { periodo: period, evento_id: eventoId || null, line_id: lineId || null, mapa: mapaCodigo || null },
      opcoes: { eventos: filterEvents, lines: filterLines, mapas: filterMaps },
      participacoes: {
        hoje: uniquePlayedChampionships((key) => key === today),
        mes: uniquePlayedChampionships((key) => Boolean(key && key.startsWith(currentMonth))),
        ano: uniquePlayedChampionships((key) => Boolean(key && key.startsWith(currentYear))),
        total: new Set([
          ...validParticipacoes.map((row: any) => String(row.campeonato_id || '')),
          ...validHistoricalResults.map((row) => String(row.campeonato_id || '')),
        ].filter(Boolean)).size,
      },
      kpis: {
        campeonatos_disputados: uniqueCount(filteredTeamRows, (row) => String(row.campeonato_id || '')),
        quedas: filteredTeamRows.length,
        booyahs,
        abates: abatesTotal,
        pontos_total: round(pontosTotal, 1),
        pontos_media: round(filteredTeamRows.length ? pontosTotal / filteredTeamRows.length : 0, 2),
        colocacao_media: round(average(positions), 2),
        top3_percentual: round(percentage(top3, filteredTeamRows.length), 1),
        top5_percentual: round(percentage(top5, filteredTeamRows.length), 1),
        premio_em_disputa: round(prizeRows.reduce((sum, row) => sum + row.valor, 0), 2),
        campeonatos_com_premiacao_ativa: prizeRows.length,
      },
      premios: { em_disputa: prizeRows.reduce((sum, row) => sum + row.valor, 0), eventos: prizeRows.sort((a, b) => b.valor - a.valor) },
      evolucao: evolution,
      mapas,
      eventos,
      jogadores,
      lines,
      insights: {
        melhor_mapa: mapsWithSample[0] || null,
        mapa_atencao: mapsWithSample.length > 1 ? mapsWithSample[mapsWithSample.length - 1] : null,
        line_destaque: linesWithSample[0] || null,
        jogador_destaque: playerHighlight,
        tendencia: trend,
      },
      meta: {
        resultados_considerados: filteredTeamRows.length,
        jogadores_com_resultado: jogadores.length,
        atualizado_em: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar dashboard da equipe.' }, { status: 400 })
  }
}
