import { supabaseAdmin } from '../shared/supabase-admin'

export type SellerPermissions = {
  vendedor_vagas: boolean
  adicionar_equipes: boolean
  remover_proprias_equipes: boolean
  gerar_convites_equipe: boolean
  ver_estrutura: boolean
  organizar_grupos: boolean
  pontuar_tabela: boolean
}

export const DEFAULT_SELLER_PERMISSIONS: SellerPermissions = {
  vendedor_vagas: true,
  adicionar_equipes: true,
  remover_proprias_equipes: true,
  gerar_convites_equipe: true,
  ver_estrutura: true,
  organizar_grupos: false,
  pontuar_tabela: false,
}

export type CampeonatoPermission = {
  canView: boolean
  canManage: boolean
  canGenerateToken: boolean
  canOrganizeGroups: boolean
  canScore: boolean
  role: 'owner' | 'manager' | 'seller' | 'none'
  produtoraId: string | null
  sellerPermissions: SellerPermissions | null
}

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

export function normalizeSellerPermissions(raw: unknown): SellerPermissions {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    vendedor_vagas: value.vendedor_vagas !== false,
    adicionar_equipes: value.adicionar_equipes !== false,
    remover_proprias_equipes: value.remover_proprias_equipes !== false,
    gerar_convites_equipe: value.gerar_convites_equipe !== false,
    ver_estrutura: value.ver_estrutura !== false,
    organizar_grupos: value.organizar_grupos === true,
    pontuar_tabela: value.pontuar_tabela === true,
  }
}

function fullOwnerPermission(produtoraId: string | null): CampeonatoPermission {
  return {
    canView: true,
    canManage: true,
    canGenerateToken: true,
    canOrganizeGroups: true,
    canScore: true,
    role: 'owner',
    produtoraId,
    sellerPermissions: null,
  }
}

export async function getCampeonatoPermission(userId: string, campeonatoId: string): Promise<CampeonatoPermission> {
  const { data: campeonato, error: campeonatoError } = await supabaseAdmin
    .from('campeonatos')
    .select('id, produtora_id, criado_por')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()

  if (campeonatoError) throw campeonatoError
  if (!campeonato) throw new Error('Campeonato não encontrado.')

  const produtoraId = campeonato.produtora_id as string | null
  if (produtoraId) {
    const { data: produtora, error: produtoraError } = await supabaseAdmin
      .from('produtoras')
      .select('id, auth_user_id')
      .eq('id', produtoraId)
      .maybeSingle()

    if (produtoraError) throw produtoraError
    if (produtora?.auth_user_id === userId) {
      return fullOwnerPermission(produtoraId)
    }
  }

  if (campeonato.criado_por === userId) {
    return fullOwnerPermission(produtoraId)
  }

  const { data: manager, error: managerError } = await supabaseAdmin
    .from('managers')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (managerError) throw managerError
  if (!manager) {
    return {
      canView: true,
      canManage: false,
      canGenerateToken: false,
      canOrganizeGroups: false,
      canScore: false,
      role: 'none',
      produtoraId,
      sellerPermissions: null,
    }
  }

  // Staff da produtora (manager operacional)
  if (produtoraId) {
    const { data: vínculo, error: vínculoError } = await supabaseAdmin
      .from('manager_produtora')
      .select('pode_ver, pode_gerenciar_campeonato, pode_gerar_token, status')
      .eq('manager_id', manager.id)
      .eq('produtora_id', produtoraId)
      .maybeSingle()

    if (vínculoError && !missingRelation(vínculoError)) throw vínculoError
    if (vínculo?.status === 'ativo') {
      return {
        canView: Boolean(vínculo.pode_ver),
        canManage: Boolean(vínculo.pode_gerenciar_campeonato),
        canGenerateToken: Boolean(vínculo.pode_gerar_token),
        canOrganizeGroups: Boolean(vínculo.pode_gerenciar_campeonato),
        canScore: Boolean(vínculo.pode_gerenciar_campeonato),
        role: 'manager',
        produtoraId,
        sellerPermissions: null,
      }
    }
  }

  // Vendedor liberado no campeonato (fonte principal)
  const { data: vendedor, error: vendedorError } = await supabaseAdmin
    .from('campeonato_vendedores')
    .select('id, status, permissoes, limite_vagas')
    .eq('campeonato_id', campeonatoId)
    .eq('manager_id', manager.id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (vendedorError && !missingRelation(vendedorError)) throw vendedorError
  if (vendedor) {
    const sellerPermissions = normalizeSellerPermissions(vendedor.permissoes)
    return {
      canView: true,
      // canManage liga a UI de vagas/equipes quando o vendedor pode operar inscrições
      canManage: sellerPermissions.adicionar_equipes || sellerPermissions.gerar_convites_equipe,
      canGenerateToken: sellerPermissions.gerar_convites_equipe,
      canOrganizeGroups: sellerPermissions.organizar_grupos,
      canScore: sellerPermissions.pontuar_tabela,
      role: 'seller',
      produtoraId,
      sellerPermissions,
    }
  }

  // Fallback legado: token manager_invite no campeonato
  const { data: tokenVendedor, error: tokenError } = await supabaseAdmin
    .from('tokens')
    .select('id, manager_permissoes')
    .eq('tipo', 'manager_invite')
    .eq('campeonato_id', campeonatoId)
    .eq('manager_id', manager.id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (tokenError && !missingRelation(tokenError)) throw tokenError
  if (tokenVendedor) {
    const sellerPermissions = normalizeSellerPermissions(tokenVendedor.manager_permissoes)
    return {
      canView: true,
      canManage: sellerPermissions.adicionar_equipes || sellerPermissions.gerar_convites_equipe,
      canGenerateToken: sellerPermissions.gerar_convites_equipe,
      canOrganizeGroups: sellerPermissions.organizar_grupos,
      canScore: sellerPermissions.pontuar_tabela,
      role: 'seller',
      produtoraId,
      sellerPermissions,
    }
  }

  return {
    canView: true,
    canManage: false,
    canGenerateToken: false,
    canOrganizeGroups: false,
    canScore: false,
    role: 'none',
    produtoraId,
    sellerPermissions: null,
  }
}

export async function requireCampeonatoManage(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canManage && !permission.canOrganizeGroups && !permission.canScore) {
    throw new Error('Você não tem permissão para gerenciar este campeonato.')
  }
  return permission
}

/** Pontuação: dono/manager com gestão, ou vendedor com pontuar_tabela. */
export async function requireCampeonatoScore(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (permission.role === 'owner') return permission
  if (permission.role === 'manager' && permission.canManage) return permission
  if (permission.role === 'seller' && permission.canScore) return permission
  throw new Error('Você não tem permissão para pontuar este campeonato.')
}

/** Estrutura (fases/grupos/jogos): leitura para staff e vendedores liberados. */
export async function requireCampeonatoStructure(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (permission.role === 'owner' || permission.role === 'manager') {
    if (!permission.canView) throw new Error('Você não tem permissão para ver este campeonato.')
    return permission
  }
  if (permission.role === 'seller') {
    const perms = permission.sellerPermissions
    if (
      permission.canManage
      || permission.canOrganizeGroups
      || permission.canScore
      || perms?.ver_estrutura !== false
    ) {
      return permission
    }
  }
  throw new Error('Você não tem permissão para ver a estrutura deste campeonato.')
}

export async function requireCampeonatoTokenPermission(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canGenerateToken) {
    throw new Error('Você não tem permissão para gerar convites neste campeonato.')
  }
  return permission
}
