import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { searchDirectory, searchTerm } from '@backend/directory/search-page'

export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    if (searchTerm(req.nextUrl.searchParams).length < 2) return NextResponse.json({ items: [], hasMore: false, nextCursor: null })
    const page = await searchDirectory('player', req.nextUrl.searchParams, { defaultLimit: 12, namespace: 'player-invite', columns: 'id,nome,username,avatar_url,id_jogo,funcao,status', fields: ['nome','username'] })
    return NextResponse.json({ ...page, items: page.items.map(item => ({ ...item, nick: item.nome })) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao buscar jogadores.' }, { status: 400 })
  }
}
