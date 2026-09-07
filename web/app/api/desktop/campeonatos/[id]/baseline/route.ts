import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { canUseLocalStudio, getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { carregarBaselineAntesPartida } from '@backend/campeonatos/estatisticas/baseline.service'

/** Baseline histórico imediatamente anterior à queda atual para o Engine local. */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canUseLocalStudio(permission)) {
      return NextResponse.json({ error: 'Sua conta não tem permissão para usar este campeonato no DropZone Live Local.' }, { status: 403 })
    }
    const jogoId = req.nextUrl.searchParams.get('jogo_id')?.trim()
    const partidaId = req.nextUrl.searchParams.get('partida_id')?.trim()
    if (!jogoId || !partidaId) {
      return NextResponse.json({ error: 'Informe jogo_id e partida_id.' }, { status: 400 })
    }
    return NextResponse.json(await carregarBaselineAntesPartida(id, jogoId, partidaId))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar o baseline histórico.' }, { status: 400 })
  }
}
