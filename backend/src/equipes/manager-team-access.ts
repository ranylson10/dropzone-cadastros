import { supabaseAdmin } from '../shared/supabase-admin'
import { isMissingRelation } from './manager-invites'

export type ControllableEquipe = {
  id: string
  nome: string
  username?: string | null
  logo_url?: string | null
  tag?: string | null
  papel: 'dono' | 'staff'
  permissoes: {
    pode_ver: boolean
    pode_editar: boolean
    pode_escalar: boolean
    pode_gerar_token: boolean
  }
}

/**
 * Equipes que o usuário controla:
 * - perfil equipe do próprio login (dono)
 * - staff em manager_equipe (ativo)
 */
export async function listControllableEquipes(
  _authUserId: string,
  accounts: Array<{ id: string; profile_type?: string | null; name?: string | null; username?: string | null; data?: any }>,
): Promise<ControllableEquipe[]> {
  const owned = accounts
    .filter((a) => a.profile_type === 'equipe')
    .map((a) => ({
      id: a.id,
      nome: a.name || a.username || 'Equipe',
      username: a.username || null,
      logo_url: a.data?.logo_url || null,
      tag: a.data?.tag || null,
      papel: 'dono' as const,
      permissoes: {
        pode_ver: true,
        pode_editar: true,
        pode_escalar: true,
        pode_gerar_token: true,
      },
    }))

  const managerIds = accounts.filter((a) => a.profile_type === 'manager').map((a) => a.id).filter(Boolean)
  let staff: ControllableEquipe[] = []

  if (managerIds.length) {
    const { data: links, error } = await supabaseAdmin
      .from('manager_equipe')
      .select('id,manager_id,equipe_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status')
      .in('manager_id', managerIds)
      .eq('status', 'ativo')
    if (error && !isMissingRelation(error)) throw error

    const equipeIds = [...new Set((links || []).map((l) => l.equipe_id).filter(Boolean))]
    const { data: equipes } = equipeIds.length
      ? await supabaseAdmin
          .from('equipes')
          .select('id,nome,username,logo_url,tag,status')
          .in('id', equipeIds)
      : { data: [] as any[] }
    const eqMap = new Map((equipes || []).map((e) => [e.id, e]))

    staff = (links || [])
      .filter((l) => l.pode_ver !== false)
      .map((l) => {
        const eq = eqMap.get(l.equipe_id)
        return {
          id: l.equipe_id,
          nome: eq?.nome || 'Equipe',
          username: eq?.username || null,
          logo_url: eq?.logo_url || null,
          tag: eq?.tag || null,
          papel: 'staff' as const,
          permissoes: {
            pode_ver: l.pode_ver !== false,
            pode_editar: Boolean(l.pode_editar),
            pode_escalar: Boolean(l.pode_escalar),
            pode_gerar_token: Boolean(l.pode_gerar_token),
          },
        }
      })
  }

  // dono tem prioridade se aparecer nos dois
  const byId = new Map<string, ControllableEquipe>()
  for (const e of staff) byId.set(e.id, e)
  for (const e of owned) byId.set(e.id, e)
  return Array.from(byId.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function requireEquipeAccess(
  authUserId: string,
  accounts: Array<{ id: string; profile_type?: string | null; name?: string | null; username?: string | null; data?: any }>,
  equipeId: string,
  need: 'ver' | 'editar' | 'escalar' | 'token' = 'ver',
) {
  const list = await listControllableEquipes(authUserId, accounts)
  const found = list.find((e) => e.id === equipeId)
  if (!found) throw new Error('Sem permissão nesta equipe.')
  if (need === 'editar' && !found.permissoes.pode_editar) {
    throw new Error('Sem permissão para editar lines desta equipe.')
  }
  if (need === 'escalar' && !found.permissoes.pode_escalar && !found.permissoes.pode_editar) {
    throw new Error('Sem permissão para escalar nesta equipe.')
  }
  if (need === 'token' && !found.permissoes.pode_gerar_token && !found.permissoes.pode_editar) {
    throw new Error('Sem permissão para gerar tokens nesta equipe.')
  }
  return found
}
