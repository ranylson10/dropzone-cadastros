import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url')
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await requireCampeonatoTokenPermission(user.id, id)
    const body = await req.json()
    const vagaId = String(body.vaga_id || '')
    const equipeDestinoId = body.equipe_destino_id ? String(body.equipe_destino_id) : null
    const lineDestinoId = body.line_destino_id ? String(body.line_destino_id) : null
    const nomeEquipe = String(body.nome_equipe_reservada || '').trim()
    const nomeLine = String(body.nome_line_reservada || '').trim()
    if (!vagaId || !nomeEquipe || !nomeLine) throw new Error('Informe a vaga, a equipe e a line previstas.')

    const { data: vaga } = await supabaseAdmin.from('campeonato_vagas').select('*').eq('id', vagaId).eq('campeonato_id', id).single()
    if (!vaga || vaga.status !== 'livre') throw new Error('Esta vaga não está mais livre.')

    if (equipeDestinoId) {
      const { data: duplicados } = await supabaseAdmin.from('tokens').select('id, nome_line_reservada, vaga_id').eq('campeonato_id', id).eq('equipe_destino_id', equipeDestinoId).eq('tipo', 'convite_equipe_campeonato').eq('status', 'ativo').eq('usado', false)
      if ((duplicados || []).some((item) => String(item.nome_line_reservada || '').trim().toLowerCase() === nomeLine.toLowerCase())) {
        throw new Error('Já existe um convite ativo para esta equipe e esta line.')
      }
    }

    const agora = new Date()
    const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const token = novoToken()
    const { data: convite, error: tokenError } = await supabaseAdmin.from('tokens').insert({
      token, tipo: 'convite_equipe_campeonato', produtora_id: permission.produtoraId,
      campeonato_id: id, vaga_id: vagaId, equipe_destino_id: equipeDestinoId,
      line_destino_id: lineDestinoId, nome_equipe_reservada: nomeEquipe,
      nome_line_reservada: nomeLine, criado_por: user.id, usado: false,
      expira_em: expiraEm, status: 'ativo',
    }).select('*').single()
    if (tokenError) throw tokenError

    const { data: atualizada, error: vagaError } = await supabaseAdmin.from('campeonato_vagas').update({
      status: 'reservada', reservada_por_token_id: convite.id, reservada_em: agora.toISOString(),
      reserva_expira_em: expiraEm, nome_equipe_reservada: nomeEquipe, nome_line_reservada: nomeLine,
    }).eq('id', vagaId).eq('status', 'livre').select('id').maybeSingle()
    if (vagaError || !atualizada) {
      await supabaseAdmin.from('tokens').delete().eq('id', convite.id)
      throw new Error('A vaga foi ocupada ou reservada por outra operação.')
    }

    return NextResponse.json({ convite, link: `${req.nextUrl.origin}/convite/equipe/${token}` }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar convite.' }, { status: 400 })
  }
}
