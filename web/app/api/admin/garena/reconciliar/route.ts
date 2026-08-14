import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { sincronizarEstatisticasGarenaDaImportacao } from '@backend/campeonatos/estatisticas/garena-matchstats.service'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Reprocessa somente MatchResults antigos que foram confirmados antes da
 * sincronização automática da Garena. É protegido por administrador e não
 * toca na pontuação oficial, apenas grava os detalhes complementares.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json().catch(() => ({}))
    const requestedIds = Array.isArray(body?.matchresult_importacao_ids)
      ? body.matchresult_importacao_ids.map(String).filter(Boolean).slice(0, 100)
      : []

    let query = supabaseAdmin
      .from('matchresult_importacoes')
      .select('id,status')
      .eq('status', 'confirmada')
      .order('confirmado_em', { ascending: false })
      .limit(100)
    if (requestedIds.length) query = query.in('id', requestedIds)
    const { data: matchresults, error } = await query
    if (error) throw error

    const ids = (matchresults || []).map((row: any) => String(row.id))
    if (!ids.length) return NextResponse.json({ ok: true, processados: 0, resultados: [] })

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('garena_matchstats_importacoes')
      .select('matchresult_importacao_id,status')
      .in('matchresult_importacao_id', ids)
    if (existingError) throw existingError
    const existingByMatchresult = new Map((existing || []).map((row: any) => [String(row.matchresult_importacao_id), String(row.status)]))
    const pending = ids.filter((id) => !existingByMatchresult.has(id) || existingByMatchresult.get(id) === 'falhou')

    const resultados = [] as Array<{ id: string; status: string; jogadores?: number; erro?: string }>
    for (const id of pending) {
      const result = await sincronizarEstatisticasGarenaDaImportacao(id, admin.id)
      resultados.push({ id, ...result })
    }
    return NextResponse.json({ ok: true, processados: resultados.length, ignorados: ids.length - resultados.length, resultados })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível reconciliar as estatísticas da Garena.' }, { status: 400 })
  }
}
