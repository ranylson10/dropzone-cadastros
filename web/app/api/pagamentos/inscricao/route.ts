import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { createInscriptionPayment } from '@backend/billing/payments'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * POST — gera link ASAAS para pagar inscrição da equipe no campeonato.
 * body: { campeonato_equipe_id, vendedor_manager_id? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json().catch(() => ({}))
    const ceId = String(body.campeonato_equipe_id || '').trim()
    if (!ceId) throw new Error('campeonato_equipe_id obrigatório.')

    const { data: part, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,nome_exibicao,origem_entrada,status')
      .eq('id', ceId)
      .maybeSingle()
    if (error) throw error
    if (!part) throw new Error('Participação não encontrada.')
    if (part.status !== 'ativo') throw new Error('Participação inativa.')

    // só dono da equipe / manager da equipe / organizador
    const email = String(user.email || account?.data?.email_contato || '').trim()
    const name = String(account?.name || user.user_metadata?.full_name || email).trim()

    const payment = await createInscriptionPayment({
      campeonatoId: part.campeonato_id,
      campeonatoEquipeId: part.id,
      authUserId: user.id,
      payerName: name || 'Equipe',
      payerEmail: email || `equipe-${part.equipe_id}@dropzone.local`,
      cpfCnpj: body.cpf_cnpj ? String(body.cpf_cnpj) : null,
      vendedorManagerId: body.vendedor_manager_id || null,
      vendedorAuthUserId: body.vendedor_auth_user_id || null,
    })

    return NextResponse.json({
      payment: {
        id: payment.id,
        status: payment.status,
        valor_centavos: payment.valor_centavos,
        invoice_url: payment.asaas_invoice_url,
        pix_payload: payment.asaas_pix_payload,
        asaas_status: payment.asaas_status,
      },
    })
  } catch (e: any) {
    if (e instanceof AsaasNotConfiguredError || e?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: e.message, asaas_configured: false }, { status: 503 })
    }
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

/** GET ?campeonato_equipe_id= — status do pagamento da inscrição */
export async function GET(req: NextRequest) {
  try {
    await getBearerUser(req)
    const ceId = String(req.nextUrl.searchParams.get('campeonato_equipe_id') || '').trim()
    if (!ceId) throw new Error('campeonato_equipe_id obrigatório.')

    const { data: pagamentos } = await supabaseAdmin
      .from('sistema_pagamentos')
      .select('id,status,valor_centavos,asaas_invoice_url,asaas_status,pago_em,created_at')
      .eq('referencia_tipo', 'campeonato_equipes')
      .eq('referencia_id', ceId)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: part } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id')
      .eq('id', ceId)
      .maybeSingle()

    let valorInscricao: number | null = null
    if (part?.campeonato_id) {
      const { data: cfg } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('valor_inscricao')
        .eq('campeonato_id', part.campeonato_id)
        .maybeSingle()
      valorInscricao = cfg?.valor_inscricao != null ? Number(cfg.valor_inscricao) : null
    }

    return NextResponse.json({
      valor_inscricao: valorInscricao,
      pagamentos: pagamentos || [],
      asaas_configured: Boolean(process.env.ASAAS_API_KEY),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
