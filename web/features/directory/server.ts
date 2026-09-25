import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { unstable_cache } from 'next/cache'
import { getCachedRankingTiers } from '@/features/ranking/server'
import { buildChampionshipDirectoryItems } from './championship-directory'
import { buildManagerDirectoryItems } from './manager-directory'
import { buildPlayerDirectoryItems } from './player-directory'
import { buildProducerDirectoryItems } from './producer-directory'
import { buildTeamDirectoryItems } from './team-directory'
import type { DirectoryItem, DirectoryKind, DirectoryProfile } from './types'

function text(value: unknown, fallback = '') { return String(value ?? fallback).trim() }
function first(...values: unknown[]) { return values.map((value) => text(value)).find(Boolean) || '' }
function statusLabel(value: unknown) {
  const raw = text(value, 'ativo').replaceAll('_', ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
function money(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Sem premiação informada'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
function directoryMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}
function yesNo(value: unknown) { return value == null ? '-' : value ? 'Sim' : 'Não' }
function dateLabel(value: unknown) {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function location(row: any) { return first(row.localidade, [row.cidade, row.estado, row.pais].filter(Boolean).join(' · ')) }

const DIRECTORY_PAGE_SIZE = 1000
const DIRECTORY_MAX_ROWS = 10000

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function compactNumber(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

function integer(value: unknown) {
  const result = Number(value || 0)
  return Number.isFinite(result) ? result : 0
}

async function competitiveProfile(kind: 'equipes' | 'jogadores', id: string) {
  const ranking = await getCachedRankingTiers().catch(() => null)
  const isPlayer = kind === 'jogadores'
  let rankRows: any[] = []
  let statsRows: any[] = []

  if (isPlayer) {
    rankRows = (ranking?.players || []).filter((row: any) => String(row.jogador_id) === id)
    const { data, error } = await supabaseAdmin
      .from('garena_matchstats_jogadores')
      .select('importacao_id,abates,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,granadas_usadas,gel_usado,kits_medicos,precisao_percentual,garena_matchstats_importacoes!inner(partida_id,concluida_em,consolidacao_oficial),garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,personagem,habilidade,usos,pick_times,pick_rate)')
      .eq('jogador_id', id)
      .eq('garena_matchstats_importacoes.consolidacao_oficial', true)
      .limit(1000)
    if (!error) statsRows = data || []
  } else {
    const { data: participations, error: participationError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('equipe_id', id)
      .neq('status', 'deletado')
      .limit(1000)
    const participationIds = (participations || []).map((row: any) => String(row.id)).filter(Boolean)
    rankRows = (ranking?.teams || []).filter((row: any) => String(row.equipe_id) === id)
    if (!participationError && participationIds.length) {
      const { data, error } = await supabaseAdmin
        .from('garena_matchstats_jogadores')
        .select('importacao_id,abates,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,granadas_usadas,gel_usado,kits_medicos,precisao_percentual,garena_matchstats_importacoes!inner(partida_id,concluida_em,consolidacao_oficial),garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,personagem,habilidade,usos,pick_times,pick_rate)')
        .in('campeonato_equipe_id', participationIds)
        .eq('garena_matchstats_importacoes.consolidacao_oficial', true)
        .limit(10000)
      if (!error) statsRows = data || []
    }
  }

  const aggregate = (field: string) => rankRows.reduce((total, row) => total + integer(row[field]), 0)
  const principal = rankRows.sort((a, b) => integer(b.score) - integer(a.score))[0] || null
  const statTotal = (field: string) => statsRows.reduce((total, row) => total + integer(row[field]), 0)
  const total = (field: string) => aggregate(field) || statTotal(field)
  const weaponUsage = new Map<string, { nome: string; abates: number; dano: number }>()
  const skillUsage = new Map<string, { tipo: string; personagem: string; habilidade: string; usos: number; pickTimes: number; pickRate: number }>()
  for (const row of statsRows) {
    for (const weapon of (row.garena_matchstats_armas || [])) {
      const nome = text(weapon.arma)
      if (!nome) continue
      const current = weaponUsage.get(nome) || { nome, abates: 0, dano: 0 }
      current.abates += integer(weapon.abates)
      current.dano += integer(weapon.dano)
      weaponUsage.set(nome, current)
    }
    for (const skill of (row.garena_matchstats_habilidades || [])) {
      const tipo = text(skill.tipo)
      const habilidade = text(skill.habilidade)
      if (!tipo || !habilidade) continue
      const key = `${tipo}:${habilidade}`
      const current = skillUsage.get(key) || { tipo, personagem: text(skill.personagem), habilidade, usos: 0, pickTimes: 0, pickRate: 0 }
      current.usos += integer(skill.usos)
      current.pickTimes += integer(skill.pick_times)
      current.pickRate += integer(skill.pick_rate)
      skillUsage.set(key, current)
    }
  }
  const topWeapon = [...weaponUsage.values()].sort((a, b) => b.abates - a.abates || b.dano - a.dano || a.nome.localeCompare(b.nome))[0]?.nome || ''
  const topSkills = (tipo: string, limit: number) => [...skillUsage.values()]
    .filter((skill) => skill.tipo === tipo)
    .sort((a, b) => b.usos - a.usos || b.pickTimes - a.pickTimes || b.pickRate - a.pickRate || a.habilidade.localeCompare(b.habilidade))
    .slice(0, limit)
  const skillLabel = (skill: any) => [skill?.personagem, skill?.habilidade].filter(Boolean).join(' · ')
  const byFall = new Map<string, { label: string; date: string; abates: number; dano: number; assistencias: number }>()
  for (const row of statsRows) {
    const imported: any = Array.isArray(row.garena_matchstats_importacoes) ? row.garena_matchstats_importacoes[0] : row.garena_matchstats_importacoes
    const key = String(imported?.partida_id || row.importacao_id)
    const current = byFall.get(key) || { label: `P${byFall.size + 1}`, date: String(imported?.concluida_em || ''), abates: 0, dano: 0, assistencias: 0 }
    current.abates += integer(row.abates)
    current.dano += integer(row.dano)
    current.assistencias += integer(row.assistencias)
    byFall.set(key, current)
  }
  const trend = [...byFall.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8).map(({ label, abates, dano, assistencias }) => ({ label, abates, dano, assistencias }))
  const sampleSize = Math.max(1, aggregate('quedas') || byFall.size || statsRows.length)
  const perMatch = (field: string, divisor = sampleSize) => total(field) / Math.max(1, divisor)

  if (isPlayer) {
    const row = principal
    return {
      label: 'Perfil gamer · dados oficiais', tier: row?.tier || null, score: row?.score || null,
      metrics: [
        { label: 'Abates', value: String(total('abates')) }, { label: 'Dano total', value: compactNumber(total('dano')) },
        { label: 'Assistências', value: String(total('assistencias')) }, { label: 'Headshots', value: String(total('headshots')) },
        { label: 'Sobrevivência', value: `${compactNumber(total('sobrevivencia_segundos'))} s` }, { label: 'Quedas', value: String(aggregate('quedas') || byFall.size) },
      ],
      averages: [
        { label: 'Abates', value: perMatch('abates').toFixed(1) }, { label: 'Dano', value: compactNumber(perMatch('dano')) },
        { label: 'Assistências', value: perMatch('assistencias').toFixed(1) }, { label: 'Gelo', value: perMatch('gel_usado').toFixed(1) },
      ],
      highlights: [
        { label: 'Arma mais usada', value: row?.arma_mais_usada || topWeapon },
        { label: 'Habilidade ativa', value: skillLabel(row?.habilidade_ativa) || skillLabel(topSkills('ativa', 1)[0]) },
        { label: 'Passivas', value: (row?.habilidades_passivas || []).map((item: any) => item.habilidade || item.personagem).filter(Boolean).join(' · ') || topSkills('passiva', 3).map(skillLabel).filter(Boolean).join(' · ') },
        { label: 'Função', value: row?.funcao || '' },
        { label: 'Revives', value: String(total('revives')) }, { label: 'Knockdowns', value: String(total('knockdowns')) },
        { label: 'Paredes de gel', value: String(total('gel_usado')) }, { label: 'Kits médicos', value: String(total('kits_medicos')) },
        { label: 'Granadas', value: String(total('granadas_usadas')) }, { label: 'Distância movida', value: `${compactNumber(total('distancia_movida'))} m` },
        { label: 'Maior abate', value: `${compactNumber(total('distancia_max_abate'))} m` },
      ], trend,
    }
  }

  return {
    label: 'Elenco · dados oficiais', tier: principal?.tier || null, score: principal?.score || null,
    metrics: [
      { label: 'Pontos', value: String(total('pontos')) }, { label: 'Abates', value: String(total('abates')) },
      { label: 'Dano do elenco', value: compactNumber(total('dano')) }, { label: 'Assistências', value: String(total('assistencias')) },
      { label: 'Booyahs', value: String(total('booyahs')) }, { label: 'Quedas', value: String(aggregate('quedas') || byFall.size) },
    ],
    averages: [
      { label: 'Pontos', value: perMatch('pontos').toFixed(1) }, { label: 'Abates', value: perMatch('abates').toFixed(1) },
      { label: 'Dano', value: compactNumber(perMatch('dano')) }, { label: 'Assistências', value: perMatch('assistencias').toFixed(1) },
    ],
    highlights: [
      { label: 'Arma do elenco', value: topWeapon }, { label: 'Ativa predominante', value: skillLabel(topSkills('ativa', 1)[0]) },
      { label: 'Passivas predominantes', value: topSkills('passiva', 3).map(skillLabel).filter(Boolean).join(' · ') }, { label: 'Headshots', value: String(total('headshots')) },
      { label: 'Knockdowns', value: String(total('knockdowns')) }, { label: 'Revives', value: String(total('revives')) },
      { label: 'Paredes de gel', value: String(total('gel_usado')) }, { label: 'Kits médicos', value: String(total('kits_medicos')) },
      { label: 'Granadas', value: String(total('granadas_usadas')) }, { label: 'Distância movida', value: `${compactNumber(total('distancia_movida'))} m` },
      { label: 'Maior abate', value: `${compactNumber(total('distancia_max_abate'))} m` },
    ], trend,
  }
}

const getCompetitiveProfile = unstable_cache(
  competitiveProfile,
  ['directory-competitive-profile-v1'],
  { revalidate: 30, tags: ['directory:competitive'] },
)

async function rows(table: string) {
  const collected: any[] = []

  for (let from = 0; from < DIRECTORY_MAX_ROWS; from += DIRECTORY_PAGE_SIZE) {
    const to = from + DIRECTORY_PAGE_SIZE - 1
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
      throw error
    }

    const page = data || []
    collected.push(...page)
    if (page.length < DIRECTORY_PAGE_SIZE) break
  }

  return collected.filter((row: any) => {
    const status = normalized(row.status || 'ativo')
    if (['suspenso', 'banido', 'excluido', 'excluído'].includes(status)) return false
    if (row.deleted_at) return false

    // Só no ar se aprovado pelo admin. Normalização evita exclusão por espaços/caixa.
    const approval = normalized(row.aprovacao_status)
    if (approval && approval !== 'aprovado') return false
    return true
  })
}

const PUBLIC_CHAMPIONSHIP_COLUMNS = 'id,nome,tipo,logo_url,banner_url,status,created_at,aprovacao_status,deleted_at,produtora_id'
const PUBLIC_CHAMPIONSHIP_RELATED_COLUMNS = {
  campeonato_configuracoes: 'campeonato_id,formato,numero_vagas,valor_inscricao,premiacao,tem_live,plataforma,servidor,data_limite_inscricao',
  campeonato_fases: 'id,campeonato_id,ordem,status',
  campeonato_slots: 'campeonato_id,fase_id,status,equipe_id,line_id',
  campeonato_jogos: 'campeonato_id,status,data_jogo,horario',
} as const

function isPublicDirectoryRow(row: any) {
  const status = normalized(row.status || 'ativo')
  if (['suspenso', 'banido', 'excluido', 'excluído'].includes(status)) return false
  if (row.deleted_at) return false
  const approval = normalized(row.aprovacao_status)
  return !approval || approval === 'aprovado'
}

type ScopedRowsFilter =
  | { column: string; value: unknown }
  | { column: string; values: string[] }

async function scopedRows(
  table: string,
  filter: ScopedRowsFilter,
  options: { plain?: boolean } = {},
) {
  if ('values' in filter && filter.values.length === 0) return []
  const collected: any[] = []

  for (let from = 0; from < DIRECTORY_MAX_ROWS; from += DIRECTORY_PAGE_SIZE) {
    const to = from + DIRECTORY_PAGE_SIZE - 1
    let query: any = supabaseAdmin.from(table).select('*')
    query = 'values' in filter
      ? query.in(filter.column, filter.values)
      : query.eq(filter.column, filter.value)
    if (!options.plain) query = query.order('created_at', { ascending: false })
    const { data, error } = await query.range(from, to)

    if (error) {
      if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
      throw error
    }

    const page = data || []
    collected.push(...page)
    if (page.length < DIRECTORY_PAGE_SIZE) break
  }

  return options.plain ? collected : collected.filter(isPublicDirectoryRow)
}

async function selectedRows(table: string, columns: string, referencedIds?: string[], referenceColumn = 'campeonato_id') {
  if (referencedIds && referencedIds.length === 0) return []
  let query = supabaseAdmin.from(table).select(columns)
  if (referencedIds) query = query.in(referenceColumn, referencedIds)
  else if (['campeonatos', 'equipes', 'jogadores', 'managers', 'produtoras'].includes(table)) query = query.order('created_at', { ascending: false })
  const { data, error } = await query.limit(DIRECTORY_MAX_ROWS)
  if (error) {
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
  return data || []
}

const listPublicChampionships = unstable_cache(
  async (): Promise<DirectoryItem[]> => {
    const championshipRows = await selectedRows('campeonatos', PUBLIC_CHAMPIONSHIP_COLUMNS)
    const championships = championshipRows.filter(isPublicDirectoryRow)
    const championshipIds = championships.map((row: any) => String(row.id)).filter(Boolean)
    if (championshipIds.length === 0) return []

    const [configs, phases, slots, games] = (await Promise.all(
      Object.entries(PUBLIC_CHAMPIONSHIP_RELATED_COLUMNS).map(([table, columns]) =>
        selectedRows(table, columns, championshipIds),
      ),
    )).map((relatedRows) => relatedRows.filter(isPublicDirectoryRow))
    const producerIds = Array.from(new Set(championships.map((row:any) => String(row.produtora_id || '')).filter(Boolean)))
    const producers = producerIds.length
      ? (await selectedRows('produtoras', 'id,nome,username,logo_url,status', producerIds, 'id')).filter(isPublicDirectoryRow)
      : []

    return buildChampionshipDirectoryItems({ championships, configs, phases, slots, games, producers })
  },
  ['public-championship-directory-v2'],
  { revalidate: 30, tags: ['directory:campeonatos'] },
)

const PUBLIC_TEAM_COLUMNS = 'id,nome,username,logo_url,tag,bio,localidade,cidade,estado,pais,status,created_at'
const PUBLIC_TEAM_PROFILE_LINE_COLUMNS = 'id,equipe_id,nome,tag,status,logo_url,created_at'
const PUBLIC_TEAM_PROFILE_PARTICIPATION_COLUMNS = 'id,equipe_id,campeonato_id,slot_numero,status,created_at'
const listPublicTeams = unstable_cache(
  async (): Promise<DirectoryItem[]> => {
    const teamRows = await selectedRows('equipes', PUBLIC_TEAM_COLUMNS)
    const teams = teamRows.filter(isPublicDirectoryRow)
    const teamIds = teams.map((row: any) => String(row.id)).filter(Boolean)
    if (teamIds.length === 0) return []

    const [lines, participations] = (await Promise.all([
      selectedRows('equipe_lines', 'equipe_id,nome,status', teamIds, 'equipe_id'),
      selectedRows('campeonato_equipes', 'equipe_id,status', teamIds, 'equipe_id'),
    ])).map((relatedRows) => relatedRows.filter(isPublicDirectoryRow))

    return buildTeamDirectoryItems({ teams, lines, participations })
  },
  ['public-team-directory-v1'],
  { revalidate: 30, tags: ['directory:equipes'] },
)

const PUBLIC_PLAYER_COLUMNS = 'id,nome,username,avatar_url,funcao,localidade,cidade,estado,pais,bio,id_jogo,status,created_at'
const PUBLIC_PLAYER_PROFILE_REGISTRATION_COLUMNS = 'id,campeonato_id,equipe_id,jogador_id,funcao,status,created_at'
const listPublicPlayers = unstable_cache(
  async (): Promise<DirectoryItem[]> => {
    const playerRows = await selectedRows('jogadores', PUBLIC_PLAYER_COLUMNS)
    const players = playerRows.filter(isPublicDirectoryRow)
    const playerIds = players.map((row: any) => String(row.id)).filter(Boolean)
    if (playerIds.length === 0) return []

    const registrations = (
      await selectedRows('campeonato_jogadores', 'jogador_id,status', playerIds, 'jogador_id')
    ).filter(isPublicDirectoryRow)
    return buildPlayerDirectoryItems({ players, registrations })
  },
  ['public-player-directory-v1'],
  { revalidate: 30, tags: ['directory:jogadores'] },
)

const getPublicPlayerProfileData = unstable_cache(
  async (id: string) => {
    const competitivePromise = getCompetitiveProfile('jogadores', id)
    const registrationRows = await selectedRows(
      'campeonato_jogadores',
      PUBLIC_PLAYER_PROFILE_REGISTRATION_COLUMNS,
      [id],
      'jogador_id',
    )
    const registrations = registrationRows.filter(isPublicDirectoryRow)
    const championshipIds = Array.from(new Set(
      registrations.map((row: any) => String(row.campeonato_id || '')).filter(Boolean),
    ))
    const teamIds = Array.from(new Set(
      registrations.map((row: any) => String(row.equipe_id || '')).filter(Boolean),
    ))
    const [championshipRows, teamRows, competitive] = await Promise.all([
      selectedRows('campeonatos', PUBLIC_CHAMPIONSHIP_COLUMNS, championshipIds, 'id'),
      selectedRows('equipes', PUBLIC_TEAM_COLUMNS, teamIds, 'id'),
      competitivePromise,
    ])
    return {
      registrations,
      championships: championshipRows.filter(isPublicDirectoryRow),
      teams: teamRows.filter(isPublicDirectoryRow),
      competitive,
    }
  },
  ['public-player-profile-v1'],
  { revalidate: 30, tags: ['directory:jogadores'] },
)

const PUBLIC_MANAGER_COLUMNS = 'id,nome,username,avatar_url,localidade,cidade,estado,pais,bio,status,created_at'
const PUBLIC_MANAGER_TEAM_LINK_COLUMNS = 'id,manager_id,equipe_id,status,created_at'
const PUBLIC_MANAGER_PRODUCER_LINK_COLUMNS = 'id,manager_id,produtora_id,status,created_at'
const PUBLIC_MANAGER_PLAYER_LINK_COLUMNS = 'id,manager_id,jogador_id,status,created_at'
const listPublicManagers = unstable_cache(
  async (): Promise<DirectoryItem[]> => {
    const managerRows = await selectedRows('managers', PUBLIC_MANAGER_COLUMNS)
    const managers = managerRows.filter(isPublicDirectoryRow)
    const managerIds = managers.map((row: any) => String(row.id)).filter(Boolean)
    if (managerIds.length === 0) return []

    const linkRows = await Promise.all([
      selectedRows('manager_equipe', 'manager_id,status', managerIds, 'manager_id'),
      selectedRows('manager_produtora', 'manager_id,status', managerIds, 'manager_id'),
      selectedRows('manager_jogador', 'manager_id,status', managerIds, 'manager_id'),
    ])
    const links = linkRows.flat().filter(isPublicDirectoryRow)
    return buildManagerDirectoryItems({ managers, links })
  },
  ['public-manager-directory-v1'],
  { revalidate: 30, tags: ['directory:managers'] },
)

const PUBLIC_PRODUCER_COLUMNS = 'id,auth_user_id,nome,username,logo_url,bio,localidade,cidade,estado,pais,status,created_at'
const PUBLIC_PRODUCER_CHAMPIONSHIP_COLUMNS = 'id,criado_por,produtora_id,status,aprovacao_status,deleted_at'

async function selectedProducerChampionships(columns: string, producerIds: string[], authUserIds: string[]) {
  if (producerIds.length === 0 && authUserIds.length === 0) return []
  const filters: string[] = []
  if (producerIds.length) filters.push(`produtora_id.in.(${producerIds.join(',')})`)
  if (authUserIds.length) filters.push(`criado_por.in.(${authUserIds.join(',')})`)
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select(columns)
    .or(filters.join(','))
    .limit(DIRECTORY_MAX_ROWS)
  if (error) throw error
  return data || []
}

const listPublicProducers = unstable_cache(
  async (): Promise<DirectoryItem[]> => {
    const producerRows = await selectedRows('produtoras', PUBLIC_PRODUCER_COLUMNS)
    const producers = producerRows.filter(isPublicDirectoryRow)
    const producerIds = producers.map((row: any) => String(row.id)).filter(Boolean)
    const authUserIds = producers.map((row: any) => String(row.auth_user_id)).filter(Boolean)
    if (producerIds.length === 0) return []

    const championshipRows = await selectedProducerChampionships(
      PUBLIC_PRODUCER_CHAMPIONSHIP_COLUMNS,
      producerIds,
      authUserIds,
    )
    const championships = championshipRows.filter(isPublicDirectoryRow)
    return buildProducerDirectoryItems({ producers, championships })
  },
  ['public-producer-directory-v1'],
  { revalidate: 30, tags: ['directory:produtoras'] },
)

const getPublicProducerProfileData = unstable_cache(
  async (id: string) => {
    const producerRow: any = (
      await selectedRows('produtoras', PUBLIC_PRODUCER_COLUMNS, [id], 'id')
    ).find(isPublicDirectoryRow)
    if (!producerRow) return null

    const championships = (
      await selectedProducerChampionships(
        PUBLIC_CHAMPIONSHIP_COLUMNS,
        [id],
        producerRow.auth_user_id ? [String(producerRow.auth_user_id)] : [],
      )
    ).filter(isPublicDirectoryRow)
    return { producerRow, championships }
  },
  ['public-producer-profile-v1'],
  { revalidate: 30, tags: ['directory:produtoras'] },
)

const getPublicManagerProfileData = unstable_cache(
  async (id: string) => {
    const [teamLinkRows, producerLinkRows, playerLinkRows] = await Promise.all([
      selectedRows('manager_equipe', PUBLIC_MANAGER_TEAM_LINK_COLUMNS, [id], 'manager_id'),
      selectedRows('manager_produtora', PUBLIC_MANAGER_PRODUCER_LINK_COLUMNS, [id], 'manager_id'),
      selectedRows('manager_jogador', PUBLIC_MANAGER_PLAYER_LINK_COLUMNS, [id], 'manager_id'),
    ])
    const teamLinks = teamLinkRows.filter(isPublicDirectoryRow)
    const producerLinks = producerLinkRows.filter(isPublicDirectoryRow)
    const playerLinks = playerLinkRows.filter(isPublicDirectoryRow)
    const teamIds = Array.from(new Set(teamLinks.map((row: any) => String(row.equipe_id || '')).filter(Boolean)))
    const producerIds = Array.from(new Set(producerLinks.map((row: any) => String(row.produtora_id || '')).filter(Boolean)))
    const playerIds = Array.from(new Set(playerLinks.map((row: any) => String(row.jogador_id || '')).filter(Boolean)))
    const [teamRows, producerRows, playerRows] = await Promise.all([
      selectedRows('equipes', PUBLIC_TEAM_COLUMNS, teamIds, 'id'),
      selectedRows('produtoras', PUBLIC_PRODUCER_COLUMNS, producerIds, 'id'),
      selectedRows('jogadores', PUBLIC_PLAYER_COLUMNS, playerIds, 'id'),
    ])
    return {
      teamLinks,
      producerLinks,
      playerLinks,
      teams: teamRows.filter(isPublicDirectoryRow),
      producers: producerRows.filter(isPublicDirectoryRow),
      players: playerRows.filter(isPublicDirectoryRow),
    }
  },
  ['public-manager-profile-v1'],
  { revalidate: 30, tags: ['directory:managers'] },
)

export async function listDirectory(kind: DirectoryKind): Promise<DirectoryItem[]> {
  if (kind === 'campeonatos') {
    return listPublicChampionships()
  }

  if (kind === 'equipes') {
    return listPublicTeams()
  }

  if (kind === 'jogadores') {
    return listPublicPlayers()
  }

  if (kind === 'managers') {
    return listPublicManagers()
  }

  return listPublicProducers()
}

export async function getDirectoryProfile(kind: DirectoryKind, id: string): Promise<DirectoryProfile | null> {
  const list = await listDirectory(kind)
  const base = list.find((item) => item.id === id)
  if (!base) return null
  const sections: DirectoryProfile['sections'] = []
  const details = [...base.meta]
  const actions: DirectoryProfile['actions'] = []

  let theme: DirectoryProfile['theme'] = null
  let enrollment: DirectoryProfile['enrollment'] = null
  let statsFilters: DirectoryProfile['statsFilters'] = undefined
  let competitive: DirectoryProfile['competitive'] = null

  if (kind === 'campeonatos') {
    const teamStatsPromise = listarEstatisticasEquipes(id, {}).catch(() => [])
    const mvpStatsPromise = listarEstatisticasMvp(id, {}).catch(() => [])
    const [championships, phases, groups, slots, games, rounds, participations, championshipPlayers, configs] = await Promise.all([
      scopedRows('campeonatos', { column: 'id', value: id }),
      scopedRows('campeonato_fases', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_grupos', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_slots', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_jogos', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_partidas_com_mapa', { column: 'campeonato_id', value: id }, { plain: true }),
      scopedRows('campeonato_equipes', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_jogadores', { column: 'campeonato_id', value: id }),
      scopedRows('campeonato_configuracoes', { column: 'campeonato_id', value: id }),
    ])
    const referencedTeamIds = Array.from(new Set(
      [...participations, ...slots].map((row: any) => String(row.equipe_id || '')).filter(Boolean),
    ))
    const referencedLineIds = Array.from(new Set(
      [...participations, ...slots].map((row: any) => String(row.line_id || '')).filter(Boolean),
    ))
    const referencedPlayerIds = Array.from(new Set(
      championshipPlayers.map((row: any) => String(row.jogador_id || '')).filter(Boolean),
    ))
    const referencedTemporaryPlayerIds = Array.from(new Set(
      championshipPlayers
        .map((row: any) => String(row.jogador_temporario_id || row.temporario_id || row.jogador_temp_id || ''))
        .filter(Boolean),
    ))
    const [teams, teamLines, players, temporaryPlayers, teamStats, mvpStats] = await Promise.all([
      scopedRows('equipes', { column: 'id', values: referencedTeamIds }),
      scopedRows('equipe_lines', { column: 'id', values: referencedLineIds }),
      scopedRows('jogadores', { column: 'id', values: referencedPlayerIds }),
      scopedRows('jogadores_temporarios', { column: 'id', values: referencedTemporaryPlayerIds }),
      teamStatsPromise,
      mvpStatsPromise,
    ])
    const championship: any = championships.find((row: any) => row.id === id) || {}
    const cfg: any = configs.find((row: any) => row.campeonato_id === id) || {}
    theme = {
      cor_principal: cfg.cor_principal || null,
      cor_secundaria: cfg.cor_secundaria || null,
      bg_opacidade: cfg.bg_opacidade != null ? Number(cfg.bg_opacidade) : null,
      bg_image_url: cfg.bg_image_url || null,
      cor_texto_clara: cfg.cor_texto_clara || null,
      cor_texto_escura: cfg.cor_texto_escura || null,
    }
    const champPhasesForCapacity = phases
      .filter((row: any) => row.campeonato_id === id)
      .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const entryOrder = champPhasesForCapacity.length ? Number(champPhasesForCapacity[0].ordem || 0) : null
    const entryPhaseIds = new Set(
      entryOrder == null
        ? []
        : champPhasesForCapacity
            .filter((row: any) => Number(row.ordem || 0) === entryOrder)
            .map((row: any) => String(row.id)),
    )
    const entrySlots = slots.filter(
      (row: any) =>
        row.campeonato_id === id
        && String(row.status || '') !== 'excluido'
        && (entryPhaseIds.size === 0 || !row.fase_id || entryPhaseIds.has(String(row.fase_id))),
    )
    const occupiedSlots = entrySlots.filter((row: any) => Boolean(row.equipe_id || row.line_id)).length
    const officialTotal = Math.max(0, Math.floor(Number(cfg.numero_vagas || 0)))
    const freeSlots = Math.max(0, officialTotal - occupiedSlots)
    enrollment = {
      aceita_novas_inscricoes: Boolean(cfg.aceita_novas_inscricoes_equipes),
      valor_inscricao:
        cfg.valor_inscricao != null && Number(cfg.valor_inscricao) > 0
          ? Number(cfg.valor_inscricao)
          : null,
      contatos_whatsapp: Array.isArray(cfg.contatos_whatsapp) ? cfg.contatos_whatsapp : [],
      vagas_livres: freeSlots,
      proximo_grupo: null,
      pagamento_pix_ativo: cfg.pagamento_pix_ativo !== false,
      pagamento_cartao_ativo: cfg.pagamento_cartao_ativo !== false,
      pagamento_paypal_ativo: cfg.pagamento_paypal_ativo === true,
      pagamento_whatsapp_ativo: cfg.pagamento_whatsapp_ativo !== false,
      cartao_max_parcelas: Math.min(12, Math.max(1, Number.parseInt(String(cfg.cartao_max_parcelas || '1'), 10) || 1)),
      paypal_moedas: Array.isArray(cfg.paypal_moedas) ? cfg.paypal_moedas.map(String) : ['BRL', 'USD', 'EUR'],
    }
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    const lineById = new Map(teamLines.map((row: any) => [row.id, row]))
    const champPhases = phases
      .filter((row: any) => row.campeonato_id === id)
      .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0))
    const champGroups = groups.filter((row: any) => row.campeonato_id === id)
    const champSlots = slots.filter((row: any) => row.campeonato_id === id)
    const champGames = games.filter((row: any) => row.campeonato_id === id)
    const champRounds = rounds.filter((row: any) => row.campeonato_id === id)
    const champParts = participations.filter((row: any) => row.campeonato_id === id && String(row.status || 'ativo') === 'ativo')
    const champPlayerRows = championshipPlayers.filter((row: any) => row.campeonato_id === id && String(row.status || 'ativo') !== 'deletado')
    const playerById = new Map(players.map((row: any) => [String(row.id), row]))
    const temporaryPlayerById = new Map(temporaryPlayers.map((row: any) => [String(row.id), row]))
    const participationById = new Map(champParts.map((row: any) => [String(row.id), row]))
    const mvpByPlayerId = new Map(mvpStats.map((row: any) => [String(row.campeonato_jogador_id), row]))

    details.length = 0
    details.push(
      { label: 'Tipo', value: first(base.eyebrow, '-') },
      { label: 'Formato', value: first(cfg.formato, '-') },
      { label: 'Inscrição', value: directoryMoney(cfg.valor_inscricao) },
      { label: 'Premiação', value: directoryMoney(cfg.premiacao ?? championship.premiacao) },
      { label: 'Total de vagas', value: officialTotal > 0 ? String(officialTotal) : '-' },
      { label: 'Vagas livres', value: officialTotal > 0 ? String(freeSlots) : '-' },
      { label: 'Jogadores por equipe', value: cfg.jogadores_por_vaga != null ? String(cfg.jogadores_por_vaga) : '-' },
      { label: 'Vagas por equipe', value: cfg.vagas_por_equipe != null ? String(cfg.vagas_por_equipe) : '-' },
      { label: 'Reservas', value: cfg.qtd_reservas != null ? String(cfg.qtd_reservas) : cfg.permite_reservas != null ? yesNo(cfg.permite_reservas) : '-' },
      { label: 'Troca de jogadores', value: yesNo(cfg.permite_troca_jogadores) },
      { label: 'Limite para trocas', value: dateLabel(cfg.data_limite_trocas) },
      { label: 'Inscrições até', value: dateLabel(cfg.data_limite_inscricao) },
      { label: 'Plataforma', value: first(cfg.plataforma, '-') },
      { label: 'Servidor', value: first(cfg.servidor, '-') },
      { label: 'Transmissão', value: yesNo(cfg.tem_live) },
      { label: 'Status', value: statusLabel(championship.status || 'ativo') },
    )

    const gameNameById = new Map(champGames.map((row: any) => [String(row.id), first(row.nome, `Jogo ${row.id}`)]))
    const mapCodes = Array.from(new Set(champRounds.map((row: any) => text(row.mapa_codigo)).filter(Boolean)))
    statsFilters = {
      phases: champPhases.map((row: any) => ({ id: String(row.id), label: first(row.nome, 'Fase') })),
      groups: champGroups.map((row: any) => ({
        id: String(row.id),
        label: first(row.nome, 'Grupo'),
        phaseId: row.fase_id ? String(row.fase_id) : null,
      })),
      games: champGames.map((row: any) => ({ id: String(row.id), label: first(row.nome, 'Jogo') })),
      rounds: champRounds
        .sort((a: any, b: any) => Number(a.numero_partida || 0) - Number(b.numero_partida || 0))
        .map((row: any) => ({
          id: String(row.id),
          label: `${gameNameById.get(String(row.jogo_id)) || 'Jogo'} · Queda ${Number(row.numero_partida || 0) || '-'}`,
          gameId: row.jogo_id ? String(row.jogo_id) : null,
          mapCode: text(row.mapa_codigo) || null,
        })),
      maps: mapCodes.map((code) => ({ id: code, label: code })),
    }

    // Ações antigas removidas do banner — navegação via ChampionshipPublicView
    actions.length = 0
    sections.push({
      title: 'Jogadores participantes',
      layout: 'list',
      items: champPlayerRows.map((row: any) => {
        const registered = row.jogador_id ? playerById.get(String(row.jogador_id)) : null
        const temporaryId = row.jogador_temporario_id || row.temporario_id || row.jogador_temp_id
        const temporary = temporaryId ? temporaryPlayerById.get(String(temporaryId)) : null
        const participation: any = participationById.get(String(row.campeonato_equipe_id || ''))
        const team: any = participation?.equipe_id ? teamById.get(participation.equipe_id) : null
        const line: any = participation?.line_id ? lineById.get(participation.line_id) : null
        const performance: any = mvpByPlayerId.get(String(row.id))
        return {
          id: String(row.id),
          title: first(row.nick, registered?.nick, registered?.nome, temporary?.nick, 'Jogador'),
          subtitle: first(line?.nome, team?.nome, 'Equipe não informada'),
          image: first(row.foto_url, registered?.avatar_url, registered?.foto_url, temporary?.foto_url),
          stats: {
            campeonato_equipe_id: row.campeonato_equipe_id || null,
            partidas: Number(performance?.quedas || 0),
            equipe_nome: first(line?.nome, team?.nome, 'Equipe não informada'),
          },
        }
      }),
    })
    sections.push({
      title: 'Tabela',
      layout: 'stats',
      items: teamStats.slice(0, 100).map((row: any) => ({
        id: row.campeonato_equipe_id,
        title: row.nome,
        subtitle: row.tag || undefined,
        image: first(row.logo_url),
        stats: {
          colocacao: Number(row.colocacao || 0),
          grupo_id: row.grupo_id || null,
          quedas: Number(row.quedas || 0),
          booyahs: Number(row.booyahs || 0),
          abates: Number(row.abates || 0),
          pontos_posicao: Number(row.pontos_posicao || 0),
          pontos_abates: Number(row.pontos_abates || 0),
          pontos_total: Number(row.pontos_total || 0),
        },
      })),
    })
    sections.push({
      title: 'MVP',
      layout: 'stats',
      items: mvpStats.slice(0, 100).map((row: any) => ({
        id: row.campeonato_jogador_id,
        title: row.nick,
        subtitle: row.id_jogo || undefined,
        image: first(row.foto_url),
        stats: {
          colocacao: Number(row.colocacao || 0),
          campeonato_equipe_id: row.campeonato_equipe_id || null,
          quedas: Number(row.quedas || 0),
          abates: Number(row.abates || 0),
          dano: Number(row.dano || 0),
          assistencias: Number(row.assistencias || 0),
          revives: Number(row.revives || 0),
        },
      })),
    })

    // Leitura pública: fases → grupos → slots (sem ações de editar)
    sections.push({
      title: 'Fases e grupos',
      layout: 'structure',
      items: champPhases.map((phase: any) => {
        const phaseGroups = champGroups
          .filter((group: any) => group.fase_id === phase.id)
          .sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
        const totalSlots = phaseGroups.reduce((sum: number, group: any) => {
          const groupSlotCount = champSlots.filter((s: any) => s.grupo_id === group.id).length
          return sum + (groupSlotCount || Number(group.slots || 0))
        }, 0)

        return {
          id: phase.id,
          title: phase.nome,
          subtitle: `${phaseGroups.length} grupo(s) · ${totalSlots} slot(s)`,
          children: phaseGroups.map((group: any) => {
            const groupSlots = champSlots
              .filter((s: any) => s.grupo_id === group.id)
              .sort((a: any, b: any) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
            const occupied = groupSlots.filter((s: any) => s.line_id || s.equipe_id).length

            return {
              id: group.id,
              title: group.nome,
              subtitle: `${occupied}/${groupSlots.length || Number(group.slots || 0)} slots preenchidos`,
              children: (groupSlots.length
                ? groupSlots
                : Array.from({ length: Number(group.slots || 0) }, (_, index) => ({
                    id: `${group.id}-ghost-${index + 1}`,
                    slot_numero: index + 1,
                    slot_letra: String.fromCharCode(65 + (index % 26)),
                    line_id: null,
                    equipe_id: null,
                  }))
              ).map((slot: any) => {
                const slotNum = Number(slot.slot_numero || 0)
                const letter = first(
                  slot.slot_letra,
                  slotNum > 0 ? String.fromCharCode(64 + Math.min(slotNum, 26)) : '?',
                )
                const line = slot.line_id ? lineById.get(slot.line_id) : null
                const team = slot.equipe_id ? teamById.get(slot.equipe_id) : null
                const part = champParts.find(
                  (p: any) =>
                    p.slot_id === slot.id
                    || (p.grupo_id === group.id && Number(p.slot_numero) === slotNum && p.line_id === slot.line_id),
                )
                const filled = Boolean(slot.line_id || slot.equipe_id || part)
                // Mesmo padrão da aba Equipes: nome principal = line / "Slot X"
                const lineName = filled
                  ? first(line?.nome, part?.nome_exibicao, part?.line_nome, 'Line inscrita')
                  : `Slot ${letter}`
                const teamName = first(team?.nome, part?.equipe_nome)
                const logo = first(line?.logo_url, team?.logo_url)

                return {
                  id: String(slot.id || `${group.id}-${letter}`),
                  badge: letter,
                  title: lineName,
                  subtitle: filled
                    ? [teamName, group.nome].filter(Boolean).join(' · ') || 'Line no campeonato'
                    : [group.nome].filter(Boolean).join(' · ') || 'Disponível',
                  image: logo || undefined,
                  status: filled ? 'ocupada' : 'livre',
                }
              }),
            }
          }),
        }
      }),
    })
    sections.push({
      title: 'Jogos',
      items: champGames.map((game: any) => ({
        id: game.id,
        title: game.nome,
        subtitle: [game.data_jogo, game.horario ? String(game.horario).slice(0, 5) : '', `${game.numero_partidas || 0} quedas`].filter(Boolean).join(' · ') || 'Data a definir',
        meta: Array.isArray(game.grupos_ids) ? game.grupos_ids.slice(0, 6).map((groupId: string) => ({ label: 'Grupo', value: first(champGroups.find((group: any) => group.id === groupId)?.nome, groupId) })) : [],
      })),
    })
    sections.push({
      title: 'Equipes participantes',
      items: champParts.map((entry: any) => {
        const team: any = teamById.get(entry.equipe_id)
        const line: any = entry.line_id ? lineById.get(entry.line_id) : null
        return {
          id: entry.id,
          title: first(line?.nome, entry.nome_exibicao, team?.nome, 'Line'),
          image: first(line?.logo_url, team?.logo_url),
          href: team ? `/equipes/${team.id}` : undefined,
          subtitle: [
            team?.nome,
            entry.slot_letra || (entry.slot_numero ? `Slot ${entry.slot_numero}` : null),
            entry.origem_entrada ? `via ${entry.origem_entrada}` : null,
          ].filter(Boolean).join(' · ') || 'Participação confirmada',
        }
      }),
    })
  } else if (kind === 'equipes') {
    const competitivePromise = getCompetitiveProfile('equipes', id)
    const [lineRows, participationRows] = await Promise.all([
      selectedRows('equipe_lines', PUBLIC_TEAM_PROFILE_LINE_COLUMNS, [id], 'equipe_id'),
      selectedRows('campeonato_equipes', PUBLIC_TEAM_PROFILE_PARTICIPATION_COLUMNS, [id], 'equipe_id'),
    ])
    const lines = lineRows.filter(isPublicDirectoryRow)
    const participations = participationRows.filter(isPublicDirectoryRow)
    const championshipIds = Array.from(new Set(
      participations.map((row: any) => String(row.campeonato_id || '')).filter(Boolean),
    ))
    const [championshipRows, competitiveResult] = await Promise.all([
      selectedRows('campeonatos', PUBLIC_CHAMPIONSHIP_COLUMNS, championshipIds, 'id'),
      competitivePromise,
    ])
    const championships = championshipRows.filter(isPublicDirectoryRow)
    const championshipById = new Map(championships.map((row: any) => [row.id, row]))
    sections.push({ title: 'Lines', items: lines.filter((x: any) => x.equipe_id === id).map((line: any) => ({ id: line.id, title: line.nome, subtitle: first(line.tag, statusLabel(line.status)), image: first(line.logo_url) })) })
    competitive = competitiveResult
    sections.push({ title: 'Campeonatos', items: participations.filter((x: any) => x.equipe_id === id).map((entry: any) => { const champ: any = championshipById.get(entry.campeonato_id); return { id: entry.id, title: first(champ?.nome, 'Campeonato'), subtitle: entry.slot_numero ? `Slot ${entry.slot_numero}` : statusLabel(entry.status), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'jogadores') {
    const playerData = await getPublicPlayerProfileData(id)
    const regs = playerData.registrations
    const championships = playerData.championships
    const teams = playerData.teams
    const champById = new Map(championships.map((row: any) => [row.id, row]))
    const teamById = new Map(teams.map((row: any) => [row.id, row]))
    competitive = playerData.competitive
    sections.push({ title: 'Participações', items: regs.filter((x: any) => x.jogador_id === id && x.status !== 'deletado').map((reg: any) => { const champ: any = champById.get(reg.campeonato_id); const team: any = teamById.get(reg.equipe_id); return { id: reg.id, title: first(champ?.nome, 'Campeonato'), subtitle: [team?.nome, reg.funcao].filter(Boolean).join(' · '), image: first(champ?.logo_url), href: champ ? `/campeonatos/${champ.id}` : undefined } }) })
  } else if (kind === 'produtoras') {
    const producerData = await getPublicProducerProfileData(id)
    const producerRow: any = producerData?.producerRow
    const items = producerData?.championships || []
    const producerBio = text(producerRow?.bio)
    // Bio já aparece no banner (description); nos detalhes só se for diferente da localidade
    if (producerBio) {
      details.unshift({ label: 'Sobre', value: producerBio })
    }
    sections.push({ title: 'Campeonatos produzidos', items: items.map((champ: any) => ({ id: champ.id, title: champ.nome, subtitle: statusLabel(champ.status), image: first(champ.logo_url), href: `/campeonatos/${champ.id}` })) })
  } else {
    const managerData = await getPublicManagerProfileData(id)
    const { teamLinks, producerLinks, playerLinks, teams, producers, players } = managerData
    const mapItems = (links: any[], collection: any[], key: string, href: string) => links.filter((x: any) => x.manager_id === id).map((link: any) => { const target = collection.find((x: any) => x.id === link[key]); return target ? { id: link.id, title: first(target.nome, target.nick, target.username), image: first(target.logo_url, target.avatar_url), href: `/${href}/${target.id}`, subtitle: statusLabel(link.status) } : null }).filter(Boolean) as any[]
    sections.push({ title: 'Equipes administradas', items: mapItems(teamLinks, teams, 'equipe_id', 'equipes') })
    sections.push({ title: 'Produtoras vinculadas', items: mapItems(producerLinks, producers, 'produtora_id', 'produtoras') })
    sections.push({ title: 'Jogadores vinculados', items: mapItems(playerLinks, players, 'jogador_id', 'jogadores') })
  }

  return {
    ...base,
    details,
    actions,
    sections,
    theme,
    enrollment,
    statsFilters,
    competitive,
  }
}
