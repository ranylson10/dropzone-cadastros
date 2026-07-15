import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; tokenId: string }> },
) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)

    const { data: antigo } = await supabaseAdmin
      .from('tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('campeonato_id', id)
      .single()
    if (!antigo || antigo.usado) throw new Error('Convite inválido para renovação.')
    if (!antigo.slot_id && !antigo.grupo_id) {
      throw new Error('Convite sem slot/grupo para renovar.')
    }

    if (antigo.slot_id) {
      const { data: slot } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,equipe_id,line_id')
        .eq('id', antigo.slot_id)
        .maybeSingle()
      if (!slot) throw new Error('Slot do convite não existe mais.')
      if (slot.equipe_id || slot.line_id) throw new Error('O slot já está ocupado. Não é possível renovar.')
    }

    await supabaseAdmin.from('tokens').update({ status: 'cancelado' }).eq('id', tokenId)

    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const token = randomBytes(18).toString('base64url')

    const payload: Record<string, unknown> = {
      token,
      tipo: antigo.tipo,
      produtora_id: antigo.produtora_id,
      campeonato_id: id,
      fase_id: antigo.fase_id || null,
      grupo_id: antigo.grupo_id || null,
      slot_id: antigo.slot_id || null,
      equipe_destino_id: antigo.equipe_destino_id,
      line_destino_id: antigo.line_destino_id,
      nome_equipe_reservada: antigo.nome_equipe_reservada,
      nome_line_reservada: antigo.nome_line_reservada,
      criado_por: user.id,
      usado: false,
      expira_em: expiraEm,
      status: 'ativo',
    }

    const { data: novo, error } = await supabaseAdmin.from('tokens').insert(payload).select('*').single()
    if (error) throw error

    if (antigo.slot_id) {
      await supabaseAdmin
        .from('campeonato_slots')
        .update({ status: 'reservado', updated_at: new Date().toISOString() })
        .eq('id', antigo.slot_id)
        .is('line_id', null)
    }

    return NextResponse.json({
      convite: novo,
      link: `${req.nextUrl.origin}/convite/equipe/${token}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao renovar convite.' },
      { status: 400 },
    )
  }
}
