import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const { equipe_id } = await req.json()
    const { data: equipe, error: teamError } = await supabaseAdmin.from('equipes').select('id,nome').eq('id', String(equipe_id || '')).or(`auth_user_id.eq.${user.id},dono_auth_user_id.eq.${user.id}`).maybeSingle()
    if (teamError) throw teamError
    if (!equipe) throw new Error('Você não pode gerar convite para esta equipe.')
    const token = randomBytes(18).toString('base64url')
    const { error } = await supabaseAdmin.from('tokens').insert({ token, tipo: 'convite_jogador_equipe', equipe_id: equipe.id, criado_por: user.id, usado: false, status: 'ativo' })
    if (error) throw error
    const url = `${req.nextUrl.origin}/equipe/entrar/${token}`
    return NextResponse.json({ token, url, texto: `Você recebeu um convite para entrar na equipe ${equipe.nome}.\n\nAcesse: ${url}` }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar convite.' }, { status: 400 })
  }
}
