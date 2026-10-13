import { NextResponse } from 'next/server'
import { getCachedRankingTiers } from '@/features/ranking/server'

export async function GET() {
  try {
    return NextResponse.json(await getCachedRankingTiers(), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o ranking.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
