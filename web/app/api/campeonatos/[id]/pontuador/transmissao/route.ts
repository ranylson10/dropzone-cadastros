import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import {
  atualizarEstadoTransmissao,
  carregarEstadoTransmissao,
} from '@backend/campeonatos/stream/transmission-state.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    return NextResponse.json({ transmissao: await carregarEstadoTransmissao(id) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao carregar estado da transmissao.',
    }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json().catch(() => ({}))
    const hasPartida = Object.prototype.hasOwnProperty.call(body, 'active_partida_id')
    const transmissao = await atualizarEstadoTransmissao(id, user.id, {
      activeJogoId: body.active_jogo_id ? String(body.active_jogo_id) : null,
      activePartidaId: hasPartida
        ? (body.active_partida_id ? String(body.active_partida_id) : null)
        : undefined,
      expectedVersion: body.expected_version == null ? null : Number(body.expected_version),
    })
    return NextResponse.json({ transmissao }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    const conflict = error?.code === 'STREAM_STATE_CONFLICT' || /mudou|alterado em outro/i.test(String(error?.message || ''))
    return NextResponse.json({
      error: error?.message || 'Erro ao atualizar estado da transmissao.',
      conflict,
    }, { status: conflict ? 409 : 400 })
  }
}
