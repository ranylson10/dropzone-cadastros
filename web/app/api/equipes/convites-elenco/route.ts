import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

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
