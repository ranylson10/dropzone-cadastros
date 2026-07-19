import { NextRequest } from 'next/server'
import { supabaseAdmin } from '../shared/supabase-admin'
import type { DropZoneRow, ProfileType } from '../types/dropzone.types'

export async function getBearerUser(req: NextRequest) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new Error('Sessao ausente.')

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) throw new Error('Sessao invalida.')
  const { data: restriction, error: restrictionError } = await supabaseAdmin
    .from('sistema_restricoes_conta')
    .select('tipo,motivo,expira_em,ativo')
    .eq('auth_user_id', data.user.id)
    .eq('ativo', true)
    .maybeSingle()
  if (restrictionError && !['42P01', 'PGRST205'].includes(restrictionError.code || '')) throw restrictionError
  if (restriction && (!restriction.expira_em || new Date(restriction.expira_em).getTime() > Date.now())) {
    const label = restriction.tipo === 'banimento' ? 'banida' : 'suspensa'
    throw new Error(`Conta ${label}: ${restriction.motivo}`)
  }
  return data.user
}

const PROFILE_TABLES: Record<ProfileType, string> = {
  produtora: 'produtoras',
  equipe: 'equipes',
  jogador: 'jogadores',
  manager: 'managers',
  broadcast: 'broadcasts',
}

export function profileTable(profileType: ProfileType) {
  return PROFILE_TABLES[profileType]
}

export function mapProfile(row: any, profileType: ProfileType): DropZoneRow {
  return {
    id: row.id,
    entity_type: 'account',
    auth_user_id: row.auth_user_id,
    profile_type: profileType,
    username: row.username,
    public_id: row.public_id ?? null,
    name: row.nome || row.nome_exibido || row.username,
    token: null,
    parent_id: null,
    ref_id: null,
    status: row.status || 'ativo',
    data: row,
    created_by: row.auth_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  }
}

export async function getAccountsByUserId(userId: string) {
  const accounts: DropZoneRow[] = []
  const types = Object.keys(PROFILE_TABLES) as ProfileType[]

  for (const type of types) {
    const { data, error } = await supabaseAdmin
      .from(profileTable(type))
      .select('*')
      .eq('auth_user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    accounts.push(...(data || []).map((row) => mapProfile(row, type)))
  }

  return accounts
}

export async function getAccountsForUser(user: { id: string }) {
  return getAccountsByUser(user)
}

async function updateIfColumnExists(table: string, payload: Record<string, any>, column: string, value: string) {
  const { error } = await supabaseAdmin.from(table).update(payload).eq(column, value)
  if (error && !['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code || '')) throw error
}

async function migrateOwnedRows(oldUserId: string, newUserId: string) {
  if (!oldUserId || oldUserId === newUserId) return

  const creatorTables = [
    'campeonatos',
    'campeonato_fases',
    'campeonato_grupos',
    'campeonato_slots',
    'campeonato_jogos',
    'campeonato_equipes',
    'campeonato_jogadores',
    'campeonato_links',
    'campeonato_regras',
    'campeonato_partidas',
    'campeonato_resultados_equipes',
    'campeonato_resultados_jogadores',
    'tokens',
  ]

  for (const table of creatorTables) {
    await updateIfColumnExists(table, { criado_por: newUserId }, 'criado_por', oldUserId)
  }

  await updateIfColumnExists('equipe_jogadores', { jogador_auth_user_id: newUserId }, 'jogador_auth_user_id', oldUserId)
  await updateIfColumnExists('jogadores_equipes', { jogador_auth_user_id: newUserId }, 'jogador_auth_user_id', oldUserId)
}

async function linkAccountsByVerifiedEmail(user: { id: string; email?: string | null; email_confirmed_at?: string | null }) {
  const cleanEmail = String(user.email || '').trim().toLowerCase()
  if (!cleanEmail || !user.email_confirmed_at) return []

  const linked: DropZoneRow[] = []
  const types = Object.keys(PROFILE_TABLES) as ProfileType[]

  for (const type of types) {
    const table = profileTable(type)
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('email_contato', cleanEmail)
      .order('created_at', { ascending: true })

    if (error) throw error

    for (const row of data || []) {
      const oldUserId = row.auth_user_id || row.dono_auth_user_id || ''
      const payload: Record<string, any> = { auth_user_id: user.id }
      if (type === 'equipe') payload.dono_auth_user_id = user.id

      const { data: updated, error: updateError } = await supabaseAdmin
        .from(table)
        .update(payload)
        .eq('id', row.id)
        .select('*')
        .single()

      if (updateError) throw updateError
      await migrateOwnedRows(oldUserId, user.id)
      linked.push(mapProfile(updated, type))
    }
  }

  return linked
}

export async function getAccountsByUser(user: { id: string; email?: string | null; email_confirmed_at?: string | null }) {
  const direct = await getAccountsByUserId(user.id)
  if (direct.length) {
    const linked = await linkAccountsByVerifiedEmail(user)
    if (!linked.length) return direct
    return getAccountsByUserId(user.id)
  }
  return linkAccountsByVerifiedEmail(user)
}

export async function getAccountByUserId(userId: string, preferredType?: ProfileType | null) {
  const accounts = await getAccountsByUserId(userId)
  if (!accounts.length) throw new Error('Conta nao encontrada na DropZone.')

  if (preferredType) {
    const preferred = accounts.find((account) => account.profile_type === preferredType)
    if (preferred) return preferred
  }

  return accounts[0]
}

export async function getActiveAccount(
  req: NextRequest,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
) {
  const requested = String(req.headers.get('x-profile-type') || '').trim() as ProfileType
  const valid = Object.prototype.hasOwnProperty.call(PROFILE_TABLES, requested) ? requested : null
  const accounts = await getAccountsForUser(user)
  if (!accounts.length) throw new Error('Conta nao encontrada na DropZone.')
  return (valid && accounts.find((account) => account.profile_type === valid)) || accounts[0]
}
