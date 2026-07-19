import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { createChampionshipPackagePayment } from '@backend/billing/payments'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * GET — status da cobrança + último pagamento
 * POST — gera link ASAAS para pagar o pacote do campeonato
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (permission.role !== 'owner' && !permission.canManage) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const [{ data: cobranca }, { data: pagamentos }] = await Promise.all([
      supabaseAdmin.from('campeonato_cobranca').select('*').eq('campeonato_id', id).maybeSingle(),
      supabaseAdmin
        .from('sistema_pagamentos')
        .select('id,status,valor_centavos,asaas_invoice_url,asaas_status,pago_em,created_at,billing_type')
        .eq('referencia_tipo', 'campeonato_cobranca')
        .eq('referencia_id', id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return NextResponse.json({
      cobranca: cobranca || null,
      pagamentos: pagamentos || [],
      asaas_configured: Boolean(process.env.ASAAS_API_KEY),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (permission.role !== 'owner' && !permission.canManage) {
      return NextResponse.json({ error: 'Somente o organizador pode gerar o pagamento.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email || user.email || account?.data?.email_contato || '').trim()
    const name = String(body.nome || account?.name || user.user_metadata?.full_name || email).trim()
    const cpfCnpj = body.cpf_cnpj ? String(body.cpf_cnpj) : null

    if (!email) throw new Error('Informe o e-mail do pagador.')

    const payment = await createChampionshipPackagePayment({
      campeonatoId: id,
      authUserId: user.id,
      payerName: name,
      payerEmail: email,
      cpfCnpj,
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
      return NextResponse.json({
        error: e.message,
        asaas_configured: false,
      }, { status: 503 })
    }
    return NextResponse.json({ error: e?.message || 'Erro ao gerar pagamento.' }, { status: 400 })
  }
}
