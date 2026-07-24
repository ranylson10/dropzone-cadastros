import { NextRequest, NextResponse } from 'next/server'
import { getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { assertPodeCriarSlots } from '@backend/campeonatos/capacidade'
import {
  inserirParticipacaoNoSlot,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { syncRulebookFromCampeonato } from '@backend/campeonatos/rulebook'
import { CHAMPIONSHIP_TYPES, DAILY_HOURS, GROUP_LETTERS, type ChampionshipType } from '@/lib/dropzone-constants'
import {
  buildGroupInviteShareMessage,
  buildLinkMetaPayload,
  encodeLinkDescricao,
  extractHumanDescricao,
  isMissingDeletedAtColumn,
  isMissingMetadataColumn,
  normalizeExpectedTeams,
  parseExpectedTeamsFromText,
  parseLinkMetadata,
  registrationLinkData,
} from '@backend/shared/campeonato-link-metadata'
import { randomToken } from '@backend/shared/validation'

const HIDDEN_DATA_KEYS = new Set([
  'senha',
  'senha_dono',
  'senha_hash',
  'email_contato',
  'email_verificado',
])

function safeData(row: any, extra: Record<string, any> = {}) {
  const data = { ...row, ...extra }
  for (const key of HIDDEN_DATA_KEYS) delete data[key]
  return data
}

function baseRow(row: any, entityType: string, extra: Partial<any> = {}) {
  return {
    id: row.id,
    entity_type: entityType,
    auth_user_id: row.auth_user_id ?? null,
    profile_type: row.profile_type ?? null,
    username: row.username ?? null,
    public_id: row.public_id ?? null,
    name: row.nome || row.nome_exibido || row.nick || row.token || null,
    token: row.token ?? null,
    parent_id: row.campeonato_id || row.parent_id || null,
    ref_id: row.equipe_id || row.ref_id || null,
    status: row.status || 'ativo',
    data: safeData(row, extra.data || {}),
    created_by: row.criado_por || row.auth_user_id || row.dono_auth_user_id || row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }
}

/**
 * Aceita ISO com fuso (preferido, convertido no browser) ou datetime-local.
 * Rejeita validade no passado para não gravar link já expirado.
 */
function parseOptionalDateTime(
  value: unknown,
  options?: { fieldLabel?: string; requireFuture?: boolean },
): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${options?.fieldLabel || 'Data'} inválida.`)
  }
  if (options?.requireFuture && date.getTime() <= Date.now()) {
    throw new Error(
      `${options.fieldLabel || 'Data'} precisa ser no futuro. O link nasceria já expirado.`,
    )
  }
  return date.toISOString()
}

const TABLE_BY_ENTITY: Record<string, string> = {
  championship: 'campeonatos',
  team: 'equipes',
  team_line: 'equipe_lines',
  player_team: 'equipe_jogadores',
  championship_team: 'campeonato_equipes',
  player_registration: 'campeonato_jogadores',
  phase: 'campeonato_fases',
  group: 'campeonato_grupos',
  group_slot: 'campeonato_slots',
  game: 'campeonato_jogos',
  invite_token: 'tokens',
  registration_link: 'campeonato_links',
  lineup_rule: 'campeonato_regras',
}

const PUBLIC_TYPES = Object.keys(TABLE_BY_ENTITY)
const DEFAULT_CHAMPIONSHIP_TYPE: ChampionshipType = 'copa'
const TEAM_INVITE_TYPES = ['convite_equipe_campeonato', 'team_invite']
const PLAYER_INVITE_TYPES = ['convite_jogador_campeonato', 'convite_jogador_equipe', 'player_invite']

function normalizeTokenKind(value: unknown) {
  const raw = String(value || '').trim()
  if (raw === 'team_invite') return 'convite_equipe_campeonato'
  if (raw === 'player_invite') return 'convite_jogador_campeonato'
  return raw || 'convite_equipe_campeonato'
}

function isTeamInviteKind(value: string) {
  return TEAM_INVITE_TYPES.includes(value)
}

function isPlayerInviteKind(value: string) {
  return PLAYER_INVITE_TYPES.includes(value)
}

function canCreate(profileType: string | null, entityType: string) {
  if (profileType === 'produtora') return ['championship', 'team', 'championship_team', 'phase', 'group', 'group_slot', 'game', 'invite_token', 'registration_link', 'lineup_rule'].includes(entityType)
  if (profileType === 'equipe') return ['team_line', 'championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'manager') return ['team_line', 'championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'jogador') return ['player_registration'].includes(entityType)
  return false
}

async function selectRows(
  table: string,
  entityType: string,
  mapper = (row: any) => baseRow(row, entityType),
  opts?: { columns?: string; filters?: Array<{ column: string; op: 'eq' | 'in' | 'is'; value: any }>; limit?: number },
) {
  let query = supabaseAdmin
    .from(table)
    .select(opts?.columns || '*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 300)

  for (const filter of opts?.filters || []) {
    if (filter.op === 'eq') query = query.eq(filter.column, filter.value)
    else if (filter.op === 'in') {
      if (!Array.isArray(filter.value) || filter.value.length === 0) return []
      query = query.in(filter.column, filter.value)
    } else if (filter.op === 'is') query = query.is(filter.column, filter.value)
  }

  const { data, error } = await query
  if (error) {
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
  return (data || []).map(mapper)
}

/** Soft-remove participação ativa ligada ao slot (libera assento sem hard delete). */
async function freeSlotParticipation(slot: {
  id: string
  campeonato_id: string
  grupo_id: string
  slot_numero: number
  equipe_id?: string | null
  line_id?: string | null
}) {
  // Preferência: slot_id
  let partId: string | null = null
  const bySlot = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id')
    .eq('status', 'ativo')
    .eq('slot_id', slot.id)
    .maybeSingle()
  if (!bySlot.error && bySlot.data?.id) {
    partId = bySlot.data.id
  } else if (bySlot.error && !['42703', 'PGRST204'].includes(bySlot.error.code || '')) {
    throw bySlot.error
  } else {
    let q = supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', slot.campeonato_id)
      .eq('grupo_id', slot.grupo_id)
      .eq('slot_numero', slot.slot_numero)
      .eq('status', 'ativo')
    q = slot.line_id ? q.eq('line_id', slot.line_id) : slot.equipe_id ? q.eq('equipe_id', slot.equipe_id) : q
    const { data, error } = await q.maybeSingle()
    if (error) throw error
    partId = data?.id || null
  }

  if (partId) {
    await softRemoveParticipacao(partId)
    return
  }

  await supabaseAdmin
    .from('campeonato_slots')
    .update({
      equipe_id: null,
      line_id: null,
      status: 'livre',
      updated_at: new Date().toISOString(),
    })
    .eq('id', slot.id)
}

async function requireChampionshipOwner(championshipId: string | null | undefined, userId: string, produtoraId?: string | null) {
  if (!championshipId) throw new Error('Campeonato obrigatorio.')
  let data: any
  let error: any
  const initial = await supabaseAdmin
    .from('campeonatos')
    .select('id, criado_por, produtora_id, tipo')
    .eq('id', championshipId)
    .maybeSingle()
  data = initial.data
  error = initial.error
  if (error && ['PGRST204', '42703'].includes(error.code || '')) {
    const fallback = await supabaseAdmin
      .from('campeonatos')
      .select('id, criado_por, produtora_id')
      .eq('id', championshipId)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  if (!data) throw new Error('Campeonato nao encontrado.')
  if (produtoraId && data.produtora_id !== produtoraId) throw new Error('Este campeonato pertence a outra produtora.')

  // Dono = criado_por OU auth da produtora dona
  if (data.criado_por === userId) return data
  if (data.produtora_id) {
    const { data: produtora } = await supabaseAdmin
      .from('produtoras')
      .select('id, auth_user_id')
      .eq('id', data.produtora_id)
      .maybeSingle()
    if (produtora?.auth_user_id === userId) return data
  }
  throw new Error('Somente o administrador do campeonato pode executar esta ação.')
}

function normalizeChampionshipType(value: unknown): ChampionshipType {
  const clean = String(value || '').trim().toLowerCase()
  return CHAMPIONSHIP_TYPES.includes(clean as ChampionshipType) ? clean as ChampionshipType : DEFAULT_CHAMPIONSHIP_TYPE
}

function nullablePositiveInteger(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('Os campos numÃ©ricos devem ser maiores que zero.')
  return parsed
}

function nullableMoney(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Os valores financeiros devem ser maiores ou iguais a zero.')
  return parsed
}

function nullableDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error('Data invÃ¡lida.')
  return date.toISOString()
}

function normalizeWhatsappContacts(value: unknown) {
  if (!Array.isArray(value)) return []
  if (value.length > 10) throw new Error('Cadastre no maximo 10 contatos de WhatsApp.')
  return value.map((item: any, index: number) => {
    const nome = String(item?.nome || '').trim().slice(0, 80)
    const pais = String(item?.pais || '').trim().slice(0, 60)
    const bandeira = String(item?.bandeira || '').trim().slice(0, 8)
    const ddiDigits = String(item?.ddi || '').replace(/\D/g, '').slice(0, 4)
    const phoneDigits = String(item?.telefone || '').replace(/\D/g, '').slice(0, 15)
    if (!nome || !pais || !ddiDigits || phoneDigits.length < 8) throw new Error(`Preencha corretamente o contato ${index + 1} do WhatsApp.`)
    return { id: String(item?.id || crypto.randomUUID()).slice(0, 80), nome, pais, bandeira, ddi: `+${ddiDigits}`, telefone: phoneDigits }
  })
}

const THEME_COLOR_KEYS = [
  'cor_principal',
  'cor_secundaria',
  'cor_texto_clara',
  'cor_texto_escura',
  'bg_opacidade',
  'bg_image_url',
] as const

function championshipConfigurationPayload(data: Record<string, any>, campeonatoId: string) {
  const permiteTroca = Boolean(data.permite_troca_jogadores)
  return {
    campeonato_id: campeonatoId,
    premiacao: String(data.premiacao || '').trim() || null,
    valor_inscricao: nullableMoney(data.valor_inscricao),
    descricao_premiacao: String(data.descricao_premiacao || '').trim() || null,
    divisao_premiacao: String(data.divisao_premiacao || '').trim() || null,
    numero_vagas: nullablePositiveInteger(data.numero_vagas),
    formato: String(data.formato || '').trim() || null,
    plataforma: String(data.plataforma || '').trim() || null,
    servidor: String(data.servidor || '').trim() || null,
    tipo_premiacao: String(data.tipo_premiacao || '').trim() || null,
    tem_trofeu: Boolean(data.tem_trofeu),
    tem_live: Boolean(data.tem_live),
    vagas_por_equipe: nullablePositiveInteger(data.vagas_por_equipe),
    jogadores_por_vaga: nullablePositiveInteger(data.jogadores_por_vaga),
    permite_jogador_multiplas_equipes: Boolean(data.permite_jogador_multiplas_equipes),
    permite_troca_jogadores: permiteTroca,
    data_limite_trocas: permiteTroca ? nullableDate(data.data_limite_trocas) : null,
    data_limite_inscricao: nullableDate(data.data_limite_inscricao),
    aceita_novas_inscricoes_equipes: data.aceita_novas_inscricoes_equipes !== false,
    contatos_whatsapp: normalizeWhatsappContacts(data.contatos_whatsapp),
    pagamento_pix_ativo: data.pagamento_pix_ativo !== false,
    pagamento_cartao_ativo: data.pagamento_cartao_ativo !== false,
    pagamento_paypal_ativo: data.pagamento_paypal_ativo === true,
    pagamento_whatsapp_ativo: data.pagamento_whatsapp_ativo !== false,
    cartao_max_parcelas: Math.min(12, Math.max(1, Number.parseInt(String(data.cartao_max_parcelas || '1'), 10) || 1)),
    paypal_moedas: Array.isArray(data.paypal_moedas)
      ? [...new Set(data.paypal_moedas.map((item: unknown) => String(item).toUpperCase()).filter((item: string) => ['BRL', 'USD', 'EUR'].includes(item)))]
      : ['BRL', 'USD', 'EUR'],
    ...buildThemeColumns(data),
  }
}

function normalizeHexColor(value: unknown, fallback: string) {
  const raw = String(value || '').trim()
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const m = raw.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
    if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase()
  }
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase()
  return fallback
}

/** Tema: cores + opacidade do BG + imagem. Contraste de texto é calculado na UI. */
function buildThemeColumns(data: Record<string, any>) {
  const primary = normalizeHexColor(data.cor_principal, '#ff4655')
  const secondary = normalizeHexColor(data.cor_secundaria, '#17191d')
  const onLight = contrastTextForBg('#f7f8fa')
  const opacityRaw = Number(data.bg_opacidade)
  const bgOpacidade = Number.isFinite(opacityRaw)
    ? Math.min(100, Math.max(0, Math.round(opacityRaw)))
    : 18
  const bgImage = String(data.bg_image_url || '').trim() || null
  return {
    cor_principal: primary,
    cor_secundaria: secondary,
    cor_texto_clara: '#ffffff',
    cor_texto_escura: onLight,
    bg_opacidade: bgOpacidade,
    bg_image_url: bgImage,
  }
}

function relativeLuminanceHex(hex: string) {
  const h = normalizeHexColor(hex, '#000000').slice(1)
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = rgb.map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrastTextForBg(bgHex: string) {
  return relativeLuminanceHex(bgHex) > 0.45 ? '#17191d' : '#ffffff'
}

function isMissingThemeColumnError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || error?.details || '')
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    THEME_COLOR_KEYS.some((key) => message.includes(key)) ||
    /column .* does not exist/i.test(message)
  )
}

/** Upsert config; se colunas de tema ainda não existem no DB, grava o resto e avisa. */
async function saveChampionshipConfiguration(payload: Record<string, any>) {
  const first = await supabaseAdmin
    .from('campeonato_configuracoes')
    .upsert(payload, { onConflict: 'campeonato_id' })
    .select('*')
    .single()
  if (!first.error) return { data: first.data, warning: null as string | null }

  if (!isMissingThemeColumnError(first.error)) throw first.error

  const withoutTheme = { ...payload }
  for (const key of THEME_COLOR_KEYS) delete withoutTheme[key]
  const retry = await supabaseAdmin
    .from('campeonato_configuracoes')
    .upsert(withoutTheme, { onConflict: 'campeonato_id' })
    .select('*')
    .single()
  if (retry.error) throw retry.error
  return {
    data: retry.data,
    warning: 'Colunas de tema ainda não existem. Rode database/migrations/20260716_campeonato_cores_tema.sql',
  }
}

function championshipRow(row: any) {
  const configuration = Array.isArray(row.campeonato_configuracoes)
    ? row.campeonato_configuracoes[0]
    : row.campeonato_configuracoes
  return baseRow(row, 'championship', {
    data: {
      nome: row.nome,
      logo_url: row.logo_url,
      banner_url: row.banner_url,
      tipo: row.tipo || DEFAULT_CHAMPIONSHIP_TYPE,
      aprovacao_status: row.aprovacao_status || 'aprovado',
      aprovacao_motivo: row.aprovacao_motivo || null,
      ...(configuration || {}),
    },
  })
}

function normalizeGroupName(rawName: unknown, championshipType: ChampionshipType) {
  const clean = String(rawName || '').trim()
  if (championshipType === 'diario') {
    const hour = clean.replace(':00', 'h').replace(/\s+/g, '').toLowerCase()
    const normalized = hour.match(/^([01]?\d|2[0-3])h$/)?.[0]
    const padded = normalized ? `${normalized.replace('h', '').padStart(2, '0')}h` : ''
    if (!padded || !DAILY_HOURS.includes(padded)) throw new Error('Selecione um horario valido para campeonato diario.')
    return padded
  }

  const letter = clean.replace(/^grupo\s+/i, '').trim().toUpperCase()
  if (!GROUP_LETTERS.includes(letter)) throw new Error('Selecione uma letra valida para o grupo.')
  return `Grupo ${letter}`
}

async function requireManagedTeam(teamId: string | null | undefined, userId: string) {
  if (!teamId) throw new Error('Equipe obrigatoria.')
  const { data, error } = await supabaseAdmin
    .from('equipes')
    .select('id, auth_user_id, dono_auth_user_id')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data || ![data.auth_user_id, data.dono_auth_user_id].includes(userId)) throw new Error('Voce nao pode gerenciar essa equipe.')
  return data
}

async function requireTeamInChampionship(championshipId: string | null | undefined, teamId: string | null | undefined) {
  if (!championshipId || !teamId) throw new Error('Campeonato e equipe obrigatorios.')
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id, grupo_id, line_id')
    .eq('campeonato_id', championshipId)
    .eq('equipe_id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Essa equipe nao esta inscrita nesse campeonato.')
  return data
}

async function getLineupRule(campeonatoId: string, grupoId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_regras')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .or(grupoId ? `grupo_id.eq.${grupoId},grupo_id.is.null` : 'grupo_id.is.null')
    .order('grupo_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function saveLineupRule(data: Record<string, any>, createdByChampionshipId: string) {
  const payload = {
    campeonato_id: createdByChampionshipId,
    fase_id: data.fase_id || null,
    grupo_id: data.group_id || data.grupo_id || null,
    vagas_por_equipe: Number(data.vagas_por_equipe || 6),
    abre_em: parseOptionalDateTime(data.abre_em, { fieldLabel: 'Data de abertura da escalação' }),
    encerra_em: parseOptionalDateTime(data.encerra_em, { fieldLabel: 'Data de encerramento da escalação' }),
    permite_substituicao: Boolean(data.permite_substituicao),
    max_substituicoes_por_equipe: Number(data.max_substituicoes_por_equipe || 0),
    substituicao_encerra_em: parseOptionalDateTime(data.substituicao_encerra_em, {
      fieldLabel: 'Prazo de substituição',
    }),
    bloquear_convites_apos_encerramento: data.bloquear_convites_apos_encerramento !== false,
    status: 'ativo',
  }

  let query = supabaseAdmin.from('campeonato_regras').select('id').eq('campeonato_id', payload.campeonato_id)
  query = payload.grupo_id ? query.eq('grupo_id', payload.grupo_id) : query.is('grupo_id', null)
  const { data: existing, error: existingError } = await query.maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin.from('campeonato_regras').update(payload).eq('id', existing.id).select('*').single()
    if (error) throw error
    return updated
  }

  const { data: inserted, error } = await supabaseAdmin.from('campeonato_regras').insert(payload).select('*').single()
  if (error) throw error
  return inserted
}

function assertLineupOpen(rule: any, action = 'inscricao') {
  const now = Date.now()
  if (rule?.abre_em && new Date(rule.abre_em).getTime() > now) throw new Error('Escalacao ainda nao abriu.')
  if (rule?.encerra_em && new Date(rule.encerra_em).getTime() < now) throw new Error('Escalacao encerrada.')
  if (action === 'substituicao') {
    if (!rule?.permite_substituicao) throw new Error('Substituicao nao permitida neste campeonato.')
    if (rule?.substituicao_encerra_em && new Date(rule.substituicao_encerra_em).getTime() < now) throw new Error('Prazo de substituicao encerrado.')
  }
}

async function assertPlayerCapacity(campeonatoId: string, equipeId: string, vagas = 6) {
  const { count, error } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('equipe_id', equipeId)
    .neq('status', 'deletado')
  if (error) throw error
  if ((count || 0) >= vagas) throw new Error('Essa equipe ja atingiu o limite de vagas de escalacao.')
}

async function assertPlayerUniqueInChampionship(campeonatoId: string, campeonatoEquipeId: string | null | undefined, idJogo: string) {
  const cleanId = String(idJogo || '').trim()
  if (!cleanId) throw new Error('Informe o ID de jogo.')

  const { data: config, error: configError } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('permite_jogador_multiplas_equipes')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (configError) throw configError
  if (config?.permite_jogador_multiplas_equipes) return

  const { data: existing, error } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id, campeonato_equipe_id')
    .eq('campeonato_id', campeonatoId)
    .eq('id_jogo', cleanId)
    .neq('status', 'deletado')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (existing && existing.campeonato_equipe_id !== campeonatoEquipeId) {
    throw new Error('Esse jogador ja esta inscrito em outra line deste campeonato.')
  }
}

async function assertInviteAllowed(campeonatoId: string, equipeId?: string | null) {
  let grupoId: string | null = null
  if (equipeId) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('grupo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('equipe_id', equipeId)
      .maybeSingle()
    if (error) throw error
    grupoId = data?.grupo_id || null
  }
  const rule = await getLineupRule(campeonatoId, grupoId)
  if (rule?.bloquear_convites_apos_encerramento !== false) assertLineupOpen(rule)
  return rule
}

function championshipsOwnedBy(row: any, rows: any[], userId: string) {
  const championshipId = row.parent_id || row.data?.championship_id
  return rows.some((item) => item.entity_type === 'championship' && item.id === championshipId && item.created_by === userId)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entity_type')
    const championshipFilter = searchParams.get('championship_id') || searchParams.get('campeonato_id') || ''

    let producerChampionshipIds: string[] = []

    if (account.profile_type === 'produtora') {
      const { data: ownedChampionships, error: ownedChampionshipsError } = await supabaseAdmin
        .from('campeonatos')
        .select('id')
        .eq('produtora_id', account.id)
        .is('deleted_at', null)
      if (ownedChampionshipsError) throw ownedChampionshipsError
      producerChampionshipIds = (ownedChampionships || []).map((row: any) => String(row.id))
    }

    const campIdsForScoped =
      championshipFilter
        ? [championshipFilter]
        : account.profile_type === 'produtora'
          ? producerChampionshipIds
          : null

    async function loadType(type: string): Promise<any[]> {
      if (type === 'championship') {
        let championshipQuery = supabaseAdmin
          .from('campeonatos')
          .select('*, campeonato_configuracoes(*)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(300)
        if (account.profile_type === 'produtora') championshipQuery = championshipQuery.eq('produtora_id', account.id)
        if (championshipFilter) championshipQuery = championshipQuery.eq('id', championshipFilter)
        const { data, error } = await championshipQuery
        if (error) throw error
        return (data || []).map(championshipRow)
      }

      const scoped =
        campIdsForScoped && campIdsForScoped.length
          ? [{ column: 'campeonato_id', op: 'in' as const, value: campIdsForScoped }]
          : campIdsForScoped && campIdsForScoped.length === 0
            ? null
            : []

      // Produtora sem campeonatos: scoped vazio
      if (scoped === null) return []

      if (type === 'team') {
        return selectRows('equipes', type, (row) => baseRow(row, type, { data: { tag: row.tag, logo_url: row.logo_url, profile_team: true } }), {
          columns: 'id,nome,tag,logo_url,status,dono_auth_user_id,created_at,updated_at',
        })
      }
      if (type === 'team_line') {
        return selectRows(
          'equipe_lines',
          type,
          (row) => baseRow(row, type, { data: { team_id: row.equipe_id, equipe_id: row.equipe_id, tag: row.tag, logo_url: row.logo_url } }),
          { columns: 'id,equipe_id,nome,tag,logo_url,status,created_at,updated_at' },
        )
      }
      if (type === 'championship_team') {
        return selectRows(
          'campeonato_equipes',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                championship_id: row.campeonato_id,
                team_id: row.equipe_id,
                line_id: row.line_id,
                slot_id: row.slot_id || null,
                nome_exibicao: row.nome_exibicao,
                grupo_id: row.grupo_id,
                slot: row.slot_numero,
                campeonato_equipe_id: row.id,
              },
            }),
          {
            columns: 'id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,slot_numero,nome_exibicao,status,origem_entrada,criado_por,created_at,updated_at',
            filters: [...scoped, { column: 'status', op: 'eq', value: 'ativo' }],
          },
        )
      }
      if (type === 'player_team') {
        return selectRows(
          'equipe_jogadores',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                player_user_id: row.jogador_auth_user_id,
                team_id: row.equipe_id,
                origem: row.origem,
                nick: row.nick,
                id_jogo: row.id_jogo,
                funcao: row.funcao,
                foto_url: row.foto_url,
              },
            }),
        )
      }
      if (type === 'player_registration') {
        return selectRows(
          'campeonato_jogadores',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                nick: row.nick,
                id_jogo: row.id_jogo,
                funcao: row.funcao,
                localidade: row.localidade,
                championship_id: row.campeonato_id,
                team_id: row.equipe_id,
                game_id: row.jogo_id,
                foto_url: row.foto_url,
                jogador_id: row.jogador_id,
              },
            }),
          { filters: scoped },
        )
      }
      if (type === 'phase') {
        return selectRows(
          'campeonato_fases',
          type,
          (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, ordem: row.ordem } }),
          { filters: scoped },
        )
      }
      if (type === 'group') {
        return selectRows(
          'campeonato_grupos',
          type,
          (row) =>
            baseRow(row, type, {
              data: { championship_id: row.campeonato_id, fase_id: row.fase_id, slots: row.slots, whatsapp_url: row.whatsapp_url },
            }),
          { filters: scoped },
        )
      }
      if (type === 'group_slot') {
        return selectRows(
          'campeonato_slots',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                championship_id: row.campeonato_id,
                fase_id: row.fase_id,
                group_id: row.grupo_id,
                grupo_id: row.grupo_id,
                team_id: row.equipe_id,
                equipe_id: row.equipe_id,
                line_id: row.line_id,
                slot_numero: row.slot_numero,
                slot_letra: row.slot_letra,
                status: row.status,
              },
            }),
          {
            columns: 'id,campeonato_id,fase_id,grupo_id,equipe_id,line_id,slot_numero,slot_letra,status,created_at,updated_at',
            filters: scoped,
          },
        )
      }
      if (type === 'game') {
        return selectRows(
          'campeonato_jogos',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                championship_id: row.campeonato_id,
                fase_id: row.fase_id,
                data_jogo: row.data_jogo,
                horario: row.horario,
                numero_partidas: row.numero_partidas,
                mapas: row.mapas,
                grupos_ids: row.grupos_ids,
              },
            }),
          { filters: scoped },
        )
      }
      if (type === 'invite_token') {
        return selectRows(
          'tokens',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                token_kind: row.tipo,
                championship_id: row.campeonato_id,
                phase_id: row.fase_id,
                group_id: row.grupo_id,
                slot_id: row.slot_id || null,
                team_id: row.equipe_id,
                player_id: row.jogador_id,
                manager_id: row.manager_id,
                game_id: row.jogo_id,
                usado: row.usado,
                expira_em: row.expira_em,
              },
            }),
          { filters: scoped },
        )
      }
      if (type === 'registration_link') {
        const mapLink = (row: any) =>
          baseRow(row, type, {
            name: row.titulo || row.token || null,
            data: registrationLinkData(row),
            status: row.deleted_at ? 'excluido' : row.ativo === false ? 'pausado' : 'ativo',
          })
        // selectRows engole erro de coluna ausente → [] ; por isso tentamos explicitamente
        let query = supabaseAdmin
          .from('campeonato_links')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300)
        if (scoped.length) {
          const campFilter = scoped[0]
          if (!Array.isArray(campFilter.value) || !campFilter.value.length) return []
          query = query.in(campFilter.column, campFilter.value)
        }
        query = query.is('deleted_at', null)
        const { data, error } = await query
        if (error && isMissingDeletedAtColumn(error)) {
          const retry = await selectRows('campeonato_links', type, mapLink, { filters: scoped })
          return (retry || []).filter(
            (row: any) => String(row.data?.closed_reason || '') !== 'excluido',
          )
        }
        if (error) {
          if (['42P01', 'PGRST205'].includes(error.code || '')) return []
          throw error
        }
        return (data || [])
          .filter((row: any) => parseLinkMetadata(row).closed_reason !== 'excluido')
          .map(mapLink)
      }
      if (type === 'lineup_rule') {
        return selectRows(
          'campeonato_regras',
          type,
          (row) =>
            baseRow(row, type, {
              data: {
                championship_id: row.campeonato_id,
                fase_id: row.fase_id,
                group_id: row.grupo_id,
                vagas_por_equipe: row.vagas_por_equipe,
                abre_em: row.abre_em,
                encerra_em: row.encerra_em,
                permite_substituicao: row.permite_substituicao,
                max_substituicoes_por_equipe: row.max_substituicoes_por_equipe,
                substituicao_encerra_em: row.substituicao_encerra_em,
                bloquear_convites_apos_encerramento: row.bloquear_convites_apos_encerramento,
              },
            }),
          { filters: scoped },
        )
      }
      return []
    }

    const typesToLoad = entityType ? [entityType] : PUBLIC_TYPES
    // Paralelo: antes carregava 12 tipos em série
    const batches = await Promise.all(typesToLoad.map((type) => loadType(type)))
    const output = batches.flat()

    const managedTeamIds = new Set([
      ...output.filter((row) => row.entity_type === 'team' && row.created_by === user.id).map((row) => row.id),
      ...output.filter((row) => row.entity_type === 'championship_team' && row.created_by === user.id && row.ref_id).map((row) => row.ref_id),
    ])

    const championshipScopedTypes = new Set([
      'championship_team',
      'player_registration',
      'phase',
      'group',
      'group_slot',
      'game',
      'invite_token',
      'registration_link',
      'lineup_rule',
    ])
    const visible = output.filter((row) => {
      if (account.profile_type === 'produtora') {
        if (row.entity_type === 'championship') return producerChampionshipIds.includes(row.id)
        if (championshipScopedTypes.has(row.entity_type)) {
          const championshipId = String(row.parent_id || row.data?.championship_id || '')
          return producerChampionshipIds.includes(championshipId)
        }
      }
      if (row.entity_type === 'team_line') return managedTeamIds.has(row.ref_id)
      if (row.entity_type === 'invite_token' || row.entity_type === 'registration_link' || row.entity_type === 'lineup_rule') {
        return row.created_by === user.id
      }
      if (row.entity_type === 'player_registration') {
        if (account.profile_type === 'jogador') return row.data?.jogador_id === account.id || row.created_by === user.id
        if (account.profile_type === 'produtora') return championshipsOwnedBy(row, output, user.id)
        if (account.profile_type === 'equipe' || account.profile_type === 'manager') return managedTeamIds.has(row.ref_id)
        return false
      }
      return true
    })

    visible.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return NextResponse.json({ rows: visible })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar.' }, { status: 400 })
  }
}

async function consumeToken(token: string | null | undefined, tipo?: string | string[]) {
  const clean = String(token || '').trim().toUpperCase()
  if (!clean) return null
  let query = supabaseAdmin.from('tokens').select('*').eq('token', clean).eq('usado', false)
  if (Array.isArray(tipo)) query = query.in('tipo', tipo)
  else if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Token invalido ou ja utilizado.')
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) throw new Error('Token expirado.')
  const { error: updateError } = await supabaseAdmin.from('tokens').update({ usado: true, usado_em: new Date().toISOString() }).eq('id', data.id)
  if (updateError) throw updateError
  return data
}

export async function POST(req: NextRequest) {
  let requestEntityType = ''
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json()
    const entityType = String(body.entity_type || '').trim()
    requestEntityType = entityType

    if (!canCreate(account.profile_type, entityType)) throw new Error('Seu tipo de perfil nao pode criar esse cadastro.')

    let row: any
    if (entityType === 'championship') {
      const data = body.data || {}
      const nome = String(body.name || data.nome || '').trim()
      const logoUrl = String(data.logo_url || '').trim()
      const bannerUrl = String(data.banner_url || '').trim()
      if (!nome) throw new Error('Informe o nome do campeonato.')
      if (!logoUrl) throw new Error('Envie a logo do campeonato.')

      const { assertProdutoraAprovada } = await import('@backend/admin/aprovacao')
      await assertProdutoraAprovada(account.id)

      const championshipPayload: Record<string, unknown> = {
        nome,
        tipo: normalizeChampionshipType(data.tipo),
        logo_url: logoUrl,
        banner_url: bannerUrl || null,
        criado_por: user.id,
        produtora_id: account.id,
        status: 'ativo',
        // novo campeonato não vai ao ar até admin aprovar (+ cobrança)
        aprovacao_status: 'pendente',
      }
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('campeonatos')
        .insert(championshipPayload)
        .select('*')
        .single()
      if (insertError) throw insertError

      const configurationPayload = championshipConfigurationPayload(data, inserted.id)
      let configuration: any
      try {
        const saved = await saveChampionshipConfiguration(configurationPayload)
        configuration = saved.data
      } catch (configurationError) {
        await supabaseAdmin.from('campeonatos').delete().eq('id', inserted.id)
        throw configurationError
      }

      // Snapshot de precificação (não bloqueia se tabela ausente)
      try {
        const { quoteChampionshipPrice, saveChampionshipBilling } = await import('@backend/admin/pricing')
        const vagas = Number(data.numero_vagas || configuration?.numero_vagas || 0)
        const quote = await quoteChampionshipPrice({
          tipo: normalizeChampionshipType(data.tipo),
          numero_vagas: vagas,
          recursos: {
            export: data.recurso_export !== false,
            stream: data.recurso_stream !== false,
            rulebook: data.recurso_rulebook !== false,
            stats: data.recurso_stats !== false,
            broadcast: data.recurso_broadcast === true,
          },
        })
        await saveChampionshipBilling(inserted.id, quote, {
          status: 'pendente',
          userId: user.id,
          observacao: 'Gerado na criação do campeonato',
        })
      } catch {
        // silencioso — precificação opcional até migração
      }

      row = championshipRow({ ...inserted, campeonato_configuracoes: configuration })
    } else if (entityType === 'team') {
      const data = body.data || {}
      const { data: inserted, error } = await supabaseAdmin.from('equipes').insert({
        nome: body.name || data.nome,
        tag: data.tag,
        logo_url: data.logo_url || null,
        dono_auth_user_id: user.id,
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'championship_team') {
      const token = await consumeToken(body.token, TEAM_INVITE_TYPES)
      const campeonatoId = body.parent_id || token?.campeonato_id
      const equipeId =
        body.ref_id || token?.equipe_id || (account.profile_type === 'equipe' ? account.id : null)
      if (!campeonatoId || !equipeId) throw new Error('Campeonato e equipe sao obrigatorios.')
      if (account.profile_type === 'produtora' && !token) await requireChampionshipOwner(campeonatoId, user.id, account.id)
      if ((account.profile_type === 'equipe' || account.profile_type === 'manager') && !token) await requireManagedTeam(equipeId, user.id)

      const data = body.data || {}
      const slotId = String(data.slot_id || token?.slot_id || '').trim()
      const resolved = await resolveLineForInscricao({
        equipeId,
        campeonatoId,
        lineId: data.line_id || token?.line_destino_id || null,
        nomeLine: data.nome_line || data.nome_exibicao || body.name || null,
      })

      let inserted: any
      if (slotId) {
        // Caminho enxuto: line + slot
        inserted = await inserirParticipacaoNoSlot({
          campeonatoId,
          slotId,
          lineId: resolved.id,
          equipeId,
          nomeExibicao: resolved.nome,
          origem: token ? 'convite' : account.profile_type === 'produtora' ? 'organizador' : 'inscricao',
          criadoPor: user.id,
        })
      } else {
        // Sem slot (legado / inscrição sem assento ainda)
        const payload: Record<string, unknown> = {
          campeonato_id: campeonatoId,
          equipe_id: equipeId,
          line_id: resolved.id,
          nome_exibicao: resolved.nome,
          grupo_id: data.grupo_id || token?.grupo_id || null,
          slot_numero: data.slot_numero || null,
          origem_entrada: token ? 'convite' : account.profile_type === 'produtora' ? 'organizador' : 'inscricao',
          criado_por: user.id,
          status: 'ativo',
        }
        const { data: rowIns, error } = await supabaseAdmin.from('campeonato_equipes').insert(payload).select('*').single()
        if (error) throw error
        inserted = rowIns
      }
      row = baseRow(inserted, entityType, {
        data: {
          championship_id: inserted.campeonato_id,
          team_id: inserted.equipe_id,
          line_id: inserted.line_id,
          slot_id: inserted.slot_id || slotId || null,
          grupo_id: inserted.grupo_id,
          slot: inserted.slot_numero,
          campeonato_equipe_id: inserted.id,
          nome_exibicao: inserted.nome_exibicao,
        },
      })
    } else if (entityType === 'phase') {
      const data = body.data || {}
      await requireChampionshipOwner(body.parent_id || data.campeonato_id, user.id, account.id)
      const phaseName = String(body.name || data.nome || '').trim()
      if (!phaseName) throw new Error('Informe o nome da fase.')
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_fases').insert({
        campeonato_id: body.parent_id || data.campeonato_id,
        nome: phaseName,
        ordem: Number(data.ordem || 1),
      }).select('*').single()
      if (error?.code === '23505') throw new Error('Ja existe uma fase com esse nome neste campeonato.')
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'group') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      const championship = await requireChampionshipOwner(campeonatoId, user.id, account.id)
      const championshipType = normalizeChampionshipType((championship as any).tipo || data.championship_type)
      const groupName = normalizeGroupName(body.name || data.nome, championshipType)
      let existingQuery = supabaseAdmin
        .from('campeonato_grupos')
        .select('*')
        .eq('campeonato_id', campeonatoId)
        .ilike('nome', groupName)
        .limit(1)
      existingQuery = data.fase_id ? existingQuery.eq('fase_id', data.fase_id) : existingQuery.is('fase_id', null)
      const { data: existingGroup, error: existingGroupError } = await existingQuery.maybeSingle()
      if (existingGroupError) throw existingGroupError
      if (existingGroup) {
        throw new Error(championshipType === 'diario' ? 'Ja existe esse horario nesta fase do campeonato.' : 'Ja existe esse grupo nesta fase do campeonato.')
      } else {
        const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupos').insert({
          campeonato_id: campeonatoId,
          fase_id: data.fase_id || null,
          nome: groupName,
          slots: Number(data.slots || 12),
          whatsapp_url: String(data.whatsapp_url || '').trim() || null,
        }).select('*').single()
        if (error) {
          if (error.code === '23505') throw new Error(championshipType === 'diario' ? 'Ja existe esse horario nesta fase do campeonato.' : 'Ja existe esse grupo nesta fase do campeonato.')
          throw error
        }
        const slotCount = Number(data.slots || 12)
        // Limite de vagas só vale na fase de entrada; fases seguintes = classificados
        await assertPodeCriarSlots(campeonatoId, slotCount, { faseId: data.fase_id || null })
        const letters = Array.from({ length: slotCount }, (_, index) => {
          let value = index + 1
          let label = ''
          while (value > 0) {
            value -= 1
            label = String.fromCharCode(65 + (value % 26)) + label
            value = Math.floor(value / 26)
          }
          return { campeonato_id: campeonatoId, fase_id: data.fase_id || null, grupo_id: inserted.id, slot_numero: index + 1, slot_letra: label, status: 'livre' }
        })
        const { error: slotsError } = await supabaseAdmin.from('campeonato_slots').insert(letters)
        if (slotsError) throw slotsError
        row = baseRow(inserted, entityType, { data: { ...inserted, whatsapp_url: inserted.whatsapp_url } })
      }
    } else if (entityType === 'group_slot') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id, account.id)
      if (!data.grupo_id || !data.slot_numero) throw new Error('Grupo e slot sao obrigatorios.')
      const { data: groupRef, error: groupRefError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('fase_id')
        .eq('id', data.grupo_id)
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()
      if (groupRefError) throw groupRefError
      const faseId = data.fase_id || groupRef?.fase_id || null
      const slotPayload = {
        campeonato_id: campeonatoId,
        fase_id: faseId,
        grupo_id: data.grupo_id,
        equipe_id: data.equipe_id || null,
        line_id: data.line_id || null,
        slot_numero: Number(data.slot_numero),
        status: data.equipe_id ? 'ocupado' : 'livre',
      }
      if (data.equipe_id) {
        const participationPatch: Record<string, unknown> = { grupo_id: data.grupo_id, slot_numero: Number(data.slot_numero) }
        if (data.line_id) {
          const { data: selectedLine, error: lineError } = await supabaseAdmin
            .from('equipe_lines')
            .select('id, equipe_id, nome')
            .eq('id', data.line_id)
            .eq('equipe_id', data.equipe_id)
            .single()
          if (lineError || !selectedLine) throw new Error('A line selecionada nÃ£o pertence Ã  equipe.')
          participationPatch.line_id = selectedLine.id
          participationPatch.nome_exibicao = selectedLine.nome
        }
        let participationUpdate = supabaseAdmin
          .from('campeonato_equipes')
          .update(participationPatch)
          .eq('campeonato_id', campeonatoId)
        participationUpdate = data.campeonato_equipe_id
          ? participationUpdate.eq('id', data.campeonato_equipe_id)
          : data.line_id
            ? participationUpdate.eq('line_id', data.line_id)
            : participationUpdate.eq('equipe_id', data.equipe_id)
        const { error: updateError } = await participationUpdate
        if (updateError) throw updateError
      }
      const { data: existing } = data.slot_id
        ? await supabaseAdmin
          .from('campeonato_slots')
          .select('id')
          .eq('id', data.slot_id)
          .eq('campeonato_id', campeonatoId)
          .maybeSingle()
        : await supabaseAdmin
          .from('campeonato_slots')
          .select('id')
          .eq('grupo_id', data.grupo_id)
          .eq('slot_numero', Number(data.slot_numero))
          .maybeSingle()
      const query = existing?.id
        ? supabaseAdmin.from('campeonato_slots').update(slotPayload).eq('id', existing.id)
        : supabaseAdmin.from('campeonato_slots').insert(slotPayload)
      const { data: inserted, error } = await query.select('*').single()
      if (error?.code === '23505') throw new Error('Esta line jÃ¡ estÃ¡ em outro grupo desta fase.')
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'game') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id, account.id)
      const gruposIds = Array.isArray(data.grupos_ids) ? data.grupos_ids : []
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogos').insert({
        campeonato_id: campeonatoId,
        fase_id: data.fase_id || null,
        nome: body.name || data.nome,
        data_jogo: data.data_jogo || null,
        horario: data.horario || null,
        numero_partidas: Number(data.numero_partidas || 1),
        mapas: String(data.mapas || '').split(',').map((x) => x.trim()).filter(Boolean),
        grupos_ids: gruposIds,
      }).select('*').single()
      if (error) throw error
      if (gruposIds.length > 0) {
        const rows = gruposIds.map((grupoId: string) => ({ campeonato_id: campeonatoId, jogo_id: inserted.id, grupo_id: grupoId }))
        const { error: gruposError } = await supabaseAdmin.from('campeonato_jogos_grupos').insert(rows)
        if (gruposError) throw gruposError
      }
      row = baseRow(inserted, entityType)
    } else if (entityType === 'invite_token') {
      const data = body.data || {}
      const tipo = normalizeTokenKind(data.token_kind || body.tipo)
      if (isTeamInviteKind(tipo)) await requireChampionshipOwner(body.parent_id || data.championship_id, user.id, account.id)
      if (tipo === 'manager_invite') await requireChampionshipOwner(body.parent_id || data.championship_id, user.id, account.id)
      if (isPlayerInviteKind(tipo)) {
        await requireManagedTeam(body.ref_id || data.team_id, user.id)
        await requireTeamInChampionship(body.parent_id || data.championship_id, body.ref_id || data.team_id)
        await assertInviteAllowed(body.parent_id || data.championship_id, body.ref_id || data.team_id)
      }
      const prefix = String(body.token_prefix || (tipo === 'manager_invite' ? 'MG' : isPlayerInviteKind(tipo) ? 'JG' : 'EQ'))
      const { data: inserted, error } = await supabaseAdmin.from('tokens').insert({
        token: body.generate_token ? randomToken(prefix) : body.token,
        tipo,
        campeonato_id: body.parent_id || data.championship_id || null,
        fase_id: data.phase_id || data.fase_id || null,
        grupo_id: data.group_id || data.grupo_id || null,
        equipe_id: body.ref_id || data.team_id || null,
        jogador_id: data.player_id || null,
        manager_id: data.manager_id || null,
        jogo_id: data.game_id || null,
        criado_por: user.id,
        expira_em: data.expira_em || null,
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'lineup_rule') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      await requireChampionshipOwner(campeonatoId, user.id, account.id)
      const inserted = await saveLineupRule(data, campeonatoId)
      row = baseRow(inserted, entityType)
    } else if (entityType === 'registration_link') {
      const data = body.data || {}
      const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id
      const grupoId = data.group_id || data.grupo_id
      await requireChampionshipOwner(campeonatoId, user.id, account.id)
      if (!grupoId) throw new Error('Grupo obrigatorio para gerar link de inscricao.')

      // Só existe link de entrada de equipes por grupo (inscrição individual removida)
      const tipoLink = 'inscricao_equipes_grupo'
      const { data: group, error: groupError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('slots,nome')
        .eq('id', grupoId)
        .eq('campeonato_id', campeonatoId)
        .single()
      if (groupError) throw groupError

      const slotsGrupo = Math.max(1, Number(group.slots || 1))
      const limiteRaw = Number(data.limite_vagas ?? data.vagas_link ?? data.quantidade_vagas)
      if (!Number.isFinite(limiteRaw) || !Number.isInteger(limiteRaw) || limiteRaw < 1) {
        throw new Error(`Informe quantas vagas este link aceita (1 a ${slotsGrupo}).`)
      }
      if (limiteRaw > slotsGrupo) {
        throw new Error(`O limite maximo deste grupo e ${slotsGrupo} vaga(s).`)
      }
      const limiteVagas = limiteRaw

      // Lista de controle opcional (não bloqueia inscrição; admin cola texto livre)
      const expectedTeams = parseExpectedTeamsFromText(
        data.expected_teams
        ?? data.equipes_esperadas_texto
        ?? data.nomes_equipes_texto
        ?? data.nomes_equipes
        ?? '',
      )

      // Conta slots livres reais no grupo — o link não pode vender mais do que cabe
      const { count: livresCount, error: livresError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', campeonatoId)
        .eq('grupo_id', grupoId)
        .is('line_id', null)
        .is('equipe_id', null)
      if (livresError) throw livresError
      const livres = Number(livresCount || 0)
      if (livres < 1) throw new Error('Este grupo nao tem slots livres para gerar link.')
      if (limiteVagas > livres) {
        throw new Error(`So restam ${livres} slot(s) livre(s) neste grupo. Reduza o limite do link.`)
      }

      const expiraEm = parseOptionalDateTime(data.expira_em || data.encerra_em, {
        fieldLabel: 'Data de encerramento do link',
        requireFuture: true,
      })
      const meta = {
        limite_vagas: limiteVagas,
        usos: 0,
        expected_teams: expectedTeams,
        entradas: [] as Array<{
          participacao_id: string
          equipe_id: string | null
          equipe_nome: string | null
          line_id: string | null
          line_nome: string | null
          slot_id: string | null
          slot_letra: string | null
          slot_numero: number | null
          referencia_lista?: string | null
          entrou_em: string
        }>,
      }
      const titulo =
        String(body.name || data.titulo || data.nome_interno || '').trim()
        || (limiteVagas === 1
          ? `Entrada de 1 equipe · ${group.nome || 'grupo'}`
          : `Entrada de ${limiteVagas} equipes · ${group.nome || 'grupo'}`)
      const linkPayload: Record<string, unknown> = {
        campeonato_id: campeonatoId,
        fase_id: data.fase_id || null,
        grupo_id: grupoId,
        token: body.generate_token ? randomToken('EQS') : body.token,
        tipo: tipoLink,
        titulo,
        descricao: encodeLinkDescricao(meta, data.descricao),
        ativo: data.ativo !== false,
        acompanhamento_publico: data.acompanhamento_publico !== false,
        criado_por: user.id,
        expira_em: expiraEm,
      }
      let { data: inserted, error } = await supabaseAdmin.from('campeonato_links').insert({
        ...linkPayload,
        metadata: meta,
      }).select('*').single()
      if (error && isMissingMetadataColumn(error)) {
        const retry = await supabaseAdmin.from('campeonato_links').insert(linkPayload).select('*').single()
        inserted = retry.data
        error = retry.error
      }
      if (error) throw error

      const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_APP_URL || ''
      const publicUrl = `${String(origin).replace(/\/$/, '')}/convite/grupo/${inserted.token}`
      const { data: campRow } = await supabaseAdmin
        .from('campeonatos')
        .select('nome')
        .eq('id', campeonatoId)
        .maybeSingle()
      const shareTexto = buildGroupInviteShareMessage({
        campeonatoNome: campRow?.nome || body.name || 'Campeonato',
        grupoNome: group.nome || 'Grupo',
        limiteVagas,
        expectedTeams,
        publicUrl,
        expiraEm,
        titulo,
      })

      row = baseRow(inserted, entityType, {
        data: {
          ...registrationLinkData(inserted),
          share_texto: shareTexto,
          public_url_full: publicUrl,
        },
      })
    } else if (entityType === 'player_registration') {
      const token = await consumeToken(body.data?.token || body.token, PLAYER_INVITE_TYPES)
      const data = body.data || {}
      const campeonatoId = body.parent_id || token?.campeonato_id
      const equipeId = body.ref_id || token?.equipe_id
      const champTeam = await requireTeamInChampionship(campeonatoId, equipeId)
      const rule = await getLineupRule(campeonatoId, champTeam.grupo_id)
      assertLineupOpen(rule)
      await assertPlayerCapacity(campeonatoId, equipeId, Number(rule?.vagas_por_equipe || 6))
      const { data: jogador, error: jogadorError } = await supabaseAdmin.from('jogadores').select('*').eq('auth_user_id', user.id).maybeSingle()
      if (jogadorError) throw jogadorError
      if (!jogador) throw new Error('Entre com uma conta de jogador.')
      const idJogo = String(data.id_jogo || jogador.id_jogo || '').trim()
      await assertPlayerUniqueInChampionship(campeonatoId, champTeam.id, idJogo)
      const { error: linkError } = await supabaseAdmin.from('equipe_jogadores').upsert({
        equipe_id: equipeId,
        jogador_auth_user_id: user.id,
        nick: body.name || data.nick || jogador.nome,
        foto_url: data.foto_url || jogador.avatar_url || null,
        id_jogo: idJogo,
        funcao: data.funcao || jogador.funcao || null,
        localidade: data.localidade || jogador.localidade || null,
        origem: 'token',
        status: 'ativo',
      }, { onConflict: 'equipe_id,jogador_auth_user_id' })
      if (linkError) throw linkError
      const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert({
        campeonato_id: campeonatoId,
        equipe_id: equipeId,
        jogo_id: token?.jogo_id || data.game_id || null,
        jogador_id: jogador.id,
        nick: body.name || data.nick || jogador.nome,
        foto_url: data.foto_url || jogador.avatar_url || null,
        id_jogo: idJogo,
        funcao: data.funcao || jogador.funcao || 'support',
        localidade: data.localidade || jogador.localidade || null,
        campeonato_equipe_id: champTeam.id,
        line_id: token?.line_destino_id || data.line_id || champTeam.line_id || null,
        origem: 'token',
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else if (entityType === 'player_team') {
      const data = body.data || {}
      await requireManagedTeam(body.ref_id || data.team_id, user.id)
      if (!data.player_id) throw new Error('Selecione um jogador existente para adicionar ao elenco.')
      const { data: inserted, error } = await supabaseAdmin.from('equipe_jogadores').insert({
        equipe_id: body.ref_id || data.team_id,
        jogador_auth_user_id: data.player_user_id || data.jogador_auth_user_id,
        nick: data.nick || null,
        foto_url: data.foto_url || null,
        id_jogo: data.id_jogo || null,
        funcao: data.funcao || null,
        localidade: data.localidade || null,
        origem: 'manual',
        status: 'ativo',
      }).select('*').single()
      if (error) throw error
      row = baseRow(inserted, entityType)
    } else {
      throw new Error('Tipo de cadastro invalido.')
    }

    return NextResponse.json({ row })
  } catch (error: any) {
    console.error('[dropzone POST]', {
      entity_type: requestEntityType || null,
      code: error?.code || null,
      message: error?.message || String(error),
    })
    return NextResponse.json({ error: error?.message || 'Erro ao salvar.' }, { status: error?.code === '23505' ? 409 : 400 })
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json()
    if (account.profile_type !== 'produtora') throw new Error('Somente a produtora pode editar esta estrutura.')
    const entityType = String(body.entity_type || '')
    const id = String(body.id || '')
    const data = body.data || {}

    if (entityType === 'championship') {
      await requireChampionshipOwner(id, user.id, account.id)
      const { data: currentChamp, error: currentChampError } = await supabaseAdmin
        .from('campeonatos')
        .select('aprovacao_status')
        .eq('id', id)
        .maybeSingle()
      if (currentChampError) throw currentChampError
      if (currentChamp?.aprovacao_status && currentChamp.aprovacao_status !== 'aprovado') {
        throw new Error('Campeonato aguardando liberaÃ§Ã£o. Pague via PIX ou aguarde o admin liberar para editar.')
      }
      const nome = String(data.nome || '').trim()
      const logoUrl = String(data.logo_url || '').trim()
      const bannerUrl = String(data.banner_url || '').trim()
      if (!nome || !logoUrl) throw new Error('Informe nome e logo do campeonato.')
      const { data: updated, error } = await supabaseAdmin.from('campeonatos').update({ nome, logo_url: logoUrl, banner_url: bannerUrl || null, tipo: normalizeChampionshipType(data.tipo) }).eq('id', id).select('*').single()
      if (error) throw error
      const { data: configuration, warning } = await saveChampionshipConfiguration(
        championshipConfigurationPayload(data, id),
      )
      // Mantém rulebook alinhado (premiação, taxa, transmissão, etc.)
      try {
        await syncRulebookFromCampeonato(id)
      } catch {
        // best-effort
      }
      return NextResponse.json({
        row: championshipRow({ ...updated, campeonato_configuracoes: configuration }),
        ...(warning ? { warning } : {}),
      })
    }

    if (entityType === 'phase') {
      const { data: current, error: readError } = await supabaseAdmin.from('campeonato_fases').select('campeonato_id').eq('id', id).single()
      if (readError) throw readError
      await requireChampionshipOwner(current.campeonato_id, user.id, account.id)
      const { data: updated, error } = await supabaseAdmin.from('campeonato_fases').update({ nome: String(data.nome || '').trim(), ordem: Number(data.ordem || 1), updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
      if (error?.code === '23505') throw new Error('Ja existe uma fase com esse nome neste campeonato.')
      if (error) throw error
      return NextResponse.json({ row: baseRow(updated, 'phase', { data: updated }) })
    }

    if (entityType === 'group') {
      const { data: current, error: readError } = await supabaseAdmin.from('campeonato_grupos').select('*').eq('id', id).single()
      if (readError) throw readError
      await requireChampionshipOwner(current.campeonato_id, user.id, account.id)
      const requestedSlots = Number(data.slots || current.slots)
      const { count: occupied } = await supabaseAdmin.from('campeonato_slots').select('id', { count: 'exact', head: true }).eq('grupo_id', id).not('equipe_id', 'is', null).gt('slot_numero', requestedSlots)
      if ((occupied || 0) > 0) throw new Error('NÃ£o Ã© possÃ­vel remover slots ocupados.')
      const { data: updated, error } = await supabaseAdmin.from('campeonato_grupos').update({ nome: String(data.nome || current.nome).trim(), slots: requestedSlots, whatsapp_url: String(data.whatsapp_url || '').trim() || null, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
      if (error?.code === '23505') throw new Error('Ja existe um grupo com esse nome nesta fase.')
      if (error) throw error
      if (requestedSlots > current.slots) {
        const novos = requestedSlots - Number(current.slots || 0)
        // Limite de vagas só vale na fase de entrada; fases seguintes = classificados
        await assertPodeCriarSlots(current.campeonato_id, novos, { faseId: current.fase_id || null })
        const additions = Array.from({ length: novos }, (_, offset) => {
          const number = Number(current.slots || 0) + offset + 1
          let value = number
          let label = ''
          while (value > 0) {
            value -= 1
            label = String.fromCharCode(65 + (value % 26)) + label
            value = Math.floor(value / 26)
          }
          return {
            campeonato_id: current.campeonato_id,
            fase_id: current.fase_id,
            grupo_id: id,
            slot_numero: number,
            slot_letra: label,
            status: 'livre',
          }
        })
        const { error: addError } = await supabaseAdmin.from('campeonato_slots').insert(additions)
        if (addError) throw addError
      } else if (requestedSlots < current.slots) {
        const { error: removeError } = await supabaseAdmin.from('campeonato_slots').delete().eq('grupo_id', id).gt('slot_numero', requestedSlots).is('equipe_id', null); if (removeError) throw removeError
      }
      return NextResponse.json({ row: baseRow(updated, 'group', { data: updated }) })
    }

    if (entityType === 'group_slot') {
      const { data: current, error: readError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single()
      if (readError) throw readError
      await requireChampionshipOwner(current.campeonato_id, user.id, account.id)
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (data.slot_letra !== undefined) {
        const slotLetter = String(data.slot_letra || '').trim().toUpperCase()
        if (!/^[A-Z]{1,3}$/.test(slotLetter)) throw new Error('A letra do slot deve usar apenas letras de A a Z.')
        patch.slot_letra = slotLetter
      }
      if (data.equipe_id !== undefined) {
        if (data.equipe_id) {
          // Ocupar slot via helper enxuto (cria/atualiza participação + espelho)
          const resolved = await resolveLineForInscricao({
            equipeId: String(data.equipe_id),
            campeonatoId: current.campeonato_id,
            lineId: data.line_id || null,
            nomeLine: data.nome_line || data.nome_exibicao || null,
          })
          // Se já tem part ativa neste slot, soft-remove antes de reinscrever
          if (current.equipe_id || current.line_id) {
            await freeSlotParticipation(current)
          }
          await inserirParticipacaoNoSlot({
            campeonatoId: current.campeonato_id,
            slotId: current.id,
            lineId: resolved.id,
            equipeId: String(data.equipe_id),
            nomeExibicao: resolved.nome,
            origem: 'organizador',
            criadoPor: user.id,
          })
          const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single()
          if (error) throw error
          return NextResponse.json({ row: baseRow(updated, 'group_slot', { data: updated }) })
        }
        // Liberar slot
        await freeSlotParticipation(current)
        if (data.slot_letra !== undefined) {
          const { data: updated, error } = await supabaseAdmin
            .from('campeonato_slots')
            .update({ slot_letra: patch.slot_letra, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single()
          if (error) throw error
          return NextResponse.json({ row: baseRow(updated, 'group_slot', { data: updated }) })
        }
        const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single()
        if (error) throw error
        return NextResponse.json({ row: baseRow(updated, 'group_slot', { data: updated }) })
      }
      const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').update(patch).eq('id', id).select('*').single()
      if (error?.code === '23505') throw new Error('Essa letra ja esta sendo usada neste grupo ou esta line ja esta em outro grupo da fase.')
      if (error) throw error
      return NextResponse.json({ row: baseRow(updated, 'group_slot', { data: updated }) })
    }

    if (entityType === 'registration_link') {
      const { data: current, error: readError } = await supabaseAdmin.from('campeonato_links').select('*').eq('id', id).single()
      if (readError) throw readError
      await requireChampionshipOwner(current.campeonato_id, user.id, account.id)
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (data.ativo !== undefined) patch.ativo = Boolean(data.ativo)
      if (data.expira_em !== undefined || data.encerra_em !== undefined) {
        patch.expira_em = parseOptionalDateTime(data.expira_em || data.encerra_em, {
          fieldLabel: 'Data de encerramento do link',
          requireFuture: Boolean(data.expira_em || data.encerra_em),
        })
      }
      if (data.regenerate_token) {
        patch.token = randomToken(current.tipo === 'inscricao_equipes_grupo' ? 'EQS' : 'INSC')
      }
      if (data.titulo !== undefined || data.nome_interno !== undefined) {
        patch.titulo = String(data.titulo ?? data.nome_interno ?? '').trim() || current.titulo
      }
      const currentMeta = parseLinkMetadata(current)
      // Sempre regrava descricao com meta embutida (funciona sem coluna metadata)
      if (
        data.limite_vagas !== undefined
        || data.expected_teams !== undefined
        || data.equipes_esperadas_texto !== undefined
        || data.descricao !== undefined
        || data.ativo !== undefined
        || data.regenerate_token
        || data.reset_usos !== undefined
      ) {
        const limiteNext =
          data.limite_vagas !== undefined
            ? Math.max(1, Number(data.limite_vagas) || 1)
            : currentMeta.limite_vagas

        // Reativar: limpa closed_reason. usos = entradas reais (nunca zerar cegamente).
        let usosNext = Math.max(currentMeta.usos, currentMeta.entradas.length)
        let closedReason = currentMeta.closed_reason
        let closedAt = currentMeta.closed_at
        if (data.ativo === true || data.reset_usos === true || data.reset_usos === 'true') {
          closedReason = undefined
          closedAt = undefined
          // Histórico permanece; contador reflete quem já entrou
          usosNext = currentMeta.entradas.length
        }

        const expectedNext =
          data.expected_teams !== undefined || data.equipes_esperadas_texto !== undefined
            ? parseExpectedTeamsFromText(data.expected_teams ?? data.equipes_esperadas_texto)
            : currentMeta.expected_teams

        const metaNext = {
          limite_vagas: limiteNext,
          usos: usosNext,
          expected_teams: expectedNext,
          entradas: currentMeta.entradas,
          ...(closedReason ? { closed_reason: closedReason } : {}),
          ...(closedAt ? { closed_at: closedAt } : {}),
        }
        const human =
          data.descricao !== undefined
            ? String(data.descricao || '')
            : extractHumanDescricao(current.descricao)
        patch.descricao = encodeLinkDescricao(metaNext, human)
        patch.metadata = metaNext
      }

      let { data: updated, error } = await supabaseAdmin.from('campeonato_links').update(patch).eq('id', id).select('*').single()
      if (error && isMissingMetadataColumn(error)) {
        const { metadata: _meta, ...withoutMeta } = patch
        const retry = await supabaseAdmin.from('campeonato_links').update(withoutMeta).eq('id', id).select('*').single()
        updated = retry.data
        error = retry.error
      }
      if (error) throw error
      return NextResponse.json({ row: baseRow(updated, 'registration_link', { data: registrationLinkData(updated) }) })
    }

    throw new Error('Tipo de edicao nao suportado.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao editar.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json()
    if (account.profile_type !== 'produtora') throw new Error('Somente a produtora pode excluir esta estrutura.')
    const entityType = String(body.entity_type || '')
    const id = String(body.id || '')
    if (entityType === 'championship') {
      await requireChampionshipOwner(id, user.id, account.id)
      const { error } = await supabaseAdmin.from('campeonatos').update({ deleted_at: new Date().toISOString(), status: 'excluido' }).eq('id', id)
      if (error) throw error
    } else if (entityType === 'phase') {
      const { data, error: readError } = await supabaseAdmin.from('campeonato_fases').select('campeonato_id').eq('id', id).single(); if (readError) throw readError
      await requireChampionshipOwner(data.campeonato_id, user.id, account.id)
      const { error } = await supabaseAdmin.from('campeonato_fases').delete().eq('id', id); if (error) throw error
    } else if (entityType === 'group') {
      const { data, error: readError } = await supabaseAdmin.from('campeonato_grupos').select('campeonato_id').eq('id', id).single(); if (readError) throw readError
      await requireChampionshipOwner(data.campeonato_id, user.id, account.id)
      const { error } = await supabaseAdmin.from('campeonato_grupos').delete().eq('id', id); if (error) throw error
    } else if (entityType === 'group_slot') {
      const { data, error: readError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single()
      if (readError) throw readError
      await requireChampionshipOwner(data.campeonato_id, user.id, account.id)
      await freeSlotParticipation(data)
    } else if (entityType === 'registration_link') {
      const { data: current, error: readError } = await supabaseAdmin
        .from('campeonato_links')
        .select('*')
        .eq('id', id)
        .single()
      if (readError) throw readError
      await requireChampionshipOwner(current.campeonato_id, user.id, account.id)

      // Soft-delete: mantém o token para acompanhamento público
      const meta = parseLinkMetadata(current)
      const closedAt = new Date().toISOString()
      const payload = buildLinkMetaPayload(meta, {
        closed_reason: 'excluido',
        closed_at: closedAt,
      })
      const patch: Record<string, unknown> = {
        ativo: false,
        descricao: encodeLinkDescricao(payload, extractHumanDescricao(current.descricao)),
        metadata: payload,
        updated_at: closedAt,
        deleted_at: closedAt,
      }
      let { error } = await supabaseAdmin.from('campeonato_links').update(patch).eq('id', id)
      if (error && isMissingDeletedAtColumn(error)) {
        const { deleted_at: _d, ...withoutDeleted } = patch
        const retry = await supabaseAdmin.from('campeonato_links').update(withoutDeleted).eq('id', id)
        error = retry.error
      }
      if (error && isMissingMetadataColumn(error)) {
        const { metadata: _m, deleted_at: _d2, ...withoutMeta } = patch
        const retry = await supabaseAdmin.from('campeonato_links').update(withoutMeta).eq('id', id)
        error = retry.error
      }
      if (error) throw error
    } else throw new Error('Tipo de exclusao nao suportado.')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir.' }, { status: 400 })
  }
}

