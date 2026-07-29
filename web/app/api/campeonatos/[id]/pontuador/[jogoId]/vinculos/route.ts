import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import {
  atualizarVinculoMatchResult,
  registrarVinculosMatchResult,
  removerVinculoMatchResult,
} from '@backend/campeonatos/pontuador/pontuador.service'

type RouteContext = { params: Promise<{ id: string; jogoId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    return NextResponse.json({ ok: true, ...(await registrarVinculosMatchResult(id, jogoId, user.id, await req.json())) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar vínculos.' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const vinculo = await atualizarVinculoMatchResult(id, jogoId, user.id, await req.json())
    return NextResponse.json({ ok: true, vinculo })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao alterar vínculo.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id, jogoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json().catch(() => ({})) as { id?: string }
    const removido = await removerVinculoMatchResult(id, jogoId, String(body.id || ''))
    return NextResponse.json({ ok: true, removido })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao remover vínculo.' }, { status: 400 })
  }
}
