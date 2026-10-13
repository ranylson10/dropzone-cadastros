import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { lifecycleMode, tryAtomicLifecycle } from '@backend/campeonatos/lifecycle-transport'
import { slotTransferErrorResponse } from '@backend/campeonatos/slot-transfer'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const user = await getBearerUser(request)
    if (lifecycleMode() !== 'atomic') return NextResponse.json({ error: 'Encerramento e reabertura temporariamente indisponíveis.' }, { status: 503, headers })
    const { id } = await params, permission = await getCampeonatoPermission(user.id, id)
    if (!permission.canView || !permission.canManage || permission.role === 'none') return NextResponse.json({ error: 'Sem permissão para esta edição.' }, { status: 403, headers })
    const result = await tryAtomicLifecycle(user.id, id, await request.json(), request.headers.get('Idempotency-Key'))
    if (!result) return NextResponse.json({ error: 'Ação de encerramento inválida.' }, { status: 400, headers })
    return NextResponse.json(result, { headers })
  } catch (error) {
    const known = slotTransferErrorResponse(error)
    if (known) return NextResponse.json(known.body, { status: known.status, headers })
    const unauthorized = error instanceof Error && ['Sessao ausente.','Sessao invalida.'].includes(error.message)
    return NextResponse.json({ error: unauthorized ? 'Não autenticado.' : 'Não foi possível confirmar o encerramento.' }, { status: unauthorized ? 401 : 400, headers })
  }
}
