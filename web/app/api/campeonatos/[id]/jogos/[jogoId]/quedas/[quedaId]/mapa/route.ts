import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoGamesWrite, requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { atualizarMapaQueda } from '@backend/campeonatos/jogos/jogos.service'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; jogoId: string; quedaId: string }> },
) {
  try {
    const { id, jogoId, quedaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoGamesWrite(user.id, id)
    const body = await req.json()
    const queda = await atualizarMapaQueda(id, jogoId, quedaId, body?.mapa_codigo)
    return NextResponse.json({ ok: true, queda })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar mapa da queda.' },
      { status: 400 },
    )
  }
}
