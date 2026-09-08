import { NextResponse } from 'next/server'
import { getCachedRankingTiers } from '@/features/ranking/server'

export async function GET() {
  try {
    return NextResponse.json(await getCachedRankingTiers())
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar o ranking.' }, { status: 400 })
  }
}
