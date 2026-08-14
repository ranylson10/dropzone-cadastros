import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { sincronizarEstatisticasGarenaDaImportacao } from '@backend/campeonatos/estatisticas/garena-matchstats.service'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoScore(user.id, id)
    const body = await req.json().catch(() => ({}))
    let importacaoId = String(body.importacao_id || '').trim()

    if (!importacaoId) {
      const partidaId = String(body.partida_id || '').trim()
      if (!partidaId) throw new Error('Selecione uma queda para sincronizar.')
      const { data, error } = await supabaseAdmin
        .from('matchresult_importacoes')
        .select('id')
        .eq('campeonato_id', id)
        .eq('partida_id', partidaId)
        .eq('status', 'confirmada')
        .order('confirmado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data?.id) throw new Error('Não há MatchResult confirmado nesta queda para sincronizar.')
      importacaoId = data.id
    }

    const resultado = await sincronizarEstatisticasGarenaDaImportacao(importacaoId, user.id)
    if (resultado.status === 'falhou') {
      return NextResponse.json({ ok: false, ...resultado }, { status: 422 })
    }
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível sincronizar os dados detalhados.' }, { status: 400 })
  }
}
