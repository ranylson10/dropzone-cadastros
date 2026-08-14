import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { listarEstatisticasEquipes } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'

function canUseLocalStudio(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

/** Dados para o DropZone Live Local. Nunca aceita uma chave de serviço no computador. */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canUseLocalStudio(permission)) {
      return NextResponse.json({ error: 'Sua conta não tem permissão para usar este campeonato no DropZone Live Local.' }, { status: 403 })
    }

    const query = req.nextUrl.searchParams
    const filters = {
      faseId: query.get('fase_id'),
      rodadaId: query.get('rodada_id'),
      jogoId: query.get('jogo_id'),
      partidaId: query.get('partida_id'),
      mapaCodigo: query.get('mapa_codigo'),
      grupoId: query.get('grupo_id'),
    }
    const [equipes, jogadores] = await Promise.all([
      listarEstatisticasEquipes(id, filters),
      listarEstatisticasMvp(id, filters),
    ])
    return NextResponse.json({ equipes, jogadores, permission: { role: permission.role, canScore: permission.canScore } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar os dados do campeonato.' }, { status: 400 })
  }
}
