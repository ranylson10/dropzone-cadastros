import { supabaseAdmin } from '../shared/supabase-admin'

export type ProducerWorkspaceRole =
  | 'proprietario'
  | 'administrador'
  | 'operacao'
  | 'pontuador'
  | 'financeiro'
  | 'comercial'
  | 'visualizacao'

export type ProducerWorkspaceAccess = {
  produtoraId: string
  authUserId: string
  memberId: string | null
  role: ProducerWorkspaceRole
  isOwner: boolean
  pode_ver: boolean
  pode_administrar: boolean
  pode_operar: boolean
  pode_pontuar: boolean
  pode_financeiro: boolean
  pode_comercial: boolean
  pode_gerenciar_membros: boolean
  pode_criar_campeonato: boolean
}

export type ProducerCapability =
  | 'ver'
  | 'administrar'
  | 'operar'
  | 'pontuar'
  | 'financeiro'
  | 'comercial'
  | 'gerenciar_membros'
  | 'criar_campeonato'

const CAPABILITY_FIELD: Record<ProducerCapability, keyof ProducerWorkspaceAccess> = {
  ver: 'pode_ver',
  administrar: 'pode_administrar',
  operar: 'pode_operar',
  pontuar: 'pode_pontuar',
  financeiro: 'pode_financeiro',
  comercial: 'pode_comercial',
  gerenciar_membros: 'pode_gerenciar_membros',
  criar_campeonato: 'pode_criar_campeonato',
}

function ownerAccess(produtoraId: string, authUserId: string): ProducerWorkspaceAccess {
  return {
    produtoraId,
    authUserId,
    memberId: null,
    role: 'proprietario',
    isOwner: true,
    pode_ver: true,
    pode_administrar: true,
    pode_operar: true,
    pode_pontuar: true,
    pode_financeiro: true,
    pode_comercial: true,
    pode_gerenciar_membros: true,
    pode_criar_campeonato: true,
  }
}

export async function getProducerWorkspaceAccess(
  authUserId: string,
  produtoraId: string,
): Promise<ProducerWorkspaceAccess | null> {
  const { data: produtora, error: produtoraError } = await supabaseAdmin
    .from('produtoras')
    .select('id,auth_user_id,status')
    .eq('id', produtoraId)
    .maybeSingle()
  if (produtoraError) throw produtoraError
  if (!produtora || String(produtora.status || 'ativo') === 'deletado') return null
  if (String(produtora.auth_user_id) === authUserId) return ownerAccess(produtoraId, authUserId)

  const { data: member, error: memberError } = await supabaseAdmin
    .from('produtora_membros')
    .select('id,cargo,pode_ver,pode_administrar,pode_operar,pode_pontuar,pode_financeiro,pode_comercial,pode_gerenciar_membros,pode_criar_campeonato,status')
    .eq('produtora_id', produtoraId)
    .eq('auth_user_id', authUserId)
    .eq('status', 'ativo')
    .maybeSingle()
  if (memberError) {
    if (['42P01', 'PGRST205'].includes(memberError.code || '')) return null
    throw memberError
  }
  if (!member) return null

  return {
    produtoraId,
    authUserId,
    memberId: String(member.id),
    role: String(member.cargo || 'visualizacao') as ProducerWorkspaceRole,
    isOwner: false,
    pode_ver: Boolean(member.pode_ver),
    pode_administrar: Boolean(member.pode_administrar),
    pode_operar: Boolean(member.pode_operar),
    pode_pontuar: Boolean(member.pode_pontuar),
    pode_financeiro: Boolean(member.pode_financeiro),
    pode_comercial: Boolean(member.pode_comercial),
    pode_gerenciar_membros: Boolean(member.pode_gerenciar_membros),
    pode_criar_campeonato: Boolean(member.pode_criar_campeonato),
  }
}

export async function requireProducerWorkspaceAccess(
  authUserId: string,
  produtoraId: string,
  capability: ProducerCapability = 'ver',
) {
  const access = await getProducerWorkspaceAccess(authUserId, produtoraId)
  const field = CAPABILITY_FIELD[capability]
  if (!access || !Boolean(access[field])) {
    throw new Error('Você não tem permissão para executar esta ação na produtora.')
  }
  return access
}
