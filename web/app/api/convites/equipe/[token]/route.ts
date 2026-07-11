import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getAccountByUserId } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function carregar(token: string) {
  const { data: convite } = await supabaseAdmin.from('tokens').select('*').eq('token', token).eq('tipo', 'convite_equipe_campeonato').maybeSingle()
  if (!convite) throw new Error('Convite não encontrado.')
  const [{ data: campeonato }, { data: vaga }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', convite.campeonato_id).single(),
    supabaseAdmin.from('campeonato_vagas').select('*').eq('id', convite.vaga_id).single(),
  ])
  return { convite, campeonato, vaga }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const data = await carregar(token)
    const expirado = !data.convite.expira_em || new Date(data.convite.expira_em).getTime() <= Date.now()
    return NextResponse.json({ ...data, valido: data.convite.status === 'ativo' && !data.convite.usado && !expirado && data.vaga.status === 'reservada' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Convite inválido.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const account = await getAccountByUserId(user.id)
    if (account.profile_type !== 'equipe') throw new Error('Entre com uma conta do tipo equipe para aceitar este convite.')
    const { convite, vaga } = await carregar(token)
    if (convite.status !== 'ativo' || convite.usado || !convite.expira_em || new Date(convite.expira_em).getTime() <= Date.now()) throw new Error('Este convite expirou ou já foi utilizado.')
    if (vaga.status !== 'reservada' || vaga.reservada_por_token_id !== convite.id) throw new Error('A vaga não está mais reservada para este convite.')
    if (convite.equipe_destino_id && convite.equipe_destino_id !== account.id) throw new Error('Este convite foi emitido para outra equipe.')

    let lineId = convite.line_destino_id as string | null
    if (!lineId) {
      const nome = String(convite.nome_line_reservada || '').trim()
      const { data: existente } = await supabaseAdmin.from('equipe_lines').select('id').eq('equipe_id', account.id).ilike('nome', nome).maybeSingle()
      if (existente) lineId = existente.id
      else {
        const { data: nova, error } = await supabaseAdmin.from('equipe_lines').insert({ equipe_id: account.id, nome, tag: account.data?.tag || null, logo_url: account.data?.logo_url || null }).select('id').single()
        if (error) throw error
        lineId = nova.id
      }
    }

    const { data: participacao, error: partError } = await supabaseAdmin.from('campeonato_equipes').insert({
      campeonato_id: convite.campeonato_id, equipe_id: account.id, vaga_id: vaga.id,
      line_id: lineId, nome_exibicao: convite.nome_line_reservada || account.name,
      origem_entrada: 'convite', criado_por: user.id, status: 'ativo',
    }).select('*').single()
    if (partError) throw partError

    await supabaseAdmin.from('campeonato_vagas').update({ status: 'ocupada', campeonato_equipe_id: participacao.id, ocupada_em: new Date().toISOString() }).eq('id', vaga.id).eq('reservada_por_token_id', convite.id)
    await supabaseAdmin.from('tokens').update({ usado: true, usado_em: new Date().toISOString(), status: 'usado', equipe_id: account.id, line_destino_id: lineId }).eq('id', convite.id)
    return NextResponse.json({ ok: true, participacao })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
