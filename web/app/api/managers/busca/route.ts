import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { searchManagers } from '@backend/equipes/manager-invites'

export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    const q = String(req.nextUrl.searchParams.get('q') || '').trim()
    const items = await searchManagers(q, 12)
    return NextResponse.json({
      items: items.map((m) => ({
        id: m.id,
        username: m.username,
        nome: m.nome,
        avatar_url: m.avatar_url || null,
        public_id: m.public_id ?? null,
        public_id_prefix: m.public_id_prefix || 'MN',
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro na busca.' }, { status: 400 })
  }
}
