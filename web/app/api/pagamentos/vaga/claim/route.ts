import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { claimVacancyPurchase } from '@backend/billing/vacancy-purchase'

/**
 * POST — consome compra liberada: escolhe line + slot e entra no campeonato.
 * body: { token, equipe_id, slot_id, line_id?, nome_line? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))

    const token = String(body.token || '').trim()
    const equipeId = String(body.equipe_id || '').trim()
    const slotId = String(body.slot_id || '').trim()
    if (!token) throw new Error('token obrigatório.')
    if (!equipeId) throw new Error('equipe_id obrigatório.')
    if (!slotId) throw new Error('slot_id obrigatório.')

    const result = await claimVacancyPurchase({
      token,
      authUserId: user.id,
      accounts,
      equipeId,
      lineId: body.line_id || null,
      nomeLine: body.nome_line || null,
      slotId,
    })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao confirmar vaga.' }, { status: 400 })
  }
}
