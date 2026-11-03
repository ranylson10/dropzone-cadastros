import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { tryAtomicTeamInviteMutation, TeamInviteMutationError } from '@backend/campeonatos/invites/team-invite-mutation-transport'


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
  req: NextRequest,
  context: { params: Promise<{ id: string; tokenId: string }> },
) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)

    const atomic = await tryAtomicTeamInviteMutation({
      actorId: user.id, campeonatoId: id, tokenId, action: 'cancel',
      requestId: req.headers.get('Idempotency-Key'),
    })
    if (atomic) return NextResponse.json({ ok: true, repetida: atomic.repetida === true })

    const { data: convite } = await supabaseAdmin
      .from('tokens')
      .select('id, slot_id, usado, status, tipo')
      .eq('id', tokenId)
      .eq('campeonato_id', id)
      .single()
    if (!convite || convite.usado || convite.status !== 'ativo' || !['team_invite', 'convite_equipe_campeonato'].includes(convite.tipo)) throw new Error('Convite não pode ser cancelado.')

    // O trigger do banco é o proprietário do espelho do slot. Não forçar
    // "livre" via REST: pode existir outro convite ou reserva Lili ativa.
    const { data: cancelled, error: cancelError } = await supabaseAdmin.from('tokens')
      .update({ status: 'cancelado' }).eq('id', tokenId).eq('campeonato_id', id)
      .eq('status', 'ativo').eq('usado', false).select('id').maybeSingle()
    if (cancelError) throw cancelError
    if (!cancelled) throw new Error('Convite alterado por outra operação.')

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao cancelar convite.' },
      { status: error instanceof TeamInviteMutationError ? error.status : 400 },
    )
  }
}
