import { readPagedRows } from "@backend/shared/paginated-query";
import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { DEFAULT_CHAMPIONSHIP_TYPE } from '@backend/dropzone/entities/championship-config'

export const HIDDEN_DATA_KEYS = new Set([
  'senha',
  'senha_dono',
  'senha_hash',
  'email_contato',
  'email_verificado',
])

export function safeData(row: any, extra: Record<string, any> = {}) {
  const data = { ...row, ...extra }
  for (const key of HIDDEN_DATA_KEYS) delete data[key]
  return data
}

export function baseRow(row: any, entityType: string, extra: Partial<any> = {}) {
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

export const TABLE_BY_ENTITY: Record<string, string> = {
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

export const PUBLIC_TYPES = Object.keys(TABLE_BY_ENTITY)

export async function selectRows(
  table: string,
  entityType: string,
  mapper = (row: any) => baseRow(row, entityType),
  opts?: { columns?: string; filters?: Array<{ column: string; op: 'eq' | 'in' | 'is'; value: any }>; limit?: number },
) {
  let query = supabaseAdmin
    .from(table)
    .select(opts?.columns || '*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })

  for (const filter of opts?.filters || []) {
    if (filter.op === 'eq') query = query.eq(filter.column, filter.value)
    else if (filter.op === 'in') {
      if (!Array.isArray(filter.value) || filter.value.length === 0) return []
      query = query.in(filter.column, filter.value)
    } else if (filter.op === 'is') query = query.is(filter.column, filter.value)
  }

  let data: any[]
  try { data = await readPagedRows<any>(query) } catch (cause) {
    const error = cause as { code?: string }
    if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }
  return (data || []).map(mapper)
}

export function championshipRow(row: any) {
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

export function championshipsOwnedBy(row: any, rows: any[], userId: string) {
  const championshipId = row.parent_id || row.data?.championship_id
  return rows.some((item) => item.entity_type === 'championship' && item.id === championshipId && item.created_by === userId)
}
