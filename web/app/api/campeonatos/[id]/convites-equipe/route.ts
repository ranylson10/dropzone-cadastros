import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url')
}

/**
 * Cria convite para o SLOT estrutural (campeonato_slots).
 * Body: slot_id | vaga_id (legado = id do slot), referencia_equipe, referencia_line
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await requireCampeonatoTokenPermission(user.id, id)
    const body = await req.json()
    // UI envia vaga_id com o id do slot; aceitamos slot_id explicitamente.
    const slotId = String(body.slot_id || body.vaga_id || '').trim()
    const referenciaEquipe = String(body.referencia_equipe || body.nome_equipe_reservada || '').trim()
    const referenciaLine = String(body.referencia_line || body.nome_line_reservada || '').trim()

    if (!slotId || !referenciaEquipe || !referenciaLine) {
      throw new Error('Informe o slot e as referências internas da reserva e da line.')
    }

    if (permission.role === 'seller') {
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,limite_vagas,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerError) throw sellerError
      if (!seller || seller.permissoes?.gerar_convites_equipe === false) {
        throw new Error('Este vendedor não pode gerar convites de equipe.')
      }
      const limiteVagas = Number(seller.limite_vagas || 0)
      if (limiteVagas > 0) {
        const [{ count: equipesCount, error: equipesCountError }, { count: convitesCount, error: convitesCountError }] =
          await Promise.all([
            supabaseAdmin
              .from('campeonato_equipes')
              .select('id', { count: 'exact', head: true })
              .eq('campeonato_id', id)
              .eq('criado_por', user.id)
              .in('origem_entrada', ['vendedor', 'convite', 'inscricao'])
              .eq('status', 'ativo'),
            supabaseAdmin
              .from('tokens')
              .select('id', { count: 'exact', head: true })
              .eq('campeonato_id', id)
              .eq('tipo', 'convite_equipe_campeonato')
              .eq('criado_por', user.id)
              .eq('status', 'ativo')
              .eq('usado', false),
          ])
        if (equipesCountError) throw equipesCountError
        if (convitesCountError) throw convitesCountError
        if (Number(equipesCount || 0) + Number(convitesCount || 0) >= limiteVagas) {
          throw new Error(`Este vendedor atingiu o limite de ${limiteVagas} vaga(s).`)
        }
      }
    }

    const { data: slot, error: slotError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
      .eq('id', slotId)
      .eq('campeonato_id', id)
      .maybeSingle()
    if (slotError) throw slotError
    if (!slot) throw new Error('Slot não encontrado neste campeonato.')
    if (slot.equipe_id || slot.line_id) throw new Error('Este slot já está ocupado por uma line.')

    // Já existe participação ativa neste lugar do grupo?
    const { data: partAtiva } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', id)
      .eq('grupo_id', slot.grupo_id)
      .eq('slot_numero', slot.slot_numero)
      .eq('status', 'ativo')
      .maybeSingle()
    if (partAtiva) throw new Error('Este slot já possui uma line inscrita. Escolha outro.')

    // Já há convite ativo não usado neste slot?
    const agora = new Date()
    const { data: conviteAtivo } = await supabaseAdmin
      .from('tokens')
      .select('id,expira_em')
      .eq('campeonato_id', id)
      .eq('tipo', 'convite_equipe_campeonato')
      .eq('status', 'ativo')
      .eq('usado', false)
      .eq('slot_id', slotId)
      .maybeSingle()
    if (conviteAtivo) {
      const aindaValido = !conviteAtivo.expira_em || new Date(conviteAtivo.expira_em).getTime() > agora.getTime()
      if (aindaValido) throw new Error('Já existe um convite ativo para este slot. Cancele ou renove o atual.')
      await supabaseAdmin.from('tokens').update({ status: 'expirado' }).eq('id', conviteAtivo.id)
    }

    const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const token = novoToken()

    const basePayload: Record<string, unknown> = {
      token,
      tipo: 'convite_equipe_campeonato',
      produtora_id: permission.produtoraId,
      campeonato_id: id,
      fase_id: slot.fase_id || null,
      grupo_id: slot.grupo_id,
      slot_id: slotId,
      nome_equipe_reservada: referenciaEquipe,
      nome_line_reservada: referenciaLine,
      criado_por: user.id,
      usado: false,
      expira_em: expiraEm,
      status: 'ativo',
    }

    let { data: convite, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .insert(basePayload)
      .select('*')
      .single()

    // Ambiente sem coluna slot_id ainda: tenta sem ela (grupo_id + metadados).
    if (tokenError && (tokenError.code === 'PGRST204' || /slot_id/i.test(tokenError.message || ''))) {
      const { slot_id: _s, ...fallback } = basePayload
      const retry = await supabaseAdmin.from('tokens').insert(fallback).select('*').single()
      convite = retry.data
      tokenError = retry.error
    }
    if (tokenError) throw tokenError

    return NextResponse.json(
      {
        convite,
        link: `${req.nextUrl.origin}/convite/equipe/${token}`,
        slot: {
          id: slot.id,
          letra: slot.slot_letra,
          numero: slot.slot_numero,
          grupo_id: slot.grupo_id,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar convite.' },
      { status: 400 },
    )
  }
}
