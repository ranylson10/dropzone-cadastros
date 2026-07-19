import { NextRequest, NextResponse } from 'next/server'
import { applyAsaasPaymentUpdate } from '@backend/billing/payments'
import { getPayment } from '@backend/billing/asaas'

/**
 * Webhook ASAAS.
 * Configure em: Integrações → Webhooks → URL:
 *   https://SEU_DOMINIO/api/webhooks/asaas
 * Opcional: ASAAS_WEBHOOK_TOKEN — validamos header asaas-access-token ou query ?token=
 */
export async function POST(req: NextRequest) {
  try {
    const expected = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim()
    if (expected) {
      const header =
        req.headers.get('asaas-access-token')
        || req.headers.get('access_token')
        || ''
      const q = req.nextUrl.searchParams.get('token') || ''
      if (header !== expected && q !== expected) {
        return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const paymentPayload = body.payment || body

    if (!paymentPayload?.id) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    // reconsulta ASAAS para não confiar só no body
    let payment = paymentPayload
    try {
      payment = await getPayment(String(paymentPayload.id))
    } catch {
      // se ASAAS indisponível, usa payload do webhook
    }

    const result = await applyAsaasPaymentUpdate(payment, body)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[asaas webhook]', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Erro webhook' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'asaas-webhook',
    configured: Boolean(process.env.ASAAS_API_KEY),
  })
}
