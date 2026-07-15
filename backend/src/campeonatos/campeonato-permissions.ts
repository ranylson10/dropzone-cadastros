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
 * seller (campeonato_vendedores):
 *   - padrão: só gerar convite único + ver estrutura + vender vagas
 *   - entrada de equipes: via link (único ou de grupo), não por botão direto
 *   - flags opt-in: adicionar_equipes, remover_proprias_equipes, organizar_grupos, pontuar_tabela
 *
 * demais: leitura pública quando aplicável; sem mutações
 */

export type SellerPermissions = {
  vendedor_vagas: boolean
  /** Direto na UI/API — desligado por padrão; entrada deve ser por link. */
  adicionar_equipes: boolean
  remover_proprias_equipes: boolean
  gerar_convites_equipe: boolean
  ver_estrutura: boolean
  organizar_grupos: boolean
  pontuar_tabela: boolean
}

/** Defaults de vendedor: vende/convite; não monta estrutura nem adiciona line na mão. */
export const DEFAULT_SELLER_PERMISSIONS: SellerPermissions = {
  vendedor_vagas: true,
  adicionar_equipes: false,
  remover_proprias_equipes: false,
  gerar_convites_equipe: true,
  ver_estrutura: true,
  organizar_grupos: false,
  pontuar_tabela: false,
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
  return {
    vendedor_vagas: value.vendedor_vagas !== false,
    // opt-in: só true se explícito
    adicionar_equipes: value.adicionar_equipes === true,
    remover_proprias_equipes: value.remover_proprias_equipes === true,
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
    canRemove: sellerPermissions.remover_proprias_equipes,
    canGenerateToken: sellerPermissions.gerar_convites_equipe,
    canOrganizeGroups: sellerPermissions.organizar_grupos,
    // Vendedor NÃO cria/edita jogos — só adm ou manager staff
    canManageGames: false,
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
 * adm (owner) ou manager staff com gestão. Vendedor nunca.
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
