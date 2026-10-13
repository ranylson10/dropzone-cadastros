import { NextRequest, NextResponse } from 'next/server'
import { searchDirectory } from '@backend/directory/search-page'

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await searchDirectory('player', req.nextUrl.searchParams))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao buscar jogadores.' }, { status: 400 })
  }
}
