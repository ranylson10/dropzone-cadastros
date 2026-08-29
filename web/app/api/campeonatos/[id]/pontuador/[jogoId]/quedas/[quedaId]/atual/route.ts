import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { atualizarEstadoTransmissao } from '@backend/campeonatos/stream/transmission-state.service'

/** Compatibilidade: define o ponteiro da transmissao sem alterar a partida. */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; jogoId: string; quedaId: string }> },
) {
  try {
    const { id, jogoId, quedaId } = await context.params
    const user = await getBearerUser(_req)
    await requireCampeonatoScore(user.id, id)
    const transmissao = await atualizarEstadoTransmissao(id, user.id, {
      activeJogoId: jogoId,
      activePartidaId: quedaId,
    })
    return NextResponse.json({ ok: true, transmissao })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao definir queda atual.' },
      { status: 400 },
    )
  }
}
