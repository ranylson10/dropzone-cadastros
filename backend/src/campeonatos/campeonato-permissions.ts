import { supabaseAdmin } from '../shared/supabase-admin'

export type CampeonatoPermission = {
  canView: boolean
  canManage: boolean
  canGenerateToken: boolean
  role: 'owner' | 'manager' | 'seller' | 'none'
  produtoraId: string | null
}

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
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
      return { canView: true, canManage: true, canGenerateToken: true, role: 'owner', produtoraId }
    }
  }

  if (campeonato.criado_por === userId) {
    return { canView: true, canManage: true, canGenerateToken: true, role: 'owner', produtoraId }
  }

  const { data: manager, error: managerError } = await supabaseAdmin
    .from('managers')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (managerError) throw managerError
  if (!manager || !produtoraId) {
    return { canView: true, canManage: false, canGenerateToken: false, role: 'none', produtoraId }
  }

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
      role: 'manager',
      produtoraId,
    }
  }

  const { data: vendedor, error: vendedorError } = await supabaseAdmin
    .from('campeonato_vendedores')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('manager_id', manager.id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (vendedorError && !missingRelation(vendedorError)) throw vendedorError
  if (vendedor) {
    return { canView: true, canManage: false, canGenerateToken: true, role: 'seller', produtoraId }
  }

  return { canView: true, canManage: false, canGenerateToken: false, role: 'none', produtoraId }
}

export async function requireCampeonatoManage(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canManage) throw new Error('Você não tem permissão para gerenciar este campeonato.')
  return permission
}

export async function requireCampeonatoTokenPermission(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!permission.canGenerateToken) {
    throw new Error('Você não tem permissão para gerar convites neste campeonato.')
  }
  return permission
}
