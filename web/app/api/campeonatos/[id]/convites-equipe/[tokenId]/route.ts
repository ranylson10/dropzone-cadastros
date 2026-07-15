import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

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
