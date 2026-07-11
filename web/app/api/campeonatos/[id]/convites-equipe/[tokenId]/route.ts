import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; tokenId: string }> }) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)
    const { data: convite } = await supabaseAdmin.from('tokens').select('id, vaga_id, usado').eq('id', tokenId).eq('campeonato_id', id).single()
    if (!convite || convite.usado) throw new Error('Convite não pode ser cancelado.')
    await supabaseAdmin.from('tokens').update({ status: 'cancelado' }).eq('id', tokenId)
    if (convite.vaga_id) {
      await supabaseAdmin.from('campeonato_vagas').update({
        status: 'livre', reservada_por_token_id: null, reservada_em: null,
        reserva_expira_em: null, nome_equipe_reservada: null, nome_line_reservada: null,
      }).eq('id', convite.vaga_id).eq('reservada_por_token_id', tokenId)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao cancelar convite.' }, { status: 400 })
  }
}
