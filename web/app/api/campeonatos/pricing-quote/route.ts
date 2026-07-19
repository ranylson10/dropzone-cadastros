import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { quoteChampionshipPrice } from '@backend/admin/pricing'

/**
 * Cotação de preço para produtora montar campeonato (autenticado).
 * Não exige admin — só cálculo a partir da tabela de preços.
 */
export async function POST(req: NextRequest) {
  try {
    await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const quote = await quoteChampionshipPrice({
      tipo: body.tipo,
      numero_vagas: body.numero_vagas,
      recursos: body.recursos || {},
    })
    return NextResponse.json({ quote })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cotar.' }, { status: 400 })
  }
}
