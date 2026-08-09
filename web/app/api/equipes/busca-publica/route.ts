import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().replace(/^@/, '')
    const numeric = /^\d+$/.test(q)
    let query = supabaseAdmin
      .from('equipes')
      .select('id,nome,username,logo_url,tag,public_id,status,localidade,cidade,estado,pais')
      .eq('status', 'ativo')
      .order('nome', { ascending: true })
      // O app carrega o diretório completo e faz a busca localmente.
      // O limite anterior de 80 fazia equipes simplesmente desaparecerem.
      .limit(q ? 200 : 1000)

    if (q) {
      query = numeric
        ? query.eq('public_id', Number(q))
        : query.or(`nome.ilike.%${q}%,username.ilike.%${q}%,tag.ilike.%${q}%,localidade.ilike.%${q}%,cidade.ilike.%${q}%,estado.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ items: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao buscar equipes.' }, { status: 400 })
  }
}
