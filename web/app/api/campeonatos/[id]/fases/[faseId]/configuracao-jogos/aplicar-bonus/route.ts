import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { aplicarBonusRanking } from '@backend/campeonatos/jogos/jogos.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; faseId: string }> }) {
  try {
    const { id, faseId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const resultado = await aplicarBonusRanking(id, faseId, user.id)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao aplicar bônus do ranking.' }, { status: 400 })
  }
}
