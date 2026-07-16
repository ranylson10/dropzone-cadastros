import { supabaseAdmin } from '../shared/supabase-admin'

export const MAX_MANAGERS_ATIVOS = 5
export const MAX_CONVITES_PENDENTES = 10
export const DEFAULT_VALIDADE_DIAS = 7
export const MIN_VALIDADE_DIAS = 1
export const MAX_VALIDADE_DIAS = 30

export type ManagerPermissoes = {
  pode_ver: boolean
  pode_editar: boolean
  pode_escalar: boolean
  pode_gerar_token: boolean
}

export function normalizeValidadeDias(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_VALIDADE_DIAS
  return Math.min(MAX_VALIDADE_DIAS, Math.max(MIN_VALIDADE_DIAS, Math.floor(n)))
}

export function normalizePermissoes(raw: Partial<ManagerPermissoes> | null | undefined): ManagerPermissoes {
  return {
    pode_ver: raw?.pode_ver !== false,
    pode_editar: Boolean(raw?.pode_editar),
    pode_escalar: raw?.pode_escalar !== false,
    pode_gerar_token: Boolean(raw?.pode_gerar_token),
  }
}

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  const msg = String(error?.message || '').toLowerCase()
  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  )
}

export async function requireEquipeOwner(equipeId: string, authUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('equipes')
    .select('id,nome,username,logo_url,auth_user_id,status')
    .eq('id', equipeId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Equipe não encontrada.')
  if (data.status && data.status !== 'ativo') throw new Error('Esta equipe não está ativa.')
  if (data.auth_user_id !== authUserId) {
    throw new Error('Somente o dono da equipe pode gerenciar staff/managers.')
  }
  return data
}

export async function countManagersAtivos(equipeId: string) {
  const { count, error } = await supabaseAdmin
    .from('manager_equipe')
    .select('id', { count: 'exact', head: true })
    .eq('equipe_id', equipeId)
    .eq('status', 'ativo')
  if (error) throw error
  return Number(count || 0)
}

export async function countConvitesPendentes(equipeId: string) {
  const { count, error } = await supabaseAdmin
    .from('equipe_manager_convites')
    .select('id', { count: 'exact', head: true })
    .eq('equipe_id', equipeId)
    .eq('status', 'pendente')
  if (isMissingRelation(error)) return 0
  if (error) throw error
  return Number(count || 0)
}

export async function findManagerByQuery(q: string) {
  const clean = String(q || '').trim().replace(/^@+/, '')
  if (!clean) return null

  // public_id numérico
  if (/^\d+$/.test(clean)) {
    const { data, error } = await supabaseAdmin
      .from('managers')
      .select('id,username,nome,avatar_url,public_id,public_id_prefix,status,auth_user_id')
      .eq('public_id', Number(clean))
      .eq('status', 'ativo')
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const { data, error } = await supabaseAdmin
    .from('managers')
    .select('id,username,nome,avatar_url,public_id,public_id_prefix,status,auth_user_id')
    .eq('status', 'ativo')
    .ilike('username', clean)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function searchManagers(q: string, limit = 10) {
  const clean = String(q || '').trim().replace(/^@+/, '')
  if (clean.length < 2) return [] as any[]

  if (/^\d+$/.test(clean)) {
    const { data, error } = await supabaseAdmin
      .from('managers')
      .select('id,username,nome,avatar_url,public_id,public_id_prefix,status')
      .eq('status', 'ativo')
      .eq('public_id', Number(clean))
      .limit(limit)
    if (error) throw error
    return data || []
  }

  const { data, error } = await supabaseAdmin
    .from('managers')
    .select('id,username,nome,avatar_url,public_id,public_id_prefix,status')
    .eq('status', 'ativo')
    .or(`username.ilike.%${clean}%,nome.ilike.%${clean}%`)
    .order('username', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function createNotificacao(params: {
  destinatarioAuthUserId: string
  destinatarioProfileType?: string | null
  destinatarioProfileId?: string | null
  remetenteAuthUserId?: string | null
  remetenteProfileType?: string | null
  remetenteProfileId?: string | null
  tipo: string
  titulo: string
  corpo?: string | null
  payload?: Record<string, unknown>
  referenciaTipo?: string | null
  referenciaId?: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('notificacoes')
    .insert({
      destinatario_auth_user_id: params.destinatarioAuthUserId,
      destinatario_profile_type: params.destinatarioProfileType || null,
      destinatario_profile_id: params.destinatarioProfileId || null,
      remetente_auth_user_id: params.remetenteAuthUserId || null,
      remetente_profile_type: params.remetenteProfileType || null,
      remetente_profile_id: params.remetenteProfileId || null,
      tipo: params.tipo,
      titulo: params.titulo,
      corpo: params.corpo || null,
      payload: params.payload || {},
      status: 'nao_lida',
      referencia_tipo: params.referenciaTipo || null,
      referencia_id: params.referenciaId || null,
    })
    .select('*')
    .single()
  if (isMissingRelation(error)) {
    throw new Error(
      'Tabelas de correio ainda não existem. Rode o SQL em Downloads: dropzone_convites_manager_correio.sql',
    )
  }
  if (error) throw error
  return data
}
