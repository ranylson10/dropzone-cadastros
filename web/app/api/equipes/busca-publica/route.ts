import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().replace(/^@/, '')
    if (q.length < 2) return NextResponse.json({ items: [] })
    const numeric = /^\d+$/.test(q)
    let query = supabaseAdmin.from('equipes').select('id,nome,username,logo_url,tag,public_id,status').eq('status', 'ativo').limit(12)
    query = numeric ? query.eq('public_id', Number(q)) : query.or(`nome.ilike.%${q}%,username.ilike.%${q}%,tag.ilike.%${q}%`)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ items: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao buscar equipes.' }, { status: 400 })
  }
}
