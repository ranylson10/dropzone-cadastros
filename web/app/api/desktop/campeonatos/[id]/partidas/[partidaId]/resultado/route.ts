import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { ingestEngineResultV1 } from '@backend/campeonatos/estatisticas/engine-result.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; partidaId: string }> }) {
  try {
    const { id, partidaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json()
    const headerKey = String(req.headers.get('idempotency-key') || '').trim()
    if (!headerKey || headerKey !== String(body?.idempotency_key || '').trim()) {
      return NextResponse.json({ error: 'Idempotency-Key ausente ou diferente do payload.' }, { status: 400 })
    }
    const result = await ingestEngineResultV1(id, partidaId, user.id, body)
    return NextResponse.json(result, { status: result.already_processed ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consolidar resultado do Engine.' }, { status: 400 })
  }
}
