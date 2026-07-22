import { getAccountsForUser } from '../auth/server-auth'
import { getCampeonatoPermission } from '../campeonatos/campeonato-permissions'
import { requireEquipeAccess } from '../equipes/manager-team-access'
import { assertProdutoraAprovada } from '../admin/aprovacao'

const PROFILE_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast'])

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

export async function requireUploadAccess(input: {
  user: AuthUser
  bucket: string
  entityId?: string | null
  campeonatoId?: string | null
  uploadIntent?: 'create_profile' | 'create_campeonato' | null
}) {
  const accounts = await getAccountsForUser(input.user)
  if (PROFILE_BUCKETS.has(input.bucket)) {
    if (accounts.some((account) => account.profile_type === input.bucket)) return
    // Durante a criação de um perfil vinculado a entidade ainda não existe.
    // A intenção explícita evita confiar apenas no bucket enviado pelo cliente,
    // e a ausência do tipo garante a regra de um perfil por tipo/login.
    if (input.uploadIntent === 'create_profile') return
    if (input.bucket === 'equipe' && input.entityId) {
      await requireEquipeAccess(input.user.id, accounts, input.entityId, 'editar')
      return
    }
    throw new Error('Este usuário não pode enviar arquivos para esse perfil.')
  }
  if (input.bucket === 'campeonato') {
    if (!input.campeonatoId) {
      const produtora = accounts.find((account) => account.profile_type === 'produtora')
      if (input.uploadIntent === 'create_campeonato' && produtora) {
        await assertProdutoraAprovada(produtora.id)
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
