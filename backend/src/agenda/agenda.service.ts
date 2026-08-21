import { supabaseAdmin } from '../shared/supabase-admin'
import { getAccountsByUserId } from '../auth/server-auth'

export type AgendaScope = 'me' | 'campeonato' | 'equipe'

export type AgendaItemSource = 'jogo' | 'livre'

export type AgendaItem = {
  id: string
  source: AgendaItemSource
  titulo: string
  descricao?: string | null
  data: string
  horario_inicio: string
  horario_fim: string | null
  cor: string
  tipo: string
  visibilidade?: string
  editable: boolean
  meta: {
    campeonato_id?: string | null
    campeonato_nome?: string | null
    equipe_id?: string | null
    equipe_nome?: string | null
    jogo_id?: string | null
    status?: string | null
    numero_partidas?: number | null
    href?: string | null
  }
}

export type AgendaEventInput = {
  titulo: string
  descricao?: string | null
  data_evento: string
  horario_inicio: string
  horario_fim?: string | null
  cor?: string | null
  tipo?: string | null
  visibilidade?: string | null
  campeonato_id?: string | null
  equipe_id?: string | null
}

export type ListAgendaParams = {
  scope: AgendaScope
  scopeId?: string | null
  from: string
  to: string
  authUserId?: string | null
}

type AgendaListResult = {
  items: AgendaItem[]
  setup_required: boolean
  can_manage: boolean
  managed_championships: Array<{ id: string; nome: string }>
}

const PRESET_COLORS = [
  '#3b82f6', // azul
  '#ef4444', // vermelho
  '#8b5cf6', // roxo
  '#16a34a', // verde
  '#f59e0b', // laranja
  '#ec4899', // rosa
  '#0ea5e9', // ciano
  '#a855f7', // violeta
]

const TIPOS = new Set(['livre', 'treino', 'reuniao', 'scrim', 'outro'])
const VISIBILIDADES = new Set(['privada', 'equipe', 'campeonato', 'publica'])

function nonEmpty(value: unknown, field: string) {
  const clean = String(value ?? '').trim()
  if (!clean) throw new Error(`${field} é obrigatório.`)
  return clean
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTime(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function normalizeTime(value: unknown): string | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const h = String(Math.min(23, Number(match[1]))).padStart(2, '0')
  const m = String(Math.min(59, Number(match[2]))).padStart(2, '0')
  return `${h}:${m}`
}

function timeToMinutes(value: string | null | undefined) {
  const t = normalizeTime(value)
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(total: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function colorFromSeed(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PRESET_COLORS[hash % PRESET_COLORS.length]
}

function isMissingRelation(error: any) {
  return ['42P01', 'PGRST205'].includes(String(error?.code || ''))
}

function estimateGameEnd(horario: string | null, numeroPartidas: number, intervaloMinutos?: number | null) {
  const start = timeToMinutes(horario)
  if (start == null) return null
  const quedas = Math.max(1, Number(numeroPartidas) || 1)
  const intervalo = Math.max(15, Number(intervaloMinutos) || 25)
  // duração estimada: 1ª queda ~25min + intervalos entre quedas
  const duration = quedas * intervalo
  return minutesToTime(start + duration)
}

function sanitizeEventInput(input: Partial<AgendaEventInput>) {
  const titulo = nonEmpty(input.titulo, 'Título')
  const data = nonEmpty(input.data_evento, 'Data')
  if (!isDate(data)) throw new Error('Data inválida.')

  const inicio = normalizeTime(input.horario_inicio)
  if (!inicio || !isTime(inicio)) throw new Error('Horário de início inválido.')

  const fim = normalizeTime(input.horario_fim)
  if (fim) {
    const a = timeToMinutes(inicio)!
    const b = timeToMinutes(fim)!
    if (b <= a) throw new Error('Horário final deve ser depois do início.')
  }

  const tipo = String(input.tipo || 'livre').trim().toLowerCase()
  if (!TIPOS.has(tipo)) throw new Error('Tipo de agenda inválido.')

  const visibilidade = String(input.visibilidade || 'privada').trim().toLowerCase()
  if (!VISIBILIDADES.has(visibilidade)) throw new Error('Visibilidade inválida.')

  const corRaw = String(input.cor || '#3b82f6').trim()
  const cor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(corRaw) ? corRaw : '#3b82f6'

  return {
    titulo: titulo.slice(0, 120),
    descricao: input.descricao != null ? String(input.descricao).trim().slice(0, 500) || null : null,
    data_evento: data,
    horario_inicio: inicio,
    horario_fim: fim,
    cor,
    tipo,
    visibilidade,
    campeonato_id: input.campeonato_id ? String(input.campeonato_id).trim() || null : null,
    equipe_id: input.equipe_id ? String(input.equipe_id).trim() || null : null,
  }
}

async function loadChampionshipNames(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map<string, string>()
  const { data, error } = await supabaseAdmin.from('campeonatos').select('id, nome').in('id', unique)
  if (error) throw error
  return new Map((data || []).map((row: any) => [row.id, row.nome]))
}

async function loadTeamNames(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map<string, string>()
  const { data, error } = await supabaseAdmin.from('equipes').select('id, nome').in('id', unique)
  if (error) throw error
  return new Map((data || []).map((row: any) => [row.id, row.nome]))
}

function mapFreeEvent(row: any, editable: boolean, champNames: Map<string, string>, teamNames: Map<string, string>): AgendaItem {
  return {
    id: row.id,
    source: 'livre',
    titulo: row.titulo,
    descricao: row.descricao || null,
    data: String(row.data_evento).slice(0, 10),
    horario_inicio: normalizeTime(row.horario_inicio) || '00:00',
    horario_fim: normalizeTime(row.horario_fim),
    cor: row.cor || '#3b82f6',
    tipo: row.tipo || 'livre',
    visibilidade: row.visibilidade || 'privada',
    editable,
    meta: {
      campeonato_id: row.campeonato_id || null,
      campeonato_nome: row.campeonato_id ? champNames.get(row.campeonato_id) || null : null,
      equipe_id: row.equipe_id || null,
      equipe_nome: row.equipe_id ? teamNames.get(row.equipe_id) || null : null,
      jogo_id: row.jogo_id || null,
      href: row.campeonato_id ? `/campeonatos/${row.campeonato_id}` : row.equipe_id ? `/equipes/${row.equipe_id}` : null,
    },
  }
}

function mapGameEvent(game: any, champName: string | null, editable = false): AgendaItem {
  const inicio = normalizeTime(game.horario)
  const fim = estimateGameEnd(
    inicio,
    Number(game.numero_partidas || 1),
    game.intervalo_quedas_minutos ?? game.intervalo_minutos,
  )
  const seed = String(game.campeonato_id || game.id)
  return {
    id: `jogo:${game.id}`,
    source: 'jogo',
    titulo: game.nome || 'Jogo',
    descricao: champName ? `Campeonato: ${champName}` : null,
    data: String(game.data_jogo || '').slice(0, 10),
    horario_inicio: inicio || '18:00',
    horario_fim: fim,
    cor: colorFromSeed(seed),
    tipo: 'jogo',
    editable,
    meta: {
      campeonato_id: game.campeonato_id || null,
      campeonato_nome: champName,
      jogo_id: game.id,
      status: game.status || null,
      numero_partidas: game.numero_partidas ?? null,
      href: game.campeonato_id ? `/campeonatos/${game.campeonato_id}` : null,
    },
  }
}

function mapProjectedGame(row: any, editable = false): AgendaItem {
  return {
    id: `jogo:${row.jogo_id}`,
    source: 'jogo',
    titulo: row.titulo || 'Jogo',
    descricao: row.campeonato_nome ? `Campeonato: ${row.campeonato_nome}` : null,
    data: String(row.data_evento).slice(0, 10),
    horario_inicio: normalizeTime(row.horario_inicio) || '18:00',
    horario_fim: normalizeTime(row.horario_fim),
    cor: colorFromSeed(String(row.campeonato_id || row.jogo_id)),
    tipo: 'jogo',
    editable,
    meta: {
      campeonato_id: row.campeonato_id,
      campeonato_nome: row.campeonato_nome || null,
      jogo_id: row.jogo_id,
      status: row.status || null,
      href: row.campeonato_id ? `/campeonatos/${row.campeonato_id}` : null,
    },
  }
}

async function listFreeEvents(params: {
  from: string
  to: string
  authUserId?: string | null
  campeonatoId?: string | null
  equipeId?: string | null
  onlyPublicOrShared?: boolean
}) {
  let query = supabaseAdmin
    .from('agenda_eventos')
    .select('*')
    .gte('data_evento', params.from)
    .lte('data_evento', params.to)
    .order('data_evento', { ascending: true })
    .order('horario_inicio', { ascending: true })

  if (params.campeonatoId) {
    query = query.eq('campeonato_id', params.campeonatoId)
  }
  if (params.equipeId) {
    query = query.eq('equipe_id', params.equipeId)
  }

  const { data, error } = await query
  if (isMissingRelation(error)) return { items: [] as any[], setupRequired: true }
  if (error) throw error

  let rows = data || []

  if (params.onlyPublicOrShared) {
    rows = rows.filter((row: any) => {
      if (params.authUserId && row.auth_user_id === params.authUserId) return true
      if (row.visibilidade === 'publica') return true
      if (params.campeonatoId && row.visibilidade === 'campeonato') return true
      if (params.equipeId && row.visibilidade === 'equipe') return true
      return false
    })
  } else if (params.authUserId && !params.campeonatoId && !params.equipeId) {
    rows = rows.filter((row: any) => row.auth_user_id === params.authUserId)
  }

  return { items: rows, setupRequired: false }
}

async function listGamesByChampionshipIds(campeonatoIds: string[], from: string, to: string) {
  const ids = [...new Set(campeonatoIds.filter(Boolean))]
  if (!ids.length) return [] as any[]

  // O perfil de uma produtora pode acumular muitos campeonatos ao longo do tempo.
  // Enviar todos os UUIDs em um único filtro `in` pode ultrapassar o limite da URL
  // do PostgREST e resultar em 400 mesmo quando o intervalo consultado é válido.
  const BATCH_SIZE = 50
  const batches = Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, index) =>
    ids.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  )
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabaseAdmin
        .from('campeonato_jogos')
        .select('*')
        .in('campeonato_id', batch)
        .gte('data_jogo', from)
        .lte('data_jogo', to)
        .order('data_jogo', { ascending: true })
        .order('horario', { ascending: true })
      if (error) throw error
      return data || []
    }),
  )
  const games = results.flat()

  return games
    .filter((game: any) => {
      if (!game.data_jogo) return false
      const status = String(game.status || '').toLowerCase()
      return !['cancelado', 'rascunho', 'deletado'].includes(status)
    })
    .sort((a: any, b: any) => {
      const byDate = String(a.data_jogo || '').localeCompare(String(b.data_jogo || ''))
      if (byDate !== 0) return byDate
      return String(a.horario || '').localeCompare(String(b.horario || ''))
    })
}

async function resolveUserContext(authUserId: string) {
  const accounts = await getAccountsByUserId(authUserId)
  const teamIds = accounts.filter((a) => a.profile_type === 'equipe').map((a) => a.id)
  const playerIds = accounts.filter((a) => a.profile_type === 'jogador').map((a) => a.id)
  const managerIds = accounts.filter((a) => a.profile_type === 'manager').map((a) => a.id)
  const producerIds = accounts.filter((a) => a.profile_type === 'produtora').map((a) => a.id)

  const campeonatoIds = new Set<string>()
  const managedChampionshipIds = new Set<string>()
  const equipeIds = new Set<string>(teamIds)

  // Estas consultas não dependem umas das outras: executá-las em série fazia a
  // agenda esperar vários round-trips ao banco antes de mostrar qualquer jogo.
  const [producerChampions, createdChampions, managerTeams, playerEntries] = await Promise.all([
    producerIds.length
      ? supabaseAdmin.from('campeonatos').select('id').in('produtora_id', producerIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabaseAdmin.from('campeonatos').select('id').eq('criado_por', authUserId),
    managerIds.length
      ? supabaseAdmin.from('manager_equipe').select('equipe_id').in('manager_id', managerIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    playerIds.length
      ? supabaseAdmin.from('campeonato_jogadores').select('campeonato_id, equipe_id').in('jogador_id', playerIds).neq('status', 'deletado')
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  for (const row of producerChampions.data || []) {
    campeonatoIds.add(row.id)
    managedChampionshipIds.add(row.id)
  }
  for (const row of createdChampions.data || []) {
    campeonatoIds.add(row.id)
    managedChampionshipIds.add(row.id)
  }
  for (const row of managerTeams.data || []) if (row.equipe_id) equipeIds.add(row.equipe_id)
  for (const row of playerEntries.data || []) {
    if (row.campeonato_id) campeonatoIds.add(row.campeonato_id)
    if (row.equipe_id) equipeIds.add(row.equipe_id)
  }

  if (equipeIds.size) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('campeonato_id')
      .in('equipe_id', [...equipeIds])
    if (error) throw error
    for (const row of data || []) if (row.campeonato_id) campeonatoIds.add(row.campeonato_id)
  }

  return {
    campeonatoIds: [...campeonatoIds],
    managedChampionshipIds: [...managedChampionshipIds],
    equipeIds: [...equipeIds],
    accounts,
  }
}

async function assertCanManageChampionshipAgenda(authUserId: string, campeonatoId: string | null | undefined) {
  const championshipId = nonEmpty(campeonatoId, 'Campeonato')
  const context = await resolveUserContext(authUserId)
  if (!context.managedChampionshipIds.includes(championshipId)) {
    throw new Error('Somente o responsavel pelo campeonato pode alterar a agenda.')
  }
  return championshipId
}

async function listTeamGames(equipeId: string, from: string, to: string) {
  const { data: parts, error: partsError } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('campeonato_id, grupo_id, status')
    .eq('equipe_id', equipeId)
  if (partsError) throw partsError

  const champIds = [...new Set((parts || []).map((p: any) => p.campeonato_id).filter(Boolean))]
  if (!champIds.length) return [] as any[]

  const grupoByChamp = new Map<string, Set<string>>()
  for (const part of parts || []) {
    if (!part.campeonato_id || !part.grupo_id) continue
    const set = grupoByChamp.get(part.campeonato_id) || new Set<string>()
    set.add(part.grupo_id)
    grupoByChamp.set(part.campeonato_id, set)
  }

  const games = await listGamesByChampionshipIds(champIds, from, to)

  // Preferir jogos do(s) grupo(s) da equipe; se jogo não tem grupos, manter
  return games.filter((game: any) => {
    const allowed = grupoByChamp.get(game.campeonato_id)
    if (!allowed || !allowed.size) return true
    const grupos = Array.isArray(game.grupos_ids) ? game.grupos_ids.map(String) : []
    if (!grupos.length) return true
    return grupos.some((g: string) => allowed.has(g))
  })
}

export async function listAgenda(params: ListAgendaParams): Promise<AgendaListResult> {
  const from = nonEmpty(params.from, 'Data inicial')
  const to = nonEmpty(params.to, 'Data final')
  if (!isDate(from) || !isDate(to)) throw new Error('Intervalo de datas inválido.')
  if (from > to) throw new Error('Data inicial maior que a final.')

  const authUserId = params.authUserId || null
  let rows: any[] = []

  if (params.scope === 'campeonato') {
    const campeonatoId = nonEmpty(params.scopeId, 'Campeonato')
    const { data, error } = await supabaseAdmin
      .from('agenda_compromissos')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .gte('data_evento', from).lte('data_evento', to)
      .order('data_evento').order('horario_inicio')
    if (error) throw error
    // A projeção possui uma linha por destinatário; no calendário público o
    // mesmo jogo deve aparecer apenas uma vez.
    rows = [...new Map((data || []).map((row: any) => [row.jogo_id, row])).values()]
  } else if (params.scope === 'equipe') {
    const equipeId = nonEmpty(params.scopeId, 'Equipe')
    const { data, error } = await supabaseAdmin
      .from('agenda_compromissos')
      .select('*')
      .eq('destino_tipo', 'equipe').eq('destino_id', equipeId)
      .gte('data_evento', from).lte('data_evento', to)
      .order('data_evento').order('horario_inicio')
    if (error) throw error
    rows = data || []
  } else {
    if (!authUserId) throw new Error('Faça login para ver sua agenda.')
    const accounts = await getAccountsByUserId(authUserId)
    const teamIds = accounts.filter((account) => account.profile_type === 'equipe').map((account) => account.id)
    const queries = [
      supabaseAdmin.from('agenda_compromissos').select('*')
        .eq('destino_tipo', 'usuario').eq('destino_id', authUserId)
        .gte('data_evento', from).lte('data_evento', to),
      teamIds.length
        ? supabaseAdmin.from('agenda_compromissos').select('*')
          .eq('destino_tipo', 'equipe').in('destino_id', teamIds)
          .gte('data_evento', from).lte('data_evento', to)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]
    const [personal, team] = await Promise.all(queries)
    if (personal.error) throw personal.error
    if (team.error) throw team.error
    rows = [...new Map([...(personal.data || []), ...(team.data || [])].map((row: any) => [row.jogo_id, row])).values()]
  }

  const items = rows.map((row) => mapProjectedGame(row, Boolean(authUserId && row.owner_auth_user_id === authUserId)))

  items.sort((a, b) => {
    const d = a.data.localeCompare(b.data)
    if (d !== 0) return d
    return a.horario_inicio.localeCompare(b.horario_inicio)
  })

  return { items, setup_required: false, can_manage: false, managed_championships: [] }
}

export async function createAgendaEvent(authUserId: string, input: AgendaEventInput) {
  const payload = sanitizeEventInput(input)
  const campeonatoId = await assertCanManageChampionshipAgenda(authUserId, payload.campeonato_id)
  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .insert({
      auth_user_id: authUserId,
      ...payload,
      campeonato_id: campeonatoId,
      visibilidade: 'campeonato',
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (isMissingRelation(error)) {
    throw new Error('Tabela de agenda ainda não foi criada no banco. Rode a migration 20260719_agenda_eventos.sql.')
  }
  if (error) throw error
  return data
}

export async function updateAgendaEvent(authUserId: string, id: string, input: Partial<AgendaEventInput>) {
  const eventId = nonEmpty(id, 'ID do evento')
  const { data: existing, error: findError } = await supabaseAdmin
    .from('agenda_eventos')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (isMissingRelation(findError)) {
    throw new Error('Tabela de agenda ainda não foi criada no banco. Rode a migration 20260719_agenda_eventos.sql.')
  }
  if (findError) throw findError
  if (!existing) throw new Error('Evento não encontrado.')
  if (existing.auth_user_id !== authUserId) throw new Error('Você não pode editar este evento.')

  const payload = sanitizeEventInput({
    titulo: input.titulo ?? existing.titulo,
    descricao: input.descricao !== undefined ? input.descricao : existing.descricao,
    data_evento: input.data_evento ?? existing.data_evento,
    horario_inicio: input.horario_inicio ?? existing.horario_inicio,
    horario_fim: input.horario_fim !== undefined ? input.horario_fim : existing.horario_fim,
    cor: input.cor ?? existing.cor,
    tipo: input.tipo ?? existing.tipo,
    visibilidade: input.visibilidade ?? existing.visibilidade,
    campeonato_id: input.campeonato_id !== undefined ? input.campeonato_id : existing.campeonato_id,
    equipe_id: input.equipe_id !== undefined ? input.equipe_id : existing.equipe_id,
  })
  payload.campeonato_id = await assertCanManageChampionshipAgenda(authUserId, payload.campeonato_id)
  payload.visibilidade = 'campeonato'

  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('auth_user_id', authUserId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function deleteAgendaEvent(authUserId: string, id: string) {
  const eventId = nonEmpty(id, 'ID do evento')
  const { data: existing, error: findError } = await supabaseAdmin
    .from('agenda_eventos')
    .select('id, auth_user_id, campeonato_id')
    .eq('id', eventId)
    .maybeSingle()

  if (isMissingRelation(findError)) {
    throw new Error('Tabela de agenda ainda não foi criada no banco. Rode a migration 20260719_agenda_eventos.sql.')
  }
  if (findError) throw findError
  if (!existing) throw new Error('Evento não encontrado.')
  if (existing.auth_user_id !== authUserId) throw new Error('Você não pode excluir este evento.')

  await assertCanManageChampionshipAgenda(authUserId, existing.campeonato_id)

  const { error } = await supabaseAdmin
    .from('agenda_eventos')
    .delete()
    .eq('id', eventId)
    .eq('auth_user_id', authUserId)

  if (error) throw error
  return { ok: true }
}

export const AGENDA_DEFAULT_SLOTS = ['13:00', '15:00', '16:00', '18:00', '19:00', '20:00', '21:00', '22:00']
export const AGENDA_PRESET_COLORS = PRESET_COLORS
