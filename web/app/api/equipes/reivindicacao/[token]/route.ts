import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function loadToken(token: string) {
  const clean = decodeURIComponent(String(token || '').trim())
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('id,token,tipo,status,usado,usado_em,expira_em,equipe_id,produtora_id,created_at')
    .eq('token', clean)
    .eq('tipo', 'reivindicacao_equipe_historica')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Link de reivindicação não encontrado.')
  return data
}

async function ownedTeams(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('equipes')
    .select('id,nome,tag,logo_url,status')
    .or(`auth_user_id.eq.${userId},dono_auth_user_id.eq.${userId}`)
    .eq('status', 'ativo')
    .order('nome')
  if (error) throw error
  return data || []
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const convite = await loadToken(token)
    const { data: equipe, error: equipeError } = await supabaseAdmin
      .from('equipes')
      .select('id,nome,tag,logo_url,status,auth_user_id,dono_auth_user_id')
      .eq('id', convite.equipe_id)
      .maybeSingle()
    if (equipeError) throw equipeError
    if (!equipe) throw new Error('Equipe histórica não encontrada.')

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('equipe_lines')
      .select('id,nome,tag,logo_url,status')
      .eq('equipe_id', equipe.id)
      .neq('status', 'inativo')
      .order('created_at')
    if (linesError) throw linesError

    const lineIds = (lines || []).map((line) => line.id)
    let participacoes = 0
    if (lineIds.length) {
      const { count, error: countError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id', { count: 'exact', head: true })
        .in('line_id', lineIds)
        .neq('status', 'removida')
      if (countError) throw countError
      participacoes = count || 0
    }

    let autenticado = false
    let equipesUsuario: any[] = []
    try {
      const user = await getBearerUser(req)
      autenticado = true
      equipesUsuario = await ownedTeams(user.id)
    } catch {
      // Link pode ser consultado antes do login; a mutação sempre exige autenticação.
    }

    const valido = convite.status === 'ativo'
      && !convite.usado
      && (!convite.expira_em || new Date(convite.expira_em).getTime() > Date.now())
      && equipe.status === 'ativo'
      && !equipe.auth_user_id
      && !equipe.dono_auth_user_id

    return NextResponse.json({
      valido,
      autenticado,
      equipe: { id: equipe.id, nome: equipe.nome, tag: equipe.tag, logo_url: equipe.logo_url },
      lines: lines || [],
      participacoes,
      equipes_usuario: equipesUsuario,
      status: convite.usado ? 'usado' : convite.status,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar a reivindicação.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { token } = await context.params
    const body = await req.json().catch(() => ({}))
    const modo = String(body?.modo || '').trim()
    const equipeDestinoId = String(body?.equipe_destino_id || '').trim() || null

    const { data, error } = await supabaseAdmin.rpc('fn_reivindicar_equipe_historica', {
      p_token: decodeURIComponent(token),
      p_auth_user_id: user.id,
      p_modo: modo,
      p_equipe_destino_id: equipeDestinoId,
    })
    if (error) throw error

    return NextResponse.json({ ok: true, resultado: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível reivindicar a equipe.' }, { status: 400 })
  }
}
