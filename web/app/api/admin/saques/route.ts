import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { creditWallet } from '@backend/billing/wallet'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const status = req.nextUrl.searchParams.get('status') || 'solicitado'
    const { data, error } = await supabaseAdmin
      .from('sistema_saques')
      .select('*, sistema_carteiras(dono_tipo,dono_id,auth_user_id)')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ saques: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 403 })
  }
}

/**
 * PATCH: aprovar/pagar/rejeitar saque.
 * rejeitado → devolve saldo à carteira
 * pago → só marca (débito já foi na solicitação)
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json()
    const id = String(body.id || '').trim()
    const status = String(body.status || '').trim()
    if (!id) throw new Error('id obrigatório')
    if (!['em_analise', 'aprovado', 'pago', 'rejeitado'].includes(status)) {
      throw new Error('status inválido')
    }

    const { data: saque, error } = await supabaseAdmin
      .from('sistema_saques')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!saque) throw new Error('Saque não encontrado.')

    if (status === 'rejeitado' && saque.status !== 'rejeitado' && saque.status !== 'pago') {
      // devolve saldo
      const carteira = await supabaseAdmin
        .from('sistema_carteiras')
        .select('dono_tipo,dono_id,auth_user_id')
        .eq('id', saque.carteira_id)
        .maybeSingle()
      if (carteira.data) {
        await creditWallet({
          donoTipo: carteira.data.dono_tipo,
          donoId: carteira.data.dono_id,
          authUserId: carteira.data.auth_user_id,
          valorCentavos: saque.valor_centavos,
          tipo: 'estorno',
          descricao: `Saque rejeitado: ${body.motivo || 'sem motivo'}`,
          referenciaTipo: 'saque',
          referenciaId: `${saque.id}:estorno`,
          criadoPor: admin.id,
        })
      }
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('sistema_saques')
      .update({
        status,
        rejeicao_motivo: status === 'rejeitado' ? String(body.motivo || '') : saque.rejeicao_motivo,
        analisado_por: admin.id,
        analisado_em: new Date().toISOString(),
        pago_em: status === 'pago' ? new Date().toISOString() : saque.pago_em,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()
    if (upErr) throw upErr

    await supabaseAdmin.from('sistema_auditoria').insert({
      administrador_auth_user_id: admin.id,
      acao: `saque_${status}`,
      alvo_tipo: 'saque',
      alvo_id: id,
      detalhes: { valor_centavos: saque.valor_centavos, motivo: body.motivo || null },
    })

    return NextResponse.json({ saque: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
