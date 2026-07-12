import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { confirmarMatchResult } from '@backend/campeonatos/estatisticas/matchresult.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const resultado = await confirmarMatchResult(id, user.id, await req.json())
    return NextResponse.json({ ok: true, ...resultado }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao confirmar MatchResult.' }, { status: 400 })
  }
}
