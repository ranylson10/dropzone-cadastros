import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { createLiliPayPalOrder, paypalConfigured } from '@backend/billing/paypal'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertPayPalPrice, resolvePayPalQuote } from '@backend/billing/paypal-price'

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json()
    const reservationId = String(body?.reservationId || '')
    const { data: reservation, error } = await supabaseAdmin
      .from('lili_reservas_slot').select('*').eq('id', reservationId).eq('auth_user_id', user.id).single()
    if (error || !reservation) throw new Error('Reserva não localizada.')
    const quote = resolvePayPalQuote(reservation, 'lili_reservas_slot')
    if (body.amountMinor !== undefined || body.currency !== undefined) {
      assertPayPalPrice(quote, body.amountMinor ?? quote.totalMinor, body.currency ?? quote.currency)
    }
    const payment = await createLiliPayPalOrder({ reservation, campeonatoNome: String(reservation.meta?.campeonato_nome || 'Campeonato'), amountMinor: quote.totalMinor, currency: quote.currency, returnOrigin: req.nextUrl.origin })
    return NextResponse.json({ orderId: payment.paypal_order_id, approvalUrl: payment.paypal_approval_url, paymentId: payment.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao criar ordem PayPal.' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: paypalConfigured() })
}
