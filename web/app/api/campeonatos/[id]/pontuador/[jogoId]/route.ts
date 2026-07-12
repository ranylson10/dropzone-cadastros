import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { carregarPontuadorJogo } from '@backend/campeonatos/pontuador/pontuador.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; jogoId: string }> }) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    return NextResponse.json(await carregarPontuadorJogo(id, jogoId))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar pontuador.' }, { status: 400 })
  }
}
