import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { DEFAULT_PUBLIC_STATS_DELAY_SECONDS } from '@backend/campeonatos/estatisticas/publicacao.service'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json().catch(() => ({}))
    const delay = Number(body?.estatisticas_delay_segundos)
    if (!Number.isInteger(delay) || delay < 0 || delay > 7200) {
      return NextResponse.json({ error: 'O atraso deve ficar entre 0 e 120 minutos.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_configuracoes')
      .upsert({
        campeonato_id: id,
        estatisticas_delay_segundos: delay,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'campeonato_id' })
      .select('estatisticas_delay_segundos')
      .single()
    if (error) throw error
    return NextResponse.json({
      estatisticas_delay_segundos: Number(data?.estatisticas_delay_segundos ?? DEFAULT_PUBLIC_STATS_DELAY_SECONDS),
      overlays: 'imediato',
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao salvar atraso publico.',
    }, { status: 400 })
  }
}
