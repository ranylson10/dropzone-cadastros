import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().replace(/^@/, '')
    const numeric = /^\d+$/.test(q)
    let query = supabaseAdmin
      .from('jogadores')
      .select('id,nick,nome,username,avatar_url,foto_url,id_jogo,funcao,public_id,status,localidade,cidade,estado,pais,bio,disponivel_recrutamento')
      .eq('status', 'ativo')
      .order('nome', { ascending: true })
      .limit(q ? 200 : 1000)

    if (q) {
      query = numeric
        ? query.or(`public_id.eq.${Number(q)},id_jogo.eq.${q}`)
        : query.or(`nome.ilike.%${q}%,nick.ilike.%${q}%,username.ilike.%${q}%,funcao.ilike.%${q}%`)
    }
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ items: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao buscar jogadores.' }, { status: 400 })
  }
}
