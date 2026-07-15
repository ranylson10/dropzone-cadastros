import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { previewMatchResult } from '@backend/campeonatos/estatisticas/matchresult.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json()
    if (!body?.partida_id || typeof body?.conteudo_bruto !== 'string') throw new Error('Informe a queda e o conteúdo do MatchResult.')
    return NextResponse.json({ ok: true, preview: await previewMatchResult(id, body.partida_id, body.conteudo_bruto) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao interpretar MatchResult.' }, { status: 400 })
  }
}
