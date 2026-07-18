import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/** Reabre queda finalizada para edição (status → em_andamento). */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; quedaId: string }> },
) {
  try {
    const { id, quedaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)

    const { data: partida, error: readError } = await supabaseAdmin
      .from('campeonato_partidas')
      .select('id,status,jogo_id,campeonato_id')
      .eq('id', quedaId)
      .eq('campeonato_id', id)
      .maybeSingle()
    if (readError) throw readError
    if (!partida) throw new Error('Queda não encontrada.')

    // limpa outras em_andamento do mesmo jogo
    if (partida.jogo_id) {
      await supabaseAdmin
        .from('campeonato_partidas')
        .update({ status: 'agendada' })
        .eq('jogo_id', partida.jogo_id)
        .eq('status', 'em_andamento')
        .neq('id', quedaId)
    }

    const patch: Record<string, unknown> = {
      status: 'em_andamento',
    }
    // limpa campos de finalização se existirem
    patch.finalizada_em = null
    patch.finalizada_por = null

    let { data, error } = await supabaseAdmin
      .from('campeonato_partidas')
      .update(patch)
      .eq('id', quedaId)
      .eq('campeonato_id', id)
      .select('*')
      .maybeSingle()

    if (error && /finalizada_em|finalizada_por|column/i.test(error.message || '')) {
      const retry = await supabaseAdmin
        .from('campeonato_partidas')
        .update({ status: 'em_andamento' })
        .eq('id', quedaId)
        .eq('campeonato_id', id)
        .select('*')
        .maybeSingle()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    if (!data) throw new Error('Não foi possível reabrir a queda.')

    return NextResponse.json({ ok: true, queda: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reabrir queda.' },
      { status: 400 },
    )
  }
}
