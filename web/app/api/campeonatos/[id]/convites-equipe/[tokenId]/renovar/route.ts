import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; tokenId: string }> }) {
  try {
    const { id, tokenId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)
    const { data: antigo } = await supabaseAdmin.from('tokens').select('*').eq('id', tokenId).eq('campeonato_id', id).single()
    if (!antigo?.vaga_id || antigo.usado) throw new Error('Convite inválido para renovação.')

    await supabaseAdmin.from('tokens').update({ status: 'cancelado' }).eq('id', tokenId)
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const token = randomBytes(18).toString('base64url')
    const { data: novo, error } = await supabaseAdmin.from('tokens').insert({
      token, tipo: antigo.tipo, produtora_id: antigo.produtora_id, campeonato_id: id,
      vaga_id: antigo.vaga_id, equipe_destino_id: antigo.equipe_destino_id,
      line_destino_id: antigo.line_destino_id, nome_equipe_reservada: antigo.nome_equipe_reservada,
      nome_line_reservada: antigo.nome_line_reservada, criado_por: user.id,
      usado: false, expira_em: expiraEm, status: 'ativo',
    }).select('*').single()
    if (error) throw error
    await supabaseAdmin.from('campeonato_vagas').update({ reservada_por_token_id: novo.id, reservada_em: new Date().toISOString(), reserva_expira_em: expiraEm }).eq('id', antigo.vaga_id)
    return NextResponse.json({ convite: novo, link: `${req.nextUrl.origin}/convite/equipe/${token}` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao renovar convite.' }, { status: 400 })
  }
}
