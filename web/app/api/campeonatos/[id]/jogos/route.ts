import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { criarJogo, listarJogos } from '@backend/campeonatos/jogos/jogos.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const jogos = await listarJogos(id, {
      faseId: req.nextUrl.searchParams.get('fase_id'),
      rodadaId: req.nextUrl.searchParams.get('rodada_id'),
    })
    return NextResponse.json({ jogos })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar jogos.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const jogo = await criarJogo(id, await req.json())
    return NextResponse.json({ ok: true, jogo }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar jogo.' }, { status: 400 })
  }
}
