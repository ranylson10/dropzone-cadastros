import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { registrarVinculosMatchResult } from '@backend/campeonatos/pontuador/pontuador.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; jogoId: string }> }) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    return NextResponse.json({ ok: true, ...(await registrarVinculosMatchResult(id, jogoId, user.id, await req.json())) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar vínculos.' }, { status: 400 })
  }
}
