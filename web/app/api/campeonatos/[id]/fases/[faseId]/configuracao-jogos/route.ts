import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { atualizarConfiguracaoFase, obterConfiguracaoFase } from '@backend/campeonatos/jogos/jogos.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; faseId: string }> }) {
  try {
    const { id, faseId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    return NextResponse.json({ configuracao: await obterConfiguracaoFase(id, faseId) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar configuração da fase.' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; faseId: string }> }) {
  try {
    const { id, faseId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const configuracao = await atualizarConfiguracaoFase(id, faseId, await req.json())
    return NextResponse.json({ ok: true, configuracao })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar configuração da fase.' }, { status: 400 })
  }
}
