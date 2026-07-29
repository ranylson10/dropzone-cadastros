import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().replace(/^@/, '')
    if (q.length < 2) return NextResponse.json({ items: [] })
    const numeric = /^\d+$/.test(q)
    let query = supabaseAdmin.from('jogadores').select('id,nome,username,avatar_url,id_jogo,funcao,auth_user_id,status').eq('status', 'ativo').limit(12)
    query = numeric ? query.or(`public_id.eq.${Number(q)},id_jogo.eq.${q}`) : query.or(`nome.ilike.%${q}%,username.ilike.%${q}%`)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({
      items: (data || []).map(({ auth_user_id: _private, nome, ...item }) => ({
        ...item,
        nome,
        nick: nome,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao buscar jogadores.' }, { status: 400 })
  }
}
