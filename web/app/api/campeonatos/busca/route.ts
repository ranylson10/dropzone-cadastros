import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { searchCampeonatos } from '@backend/campeonatos/manager-champ-invites'

/** Busca campeonatos por nome (manager pede acesso). */
export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    const q = req.nextUrl.searchParams.get('q') || ''
    const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12)))
    const items = await searchCampeonatos(q, limit)
    return NextResponse.json({ items })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro na busca.' }, { status: 400 })
  }
}
