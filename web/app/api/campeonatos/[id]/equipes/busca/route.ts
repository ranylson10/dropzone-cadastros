import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTeamsWrite } from '@backend/campeonatos/campeonato-permissions'
import { searchChampionshipTeams } from '@backend/campeonatos/team-search'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTeamsWrite(user.id, id)
    return NextResponse.json(await searchChampionshipTeams(id, req.nextUrl.searchParams))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro na busca.' }, { status: 400 })
  }
}
