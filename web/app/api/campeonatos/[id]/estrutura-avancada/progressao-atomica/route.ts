import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { progressionWriteMode, tryAtomicProgression } from '@backend/campeonatos/progression-transport'
import { slotTransferErrorResponse } from '@backend/campeonatos/slot-transfer'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const user = await getBearerUser(request)
    if (progressionWriteMode() !== 'atomic') return NextResponse.json({ error: 'Progressão temporariamente indisponível.' }, { status: 503, headers })
    const { id } = await params, permission = await getCampeonatoPermission(user.id, id)
    if (!permission.canView || !permission.canManage || permission.role === 'none') return NextResponse.json({ error: 'Sem permissão para esta progressão.' }, { status: 403, headers })
    const result = await tryAtomicProgression(user.id, id, await request.json(), request.headers.get('Idempotency-Key'))
    return NextResponse.json(result, { headers })
  } catch (error) {
    const known = slotTransferErrorResponse(error)
    if (known) return NextResponse.json(known.body, { status: known.status, headers })
    const unauthorized = error instanceof Error && ['Sessao ausente.', 'Sessao invalida.'].includes(error.message)
    return NextResponse.json({ error: unauthorized ? 'Não autenticado.' : 'Não foi possível concluir a progressão.' }, { status: unauthorized ? 401 : 400, headers })
  }
}
