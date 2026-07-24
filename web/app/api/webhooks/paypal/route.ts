import { NextRequest, NextResponse } from 'next/server'
import { applyPayPalWebhook, paypalConfigured, verifyPayPalWebhook } from '@backend/billing/paypal'

export async function POST(req: NextRequest) {
  try {
    const event = await req.json().catch(() => ({}))
    const valid = await verifyPayPalWebhook(req.headers, event)
    if (!valid) return NextResponse.json({ error: 'Assinatura PayPal inválida.' }, { status: 401 })
    const result = await applyPayPalWebhook(event)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[paypal webhook]', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Erro no webhook PayPal.' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'paypal-webhook', configured: paypalConfigured() && Boolean(process.env.PAYPAL_WEBHOOK_ID) })
}
