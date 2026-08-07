import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  listVacancyFinancialReviews,
  resolveVacancyFinancialReview,
  type FinancialReviewDecision,
} from '@backend/billing/vacancy-purchase'

const DECISIONS = new Set<FinancialReviewDecision>([
  'manter_inscricao',
  'solicitar_regularizacao',
  'marcar_regularizada',
])

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const mode = req.nextUrl.searchParams.get('mode') === 'history' ? 'history' : 'pending'
    const reviews = await listVacancyFinancialReviews(user.id, mode)
    return NextResponse.json({ reviews, mode })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar revisÃµes financeiras.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const compraId = String(body.compra_id || body.id || '').trim()
    const decision = String(body.decision || '') as FinancialReviewDecision
    const note = body.note == null ? null : String(body.note)

    if (!compraId) throw new Error('compra_id obrigatÃ³rio.')
    if (!DECISIONS.has(decision)) {
      throw new Error('DecisÃ£o invÃ¡lida para revisÃ£o financeira.')
    }

    const result = await resolveVacancyFinancialReview({
      compraId,
      authUserId: user.id,
      decision,
      note,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao resolver revisÃ£o financeira.' }, { status: 400 })
  }
}
