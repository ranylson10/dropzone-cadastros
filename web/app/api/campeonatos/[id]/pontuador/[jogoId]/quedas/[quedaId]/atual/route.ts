import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { definirQuedaAtual } from '@backend/campeonatos/pontuador/pontuador.service'

/** Marca a queda como atual (em_andamento) — usado por overlays Stream. */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; jogoId: string; quedaId: string }> },
) {
  try {
    const { id, jogoId, quedaId } = await context.params
    const user = await getBearerUser(_req)
    await requireCampeonatoScore(user.id, id)
    const result = await definirQuedaAtual(id, jogoId, quedaId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao definir queda atual.' },
      { status: 400 },
    )
  }
}
