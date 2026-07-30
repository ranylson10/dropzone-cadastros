import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; tokenId: string }> },
) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)

    const body = await req.json()
    const referenciaEquipe = String(body.referencia_equipe ?? body.nome_equipe_reservada ?? '').trim()
    const referenciaLine = String(body.referencia_line ?? body.nome_line_reservada ?? '').trim()

    if (!referenciaEquipe || !referenciaLine) {
      throw new Error('Informe as referências da reserva e da line.')
    }

    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('tokens')
      .select('id,usado,status')
      .eq('id', tokenId)
      .eq('campeonato_id', id)
      .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
      .maybeSingle()
    if (conviteError) throw conviteError
    if (!convite) throw new Error('Convite não encontrado neste campeonato.')
    if (convite.usado || convite.status !== 'ativo') {
      throw new Error('Somente convites ativos e ainda não utilizados podem ser editados.')
    }

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from('tokens')
      .update({
        nome_equipe_reservada: referenciaEquipe,
        nome_line_reservada: referenciaLine,
      })
      .eq('id', tokenId)
      .eq('campeonato_id', id)
      .eq('status', 'ativo')
      .eq('usado', false)
      .select('*')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ convite: atualizado })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao editar convite.' },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; tokenId: string }> },
) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(_req)
    await requireCampeonatoTokenPermission(user.id, id)

    const { data: convite } = await supabaseAdmin
      .from('tokens')
      .select('id, slot_id, usado, status')
      .eq('id', tokenId)
      .eq('campeonato_id', id)
      .single()
    if (!convite || convite.usado) throw new Error('Convite não pode ser cancelado.')

    await supabaseAdmin.from('tokens').update({ status: 'cancelado' }).eq('id', tokenId)

    if (convite.slot_id) {
      await supabaseAdmin
        .from('campeonato_slots')
        .update({ status: 'livre', updated_at: new Date().toISOString() })
        .eq('id', convite.slot_id)
        .eq('status', 'reservado')
        .is('line_id', null)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao cancelar convite.' },
      { status: 400 },
    )
  }
}
