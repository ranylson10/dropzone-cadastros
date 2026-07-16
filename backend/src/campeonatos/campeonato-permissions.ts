import { supabaseAdmin } from '../shared/supabase-admin'

/**
 * Modelo de permissões do campeonato
 * ----------------------------------
 * owner (adm / produtora dona ou criado_por):
 *   - cria campeonato, jogos, grupos, adiciona/remove equipes, convites, pontua
 *
 * manager (staff em manager_produtora):
 *   - pode_ver → leitura
 *   - pode_gerar_token → convites únicos
 *   - pode_gerenciar_campeonato → editar grupos/jogos/tabelas + equipes + convites
 *
 * seller / manager de campeonato (campeonato_vendedores):
 *   - opera o evento liberado (não a produtora inteira)
 *   - defaults: add/remover equipes, estrutura (fases/grupos), jogos, pontuar, convites
 *   - flags podem ser restringidas pelo adm no convite/liberação
 *
 * demais: leitura pública quando aplicável; sem mutações
 */

export type SellerPermissions = {
  vendedor_vagas: boolean
  /** Adicionar line/equipe no slot (direto). */
  adicionar_equipes: boolean
  /**
   * Remover line de qualquer slot do campeonato.
   * Mantém alias legado `remover_proprias_equipes` na normalização.
   */
  remover_equipes: boolean
  /** @deprecated use remover_equipes — mantido na leitura de JSON antigo */
  remover_proprias_equipes: boolean
  gerar_convites_equipe: boolean
  ver_estrutura: boolean
  /** Criar/editar/excluir fases e grupos. */
  organizar_grupos: boolean
  /** Criar/editar/excluir jogos e rodadas. */
  gerenciar_jogos: boolean
  pontuar_tabela: boolean
}

/** Defaults do manager no campeonato: operação completa no evento. */
export const DEFAULT_SELLER_PERMISSIONS: SellerPermissions = {
  vendedor_vagas: true,
  adicionar_equipes: true,
  remover_equipes: true,
  remover_proprias_equipes: true,
  gerar_convites_equipe: true,
  ver_estrutura: true,
  organizar_grupos: true,
  gerenciar_jogos: true,
  pontuar_tabela: true,
}

export type CampeonatoPermission = {
  canView: boolean
  /** Adicionar line/equipe diretamente no slot (não é o mesmo que convite). */
  canManage: boolean
  /** Remover line do campeonato (seller: só as próprias, se flag). */
  canRemove: boolean
  canGenerateToken: boolean
  canOrganizeGroups: boolean
  /** Criar/editar/excluir jogos e rodadas. */
  canManageGames: boolean
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
  const bool = (key: string, fallback: boolean) => {
    if (!(key in value)) return fallback
    return Boolean(value[key])
  }
  // remoção: flag nova ou legada; default true (manager opera o evento)
  const remover = 'remover_equipes' in value
    ? Boolean(value.remover_equipes)
    : 'remover_proprias_equipes' in value
      ? Boolean(value.remover_proprias_equipes)
      : DEFAULT_SELLER_PERMISSIONS.remover_equipes

  return {
    vendedor_vagas: bool('vendedor_vagas', DEFAULT_SELLER_PERMISSIONS.vendedor_vagas),
    adicionar_equipes: bool('adicionar_equipes', DEFAULT_SELLER_PERMISSIONS.adicionar_equipes),
    remover_equipes: remover,
    remover_proprias_equipes: remover,
    gerar_convites_equipe: bool('gerar_convites_equipe', DEFAULT_SELLER_PERMISSIONS.gerar_convites_equipe),
    ver_estrutura: bool('ver_estrutura', DEFAULT_SELLER_PERMISSIONS.ver_estrutura),
    organizar_grupos: bool('organizar_grupos', DEFAULT_SELLER_PERMISSIONS.organizar_grupos),
    gerenciar_jogos: bool('gerenciar_jogos', DEFAULT_SELLER_PERMISSIONS.gerenciar_jogos),
    pontuar_tabela: bool('pontuar_tabela', DEFAULT_SELLER_PERMISSIONS.pontuar_tabela),
  }
}

function fullOwnerPermission(produtoraId: string | null): CampeonatoPermission {
  return {
    canView: true,
    canManage: true,
    canRemove: true,
    canGenerateToken: true,
    canOrganizeGroups: true,
    canManageGames: true,
    canScore: true,
    role: 'owner',
    produtoraId,
    sellerPermissions: null,
  }
}

function nonePermission(produtoraId: string | null): CampeonatoPermission {
  return {
    canView: true,
    canManage: false,
    canRemove: false,
    canGenerateToken: false,
    canOrganizeGroups: false,
    canManageGames: false,
    canScore: false,
    role: 'none',
    produtoraId,
    sellerPermissions: null,
  }
}

export function permissionPublicPayload(permission: CampeonatoPermission) {
  return {
    canView: permission.canView,
    canManage: permission.canManage,
    canRemove: permission.canRemove,
    canGenerateToken: permission.canGenerateToken,
    canOrganizeGroups: permission.canOrganizeGroups,
    canManageGames: permission.canManageGames,
    canScore: permission.canScore,
    role: permission.role,
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
    return nonePermission(produtoraId)
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
      const manage = Boolean(vínculo.pode_gerenciar_campeonato)
      return {
        canView: Boolean(vínculo.pode_ver) || manage,
        canManage: manage,
        canRemove: manage,
        canGenerateToken: Boolean(vínculo.pode_gerar_token) || manage,
        canOrganizeGroups: manage,
        canManageGames: manage,
        canScore: manage,
        role: 'manager',
        produtoraId,
        sellerPermissions: null,
      }
    }
  }

  // Vendedor liberado no campeonato
  const { data: vendedor, error: vendedorError } = await supabaseAdmin
    .from('campeonato_vendedores')
    .select('id, status, permissoes, limite_vagas')
    .eq('campeonato_id', campeonatoId)
    .eq('manager_id', manager.id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (vendedorError && !missingRelation(vendedorError)) throw vendedorError
  if (vendedor) {
    return sellerPermissionFromRow(produtoraId, vendedor.permissoes)
  }

  // Fallback legado: token manager_invite
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
    return sellerPermissionFromRow(produtoraId, tokenVendedor.manager_permissoes)
  }

  return nonePermission(produtoraId)
}

function sellerPermissionFromRow(produtoraId: string | null, rawPerms: unknown): CampeonatoPermission {
  const sellerPermissions = normalizeSellerPermissions(rawPerms)
  return {
    canView: true,
    canManage: sellerPermissions.adicionar_equipes,
    canRemove: sellerPermissions.remover_equipes || sellerPermissions.remover_proprias_equipes,
    canGenerateToken: sellerPermissions.gerar_convites_equipe,
    canOrganizeGroups: sellerPermissions.organizar_grupos,
    canManageGames: sellerPermissions.gerenciar_jogos,
    canScore: sellerPermissions.pontuar_tabela,
    role: 'seller',
    produtoraId,
    sellerPermissions,
  }
}

/** Qualquer mutação “de gestão” genérica (legado). Prefira requires específicos. */
export async function requireCampeonatoManage(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (
    permission.canManage
    || permission.canRemove
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
    || permission.canGenerateToken
  ) {
    return permission
  }
  throw new Error('Você não tem permissão para gerenciar este campeonato.')
}

/** Dono do campeonato (produtora / criado_por). */
export async function requireCampeonatoOwner(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (permission.role !== 'owner') {
    throw new Error('Somente o administrador do campeonato pode executar esta ação.')
  }
  return permission
}

/** Adicionar equipes/lines direto no slot. */
export async function requireCampeonatoTeamsWrite(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canManage) {
    throw new Error('Você não tem permissão para adicionar equipes neste campeonato. Use o link de convite.')
  }
  return permission
}

/** Remover equipes/lines. */
export async function requireCampeonatoTeamsRemove(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canRemove && !permission.canManage) {
    throw new Error('Você não tem permissão para remover equipes deste campeonato.')
  }
  return permission
}

/**
 * Criar/editar/excluir jogos e rodadas:
 * adm (owner), manager staff com gestão, ou seller com gerenciar_jogos.
 */
export async function requireCampeonatoGamesWrite(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canManageGames) {
    throw new Error('Somente o administrador ou manager autorizado pode criar/editar jogos.')
  }
  return permission
}

/**
 * Editar fases/grupos/slots:
 * adm, manager com gestão, ou seller com organizar_grupos.
 */
export async function requireCampeonatoStructureWrite(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canOrganizeGroups) {
    throw new Error('Você não tem permissão para editar fases/grupos deste campeonato.')
  }
  return permission
}

/** Pontuação / súmula / tabela. */
export async function requireCampeonatoScore(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canScore) {
    throw new Error('Você não tem permissão para pontuar este campeonato.')
  }
  return permission
}

/** Estrutura (fases/grupos/jogos): leitura. */
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
      || permission.canGenerateToken
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
