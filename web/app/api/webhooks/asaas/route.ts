import { NextRequest, NextResponse } from 'next/server'
import { applyAsaasPaymentUpdate } from '@backend/billing/payments'
import { getPayment } from '@backend/billing/asaas'
import { booleanEnv, optionalEnv } from '@backend/shared/env'

/**
 * Webhook ASAAS.
 * Configure em: Integrações → Webhooks → URL:
 *   https://SEU_DOMINIO/api/webhooks/asaas
 * Obrigatório: ASAAS_WEBHOOK_TOKEN — validamos o header asaas-access-token.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = optionalEnv('ASAAS_WEBHOOK_TOKEN')
    if (!expected) {
      return NextResponse.json(
        { error: 'Webhook ASAAS não configurado.' },
        { status: 503 },
      )
    }

    const header =
      req.headers.get('asaas-access-token')
      || req.headers.get('access_token')
      || ''
    if (header !== expected) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const paymentPayload = body.payment || body

    if (!paymentPayload?.id) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    // O payload recebido nunca confirma pagamento sozinho. O estado oficial
    // deve ser obtido diretamente da API ASAAS.
    const payment = await getPayment(String(paymentPayload.id))

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
    configured: booleanEnv('ASAAS_API_KEY') && booleanEnv('ASAAS_WEBHOOK_TOKEN'),
  })
}
