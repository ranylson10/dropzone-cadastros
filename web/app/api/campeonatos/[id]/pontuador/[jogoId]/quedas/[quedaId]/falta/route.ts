import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { marcarFaltaPontuador } from '@backend/campeonatos/pontuador/pontuador.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; jogoId: string; quedaId: string }> }) {
  try {
    const { id, jogoId, quedaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    return NextResponse.json({ ok: true, ...(await marcarFaltaPontuador(id, jogoId, quedaId, user.id, await req.json())) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao registrar falta.' }, { status: 400 })
  }
}
