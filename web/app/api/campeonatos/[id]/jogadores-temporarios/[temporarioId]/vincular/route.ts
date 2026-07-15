import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoScore } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; temporarioId: string }> }) {
  try {
    const { id, temporarioId } = await context.params
    const user = await getBearerUser(req)
    const permission = await requireCampeonatoScore(user.id, id)
    const body = await req.json()
    if (!body?.jogador_id) throw new Error('Informe o jogador oficial.')
    const { data: temp } = await supabaseAdmin.from('jogadores_temporarios').select('produtora_id').eq('id', temporarioId).maybeSingle()
    if (!temp || temp.produtora_id !== permission.produtoraId) throw new Error('Jogador temporário não pertence à produtora do campeonato.')
    const { data, error } = await supabaseAdmin.rpc('fn_vincular_jogador_temporario', {
      p_jogador_temporario_id: temporarioId,
      p_jogador_real_id: body.jogador_id,
      p_vinculado_por: user.id,
    })
    if (error) throw error
    return NextResponse.json({ ok: true, resultado: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao vincular jogador.' }, { status: 400 })
  }
}
