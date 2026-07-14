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
    const referenciaEquipe = String(body.referencia_equipe || body.nome_equipe_reservada || '').trim()
    const referenciaLine = String(body.referencia_line || body.nome_line_reservada || '').trim()

    if (!vagaId || !referenciaEquipe || !referenciaLine) {
      throw new Error('Informe a vaga e as referências internas da reserva e da line.')
    }

    if (permission.role === 'seller') {
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,limite_vagas,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerError) throw sellerError
      if (!seller || seller.permissoes?.gerar_convites_equipe === false) throw new Error('Este vendedor não pode gerar convites de equipe.')
      const limiteVagas = Number(seller.limite_vagas || 0)
      if (limiteVagas > 0) {
        const [{ count: equipesCount, error: equipesCountError }, { count: convitesCount, error: convitesCountError }] = await Promise.all([
          supabaseAdmin.from('campeonato_equipes').select('id', { count: 'exact', head: true }).eq('campeonato_id', id).eq('criado_por', user.id).eq('origem_entrada', 'vendedor').eq('status', 'ativo'),
          supabaseAdmin.from('tokens').select('id', { count: 'exact', head: true }).eq('campeonato_id', id).eq('tipo', 'convite_equipe_campeonato').eq('criado_por', user.id).eq('status', 'ativo').eq('usado', false),
        ])
        if (equipesCountError) throw equipesCountError
        if (convitesCountError) throw convitesCountError
        if (Number(equipesCount || 0) + Number(convitesCount || 0) >= limiteVagas) throw new Error(`Este vendedor atingiu o limite de ${limiteVagas} vaga(s).`)
      }
    }

    const { data: vaga } = await supabaseAdmin
      .from('campeonato_vagas')
      .select('*')
      .eq('id', vagaId)
      .eq('campeonato_id', id)
      .single()

    if (!vaga || vaga.status !== 'livre') throw new Error('Esta vaga não está mais livre.')

    const agora = new Date()
    const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const token = novoToken()

    const { data: convite, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .insert({
        token,
        tipo: 'convite_equipe_campeonato',
        produtora_id: permission.produtoraId,
        campeonato_id: id,
        vaga_id: vagaId,
        equipe_destino_id: null,
        line_destino_id: null,
        // Estes campos são referências administrativas, não nomes obrigatórios do cadastro real.
        nome_equipe_reservada: referenciaEquipe,
        nome_line_reservada: referenciaLine,
        criado_por: user.id,
        usado: false,
        expira_em: expiraEm,
        status: 'ativo',
      })
      .select('*')
      .single()

    if (tokenError) throw tokenError

    const { data: atualizada, error: vagaError } = await supabaseAdmin
      .from('campeonato_vagas')
      .update({
        status: 'reservada',
        reservada_por_token_id: convite.id,
        reservada_em: agora.toISOString(),
        reserva_expira_em: expiraEm,
        nome_equipe_reservada: referenciaEquipe,
        nome_line_reservada: referenciaLine,
      })
      .eq('id', vagaId)
      .eq('status', 'livre')
      .select('id')
      .maybeSingle()

    if (vagaError || !atualizada) {
      await supabaseAdmin.from('tokens').delete().eq('id', convite.id)
      throw new Error('A vaga foi ocupada ou reservada por outra operação.')
    }

    return NextResponse.json(
      { convite, link: `${req.nextUrl.origin}/convite/equipe/${token}` },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar convite.' },
      { status: 400 },
    )
  }
}
