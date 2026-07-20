import { randomBytes } from 'crypto'
import {
  createNotificacao,
  findManagerByQuery,
  isMissingRelation,
  normalizeValidadeDias,
  searchManagers,
} from '../equipes/manager-invites'
import { supabaseAdmin } from '../shared/supabase-admin'
import {
  DEFAULT_SELLER_PERMISSIONS,
  normalizeSellerPermissions,
  type SellerPermissions,
} from './campeonato-permissions'

export { createNotificacao, findManagerByQuery, isMissingRelation, searchManagers, normalizeValidadeDias }
export type { SellerPermissions }

export const MAX_CONVITES_PENDENTES_CAMP = 30
export const MAX_PEDIDOS_PENDENTES_MANAGER = 10

export function novoSellerToken() {
  return randomBytes(18).toString('base64url').toUpperCase()
}

export function sellerLimit(value: unknown) {
  const limit = Number(value || 0)
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
}

export function normalizeChampSellerPerms(raw: unknown): SellerPermissions {
  return normalizeSellerPermissions(raw || DEFAULT_SELLER_PERMISSIONS)
}

export async function requireCampeonatoAdmin(campeonatoId: string, authUserId: string) {
  const { data: camp, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,status,produtora_id,criado_por,deleted_at')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!camp) throw new Error('Campeonato não encontrado.')

  let produtora: any = null
  if (camp.produtora_id) {
    const { data, error: prError } = await supabaseAdmin
      .from('produtoras')
      .select('id,nome,username,logo_url,auth_user_id,status')
      .eq('id', camp.produtora_id)
      .maybeSingle()
    if (prError) throw prError
    produtora = data
  }

  const isOwner =
    produtora?.auth_user_id === authUserId
    || camp.criado_por === authUserId

  if (!isOwner) {
    throw new Error('Somente o admin do campeonato/produtora pode gerenciar convites de manager.')
  }

  return { camp, produtora }
}

export async function getCampeonatoAdminAuthUserId(campeonatoId: string): Promise<{
  authUserId: string | null
  camp: any
  produtora: any
}> {
  const { data: camp, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,status,produtora_id,criado_por,deleted_at')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!camp) throw new Error('Campeonato não encontrado.')

  let produtora: any = null
  if (camp.produtora_id) {
    const { data } = await supabaseAdmin
      .from('produtoras')
      .select('id,nome,username,logo_url,auth_user_id,status')
      .eq('id', camp.produtora_id)
      .maybeSingle()
    produtora = data
  }

  const authUserId = produtora?.auth_user_id || camp.criado_por || null
  return { authUserId, camp, produtora }
}

export async function countConvitesPendentesCamp(campeonatoId: string, tipo?: 'convite' | 'pedido') {
  let q = supabaseAdmin
    .from('campeonato_manager_convites')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'pendente')
  if (tipo) q = q.eq('tipo', tipo)
  const { count, error } = await q
  if (isMissingRelation(error)) return 0
  if (error) throw error
  return Number(count || 0)
}

export async function countPedidosPendentesManager(managerId: string) {
  const { count, error } = await supabaseAdmin
    .from('campeonato_manager_convites')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', managerId)
    .eq('tipo', 'pedido')
    .eq('status', 'pendente')
  if (isMissingRelation(error)) return 0
  if (error) throw error
  return Number(count || 0)
}

/** Ativa manager como vendedor no campeonato (aceite de convite ou pedido). */
export async function activateSellerOnChampionship(params: {
  campeonatoId: string
  produtoraId: string | null
  managerId: string
  managerAuthUserId: string | null
  nomePublico?: string | null
  whatsappUrl?: string | null
  limiteVagas?: number
  permissoes?: SellerPermissions
  criadoPor?: string | null
}) {
  const permissoes = normalizeChampSellerPerms(params.permissoes)
  const limiteVagas = sellerLimit(params.limiteVagas)
  const now = new Date().toISOString()

  // Garante roster da produtora (quando houver)
  if (params.produtoraId) {
    await supabaseAdmin.from('produtora_vendedores').upsert(
      {
        produtora_id: params.produtoraId,
        manager_id: params.managerId,
        manager_auth_user_id: params.managerAuthUserId,
        nome_publico: params.nomePublico || null,
        whatsapp_url: params.whatsappUrl || null,
        status: 'ativo',
        aceito_em: now,
        updated_at: now,
      },
      { onConflict: 'produtora_id,manager_id' },
    )
  }

  const { data: existing } = await supabaseAdmin
    .from('campeonato_vendedores')
    .select('id,token,status')
    .eq('campeonato_id', params.campeonatoId)
    .eq('manager_id', params.managerId)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_vendedores')
      .update({
        status: 'ativo',
        produtora_id: params.produtoraId,
        manager_auth_user_id: params.managerAuthUserId,
        nome_publico: params.nomePublico || null,
        whatsapp_url: params.whatsappUrl || null,
        limite_vagas: limiteVagas,
        permissoes,
        aceito_em: now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const token = novoSellerToken()
  const { data, error } = await supabaseAdmin
    .from('campeonato_vendedores')
    .insert({
      token,
      campeonato_id: params.campeonatoId,
      produtora_id: params.produtoraId,
      manager_id: params.managerId,
      manager_auth_user_id: params.managerAuthUserId,
      nome_publico: params.nomePublico || null,
      whatsapp_url: params.whatsappUrl || null,
      status: 'ativo',
      limite_vagas: limiteVagas,
      permissoes,
      criado_por: params.criadoPor || null,
      aceito_em: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function searchCampeonatos(q: string, limit = 12) {
  const clean = String(q || '').trim()
  if (clean.length < 2) return [] as any[]

  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,status,produtora_id,tipo,created_at,aprovacao_status')
    .is('deleted_at', null)
    .eq('status', 'ativo')
    .eq('aprovacao_status', 'aprovado')
    .ilike('nome', `%${clean}%`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  const rows = data || []
  const produtoraIds = [...new Set(rows.map((r) => r.produtora_id).filter(Boolean))]
  const { data: produtoras } = produtoraIds.length
    ? await supabaseAdmin.from('produtoras').select('id,nome,logo_url,username').in('id', produtoraIds)
    : { data: [] as any[] }
  const prMap = new Map((produtoras || []).map((p) => [p.id, p]))

  return rows.map((c) => ({
    ...c,
    produtora: c.produtora_id ? prMap.get(c.produtora_id) || null : null,
  }))
}
