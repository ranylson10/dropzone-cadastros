import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { atualizarRodada, excluirRodada } from '@backend/campeonatos/jogos/jogos.service'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string; rodadaId: string }> }) {
  try {
    const { id, rodadaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    return NextResponse.json({ ok: true, rodada: await atualizarRodada(id, rodadaId, await req.json()) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar rodada.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; rodadaId: string }> }) {
  try {
    const { id, rodadaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    await excluirRodada(id, rodadaId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao excluir rodada.' }, { status: 400 })
  }
}
