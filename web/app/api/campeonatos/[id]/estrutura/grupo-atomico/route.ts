import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoStructureWrite } from '@backend/campeonatos/campeonato-permissions'
import { operationUuid } from '@backend/shared/operation-json'
import { SlotTransferError, slotTransferErrorResponse } from '@backend/campeonatos/slot-transfer'
import { tryAtomicStructureGroup } from '@backend/campeonatos/structure-group-transport'

const headers = { 'Cache-Control': 'no-store' }
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    let id: string
    try { id = operationUuid((await context.params).id) } catch { throw new SlotTransferError('Campeonato inválido.') }
    try { await requireCampeonatoStructureWrite(user.id, id) } catch { throw new SlotTransferError('Sem permissão para criar grupos neste campeonato.', 403) }
    const body = await req.json().catch(() => ({}))
    const result = await tryAtomicStructureGroup(user.id, id, body, req.headers.get('Idempotency-Key'))
    if (!result) throw new SlotTransferError('Ação de grupo inválida.')
    return NextResponse.json(result, { headers })
  } catch (error) {
    const result = slotTransferErrorResponse(error)
    if (result) return NextResponse.json(result.body, { status: result.status, headers })
    return NextResponse.json({ error: 'Sessão inválida ou criação de grupo indisponível.' }, { status: 401, headers })
  }
}
