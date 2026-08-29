import { NextRequest } from 'next/server'
import { getBearerUser } from '../../auth/server-auth'
import { getCampeonatoPermission } from '../campeonato-permissions'
import { supabaseAdmin } from '../../shared/supabase-admin'

function canStream(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
}
export async function authorizeStreamData(req: NextRequest, campeonatoId: string) {
  const streamKey = String(req.headers.get('x-dropzone-stream-key') || '').trim()
  if (streamKey) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .select('id,campeonato_id,label')
      .eq('key_token', streamKey)
      .eq('campeonato_id', campeonatoId)
      .eq('ativo', true)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Chave Stream invalida ou revogada.')
    return { mode: 'stream_key' as const, keyId: String(data.id), userId: null }
  }

  const user = await getBearerUser(req)
  const permission = await getCampeonatoPermission(user.id, campeonatoId)
  if (!canStream(permission)) throw new Error('Sem permissao para acessar os dados Stream.')
  return { mode: 'user' as const, keyId: null, userId: user.id }
}
