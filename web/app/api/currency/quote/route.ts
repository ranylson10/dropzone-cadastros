import { NextRequest, NextResponse } from 'next/server'
import { createInternationalQuote } from '@/features/lili/currency'
import type { LiliCurrency } from '@/features/lili/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const baseAmountCents = Number(body?.baseAmountCents)
    const currency = String(body?.currency || '').toUpperCase() as LiliCurrency
    const quote = await createInternationalQuote(baseAmountCents, currency)
    return NextResponse.json({ quote })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível gerar a cotação.' }, { status: 400 })
  }
}
