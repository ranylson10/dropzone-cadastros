import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { listarJogosPontuador } from '@backend/campeonatos/pontuador/pontuador.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const jogos = await listarJogosPontuador(id, {
      faseId: req.nextUrl.searchParams.get('fase_id'),
      rodadaId: req.nextUrl.searchParams.get('rodada_id'),
    })
    return NextResponse.json({ jogos })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar jogos do pontuador.' }, { status: 400 })
  }
}
