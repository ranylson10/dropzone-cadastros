import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipeId = String(req.nextUrl.searchParams.get('equipe_id') || '')
    const lineId = String(req.nextUrl.searchParams.get('line_id') || '')
    if (!equipeId) throw new Error('Equipe não informada.')

    await requireEquipeAccess(user.id, accounts, equipeId, 'token')

    let query = supabaseAdmin
      .from('tokens')
      .select('id,token,line_id,campeonato_equipe_id,status,usado,expira_em,created_at')
      .eq('tipo', 'convite_jogador_equipe')
      .eq('equipe_id', equipeId)
      .eq('usado', false)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })

    if (lineId) query = query.eq('line_id', lineId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      invites: (data || []).map((item: any) => ({
        ...item,
        url: `${req.nextUrl.origin}/equipe/entrar/${item.token}`,
        expired: Boolean(item.expira_em && new Date(item.expira_em).getTime() < Date.now()),
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar convites.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const equipeId = String(body.equipe_id || '')
    const tokenId = String(body.token_id || '')
    if (!equipeId || !tokenId) throw new Error('Convite ou equipe não informado.')

    await requireEquipeAccess(user.id, accounts, equipeId, 'token')
    const { data: item, error: readError } = await supabaseAdmin
      .from('tokens')
      .select('id,status,usado')
      .eq('id', tokenId)
      .eq('tipo', 'convite_jogador_equipe')
      .eq('equipe_id', equipeId)
      .maybeSingle()
    if (readError) throw readError
    if (!item || item.usado || item.status !== 'ativo') throw new Error('Este convite não pode mais ser renovado.')

    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabaseAdmin.from('tokens').update({ expira_em: expiraEm, updated_at: new Date().toISOString() }).eq('id', tokenId)
    if (error) throw error
    return NextResponse.json({ success: true, expires_at: expiraEm })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao renovar convite.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const equipeId = String(body.equipe_id || '')
    const tokenId = String(body.token_id || '')
    if (!equipeId || !tokenId) throw new Error('Convite ou equipe não informado.')

    await requireEquipeAccess(user.id, accounts, equipeId, 'token')
    const { data: item, error: readError } = await supabaseAdmin
      .from('tokens')
      .select('id,status,usado')
      .eq('id', tokenId)
      .eq('tipo', 'convite_jogador_equipe')
      .eq('equipe_id', equipeId)
      .maybeSingle()
    if (readError) throw readError
    if (!item) throw new Error('Convite não encontrado.')
    if (item.usado) throw new Error('Convites já utilizados não podem ser cancelados.')

    const { error } = await supabaseAdmin.from('tokens').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', tokenId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cancelar convite.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const body = await req.json().catch(() => ({}))
    const equipeId = String(body.equipe_id || '')
    const lineId = body.line_id ? String(body.line_id) : null
    const campeonatoEquipeId = body.campeonato_equipe_id ? String(body.campeonato_equipe_id) : null

    const access = await requireEquipeAccess(user.id, accounts, equipeId, 'token')
    const { data: equipe, error: teamError } = await supabaseAdmin.from('equipes').select('id,nome').eq('id', equipeId).maybeSingle()
    if (teamError) throw teamError
    if (!equipe) throw new Error('Equipe não encontrada.')

    let line: any = null
    if (lineId) {
      const { data, error } = await supabaseAdmin.from('equipe_lines').select('id,nome,equipe_id').eq('id', lineId).eq('equipe_id', equipeId).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Line não encontrada nesta equipe.')
      line = data
    }

    let participation: any = null
    if (campeonatoEquipeId) {
      const { data, error } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,equipe_id,line_id,campeonato_id,status,campeonato:campeonato_id(id,nome,status)')
        .eq('id', campeonatoEquipeId)
        .eq('equipe_id', equipeId)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Participação no campeonato não encontrada.')
      if (!lineId || String(data.line_id || '') !== lineId) throw new Error('A participação selecionada não pertence a esta line.')
      participation = data
    }

    const token = randomBytes(18).toString('base64url')
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabaseAdmin.from('tokens').insert({
      token,
      tipo: 'convite_jogador_equipe',
      equipe_id: equipe.id,
      line_id: lineId,
      campeonato_equipe_id: campeonatoEquipeId,
      criado_por: user.id,
      usado: false,
      status: 'ativo',
      expira_em: expiraEm,
    })
    if (error) throw error

    const url = `${req.nextUrl.origin}/equipe/entrar/${token}`
    const destino = participation
      ? ` para a line ${line?.nome || ''} no campeonato ${participation.campeonato?.nome || ''}`
      : line
        ? ` para a line ${line.nome}`
        : ''

    return NextResponse.json({
      token,
      url,
      expires_at: expiraEm,
      access: access.permissoes,
      texto: `Você recebeu um convite para entrar na equipe ${equipe.nome}${destino}.\n\nAcesse: ${url}`,
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar convite.' }, { status: 400 })
  }
}
