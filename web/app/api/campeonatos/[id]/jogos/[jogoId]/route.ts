import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { listarQuedasJogo } from '@backend/campeonatos/jogos/jogos.service'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; jogoId: string }> },
) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const quedas = await listarQuedasJogo(id, jogoId)
    return NextResponse.json({ quedas })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar quedas.' },
      { status: 400 },
    )
  }
}
