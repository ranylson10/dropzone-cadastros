import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { criarRodada, listarRodadas } from '@backend/campeonatos/jogos/jogos.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    return NextResponse.json({ rodadas: await listarRodadas(id, req.nextUrl.searchParams.get('fase_id')) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar rodadas.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const rodada = await criarRodada(id, await req.json())
    return NextResponse.json({ ok: true, rodada }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar rodada.' }, { status: 400 })
  }
}
