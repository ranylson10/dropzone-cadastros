import { getAccountsForUser } from '../auth/server-auth'
import { getCampeonatoPermission } from '../campeonatos/campeonato-permissions'
import { requireEquipeAccess } from '../equipes/manager-team-access'
import { assertProdutoraAprovada } from '../admin/aprovacao'
import { requireProducerWorkspaceAccess } from '../produtora/workspace-access'

const PROFILE_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast'])

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

export async function requireUploadAccess(input: {
  user: AuthUser
  bucket: string
  entityId?: string | null
  campeonatoId?: string | null
  uploadIntent?: 'create_profile' | 'create_campeonato' | null
  activeProfileId?: string | null
}) {
  // Foto da conta pertence ao usuário autenticado e não exige que ele já
  // tenha criado equipe, jogador, produtora ou outro cadastro operacional.
  if (input.bucket === 'account') return
  const accounts = await getAccountsForUser(input.user)
  const producerAccounts = accounts.filter((account) => account.profile_type === 'produtora')
  const activeProducer = (input.activeProfileId
    ? producerAccounts.find((account) => account.id === input.activeProfileId)
    : null) || (producerAccounts.length === 1 ? producerAccounts[0] : null)

  if (PROFILE_BUCKETS.has(input.bucket)) {
    if (input.bucket === 'produtora') {
      if (!activeProducer) throw new Error('Selecione a produtora antes de enviar este arquivo.')
      await requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'administrar')
      return
    }
    if (accounts.some((account) => account.profile_type === input.bucket)) return
    if (input.bucket === 'equipe' && input.entityId) {
      await requireEquipeAccess(input.user.id, accounts, input.entityId, 'editar')
      return
    }
    // Equipes provisórias pertencem ao workspace ativo. Membro somente leitura
    // não pode usar o upload como atalho para uma operação bloqueada.
    if (input.bucket === 'equipe' && activeProducer) {
      await requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'operar')
      return
    }
    // Durante a criação de um perfil vinculado a entidade ainda não existe.
    // A intenção explícita evita confiar apenas no bucket enviado pelo cliente,
    // e a ausência do tipo garante a regra de um perfil por tipo/login.
    if (input.uploadIntent === 'create_profile') return
    throw new Error('Este usuário não pode enviar arquivos para esse perfil.')
  }
  if (input.bucket === 'campeonato') {
    if (!input.campeonatoId) {
      if (input.uploadIntent === 'create_campeonato' && activeProducer) {
        await requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'criar_campeonato')
        await assertProdutoraAprovada(activeProducer.id)
        return
      }
      throw new Error('Campeonato obrigatório para este upload.')
    }
    const permission = await getCampeonatoPermission(input.user.id, input.campeonatoId)
    if (permission.role === 'owner' || permission.role === 'manager' || permission.canManage || permission.canOrganizeGroups || permission.canManageGames || permission.canScore) return
    throw new Error('Sem permissão para enviar mídia deste campeonato.')
  }
  throw new Error('Bucket inválido.')
}
