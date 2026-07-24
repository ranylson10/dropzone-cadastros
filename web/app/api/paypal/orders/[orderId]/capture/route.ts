import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { captureLiliPayPalOrder } from '@backend/billing/paypal'

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { orderId } = await params
    const body = await req.json().catch(() => ({}))
    const payment = await captureLiliPayPalOrder({ orderId, reservationId: String(body?.reservationId || ''), authUserId: user.id })
    return NextResponse.json({ ok: true, payment })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao capturar pagamento PayPal.' }, { status: 400 })
  }
}
