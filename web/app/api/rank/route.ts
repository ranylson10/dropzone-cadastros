import { NextResponse } from 'next/server'
import { carregarRankingTiers } from '@backend/ranking/tier-ranking.service'

export async function GET() {
  try {
    return NextResponse.json(await carregarRankingTiers())
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar o ranking.' }, { status: 400 })
  }
}
