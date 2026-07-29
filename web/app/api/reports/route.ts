import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req), body = await req.json()
    const targetType = String(body.target_type || ''), targetId = String(body.target_id || ''), category = String(body.category || '').trim(), description = String(body.description || '').trim()
    if (!['produtora', 'equipe', 'jogador', 'manager', 'campeonato', 'publicacao'].includes(targetType) || !UUID_RE.test(targetId)) throw new Error('Alvo inválido.')
    if (category.length < 3 || description.length < 10) throw new Error('Descreva melhor o motivo da denúncia.')
    const { data, error } = await supabaseAdmin.from('sistema_denuncias').insert({ denunciante_auth_user_id: user.id, alvo_tipo: targetType, alvo_id: targetId, categoria: category.slice(0, 80), descricao: description.slice(0, 2000) }).select('id,status').single()
    if (error) throw error
    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'Erro ao enviar denúncia.' }, { status: 400 }) }
}
