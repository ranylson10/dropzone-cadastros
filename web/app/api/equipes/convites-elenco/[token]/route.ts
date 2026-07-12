import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function convite(token: string) {
  const { data, error } = await supabaseAdmin.from('tokens').select('id,equipe_id,status,expira_em,equipes:equipe_id(id,nome,tag,logo_url)').eq('token', token).eq('tipo', 'convite_jogador_equipe').maybeSingle()
  if (error) throw error
  if (!data || data.status !== 'ativo' || (data.expira_em && new Date(data.expira_em).getTime() < Date.now())) throw new Error('Convite inválido ou expirado.')
  return data as any
}

export async function GET(_: NextRequest, context: { params: Promise<{ token: string }> }) {
  try { const item = await convite((await context.params).token); return NextResponse.json({ equipe: item.equipes }) }
  catch (error: any) { return NextResponse.json({ error: error?.message || 'Convite inválido.' }, { status: 404 }) }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getBearerUser(req)
    const item = await convite((await context.params).token)
    const { data: jogador, error: playerError } = await supabaseAdmin.from('jogadores').select('id,nick,avatar_url,id_jogo,funcao,localidade').eq('auth_user_id', user.id).maybeSingle()
    if (playerError) throw playerError
    if (!jogador) throw new Error('Crie ou acesse seu perfil de jogador para aceitar o convite.')
    const { error } = await supabaseAdmin.from('equipe_jogadores').upsert({ equipe_id: item.equipe_id, jogador_auth_user_id: user.id, nick: jogador.nick, foto_url: jogador.avatar_url, id_jogo: jogador.id_jogo, funcao: jogador.funcao, localidade: jogador.localidade, origem: 'convite', status: 'ativo', updated_at: new Date().toISOString() }, { onConflict: 'equipe_id,jogador_auth_user_id' })
    if (error) throw error
    return NextResponse.json({ success: true, equipe: item.equipes })
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 }) }
}
