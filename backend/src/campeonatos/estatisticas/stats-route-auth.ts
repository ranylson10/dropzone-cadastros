import { NextRequest } from 'next/server'
import { getBearerUser } from '../../auth/server-auth'
import { getCampeonatoPermission } from '../campeonato-permissions'

export async function podeVerEstatisticasImediatas(req: NextRequest, campeonatoId: string) {
  if (!req.headers.get('authorization')) return false
  try {
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, campeonatoId)
    return permission.role === 'owner'
      || permission.role === 'manager'
      || permission.canManage
      || permission.canManageGames
      || permission.canScore
  } catch {
    return false
  }
}
