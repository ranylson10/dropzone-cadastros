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
  const types = Object.keys(PROFILE_TABLES) as ProfileType[]
  const results = await Promise.all(
    types.map(async (type) => {
      const { data, error } = await supabaseAdmin
        .from(profileTable(type))
        .select('*')
        .eq('auth_user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []).map((row) => mapProfile(row, type))
    }),
  )

  return results.flat()
}

export async function getAccountsForUser(user: { id: string }) {
  return getAccountsByUser(user)
}

async function linkUnownedAccountsByVerifiedEmail(user: { id: string; email?: string | null; email_confirmed_at?: string | null }) {
  const cleanEmail = String(user.email || '').trim().toLowerCase()
  if (!cleanEmail || !user.email_confirmed_at) return []

  // No schema atual, equipe é o único perfil que pode existir sem auth_user_id
  // (equipes provisórias/históricas). Os demais perfis já exigem auth_user_id,
  // então consultá-los aqui só aumenta a latência do primeiro login.
  const types: ProfileType[] = ['equipe']
  const candidates = await Promise.all(
    types.map(async (type) => {
      const table = profileTable(type)
      let query = supabaseAdmin
        .from(table)
        .select('*')
        .eq('email_contato', cleanEmail)
        .is('auth_user_id', null)
        .order('created_at', { ascending: true })

      if (type === 'equipe') query = query.is('dono_auth_user_id', null)

      const { data, error } = await query
      if (error) throw error
      return { type, table, rows: data || [] }
    }),
  )

  const linked = await Promise.all(
    candidates.flatMap(({ type, table, rows }) =>
      rows.map(async (row) => {
        const payload: Record<string, any> = { auth_user_id: user.id }
        if (type === 'equipe') payload.dono_auth_user_id = user.id

        const { data: updated, error: updateError } = await supabaseAdmin
          .from(table)
          .update(payload)
          .eq('id', row.id)
          .is('auth_user_id', null)
          .select('*')
          .maybeSingle()

        if (updateError) throw updateError
        return updated ? mapProfile(updated, type) : null
      }),
    ),
  )

  return linked.filter((item): item is DropZoneRow => Boolean(item))
}

export async function getAccountsByUser(user: { id: string; email?: string | null; email_confirmed_at?: string | null }) {
  // Caminho normal do login: primeiro busca somente os perfis que já pertencem
  // ao auth_user_id atual. O vínculo legado por e-mail é fallback e não pode
  // atrasar /api/me em todo F5/login de um usuário já cadastrado.
  const direct = await getAccountsByUserId(user.id)
  if (direct.length) return direct

  const linked = await linkUnownedAccountsByVerifiedEmail(user)
  if (!linked.length) return []

  // Releitura única para devolver o mesmo formato usado pelo restante do app.
  return getAccountsByUserId(user.id)
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
