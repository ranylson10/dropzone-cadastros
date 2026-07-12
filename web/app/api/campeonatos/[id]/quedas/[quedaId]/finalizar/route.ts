import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; quedaId: string }> }) {
  try {
    const { id, quedaId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)
    const { count, error: countError } = await supabaseAdmin.from('campeonato_resultados_equipes').select('id', { count: 'exact', head: true }).eq('campeonato_id', id).eq('partida_id', quedaId)
    if (countError) throw countError
    if (!count) throw new Error('Não é possível finalizar uma queda sem resultados de equipes.')
    const { data, error } = await supabaseAdmin.from('campeonato_partidas').update({ status: 'finalizada', finalizada_em: new Date().toISOString(), finalizada_por: user.id, updated_at: new Date().toISOString() }).eq('id', quedaId).eq('campeonato_id', id).neq('status', 'finalizada').select('*').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Queda não encontrada ou já finalizada.')
    return NextResponse.json({ ok: true, queda: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao finalizar queda.' }, { status: 400 })
  }
}
