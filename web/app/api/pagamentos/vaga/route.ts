import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError, isAsaasConfigured } from '@backend/billing/asaas'
import {
  createVacancyPurchase,
  getVacancyPurchaseByToken,
  loadClaimContext,
} from '@backend/billing/vacancy-purchase'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * POST — inicia compra de vaga online (ASAAS link + PIX).
 * body: { campeonato_id, vendedor_manager_id?, cpf_cnpj? }
 *
 * GET  — status da compra
 *   ?token=VG...  ou  ?campeonato_id=... (última do usuário)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    if (!campeonatoId) throw new Error('campeonato_id obrigatório.')

    const email = String(user.email || account?.data?.email_contato || '').trim()
    const name = String(account?.name || user.user_metadata?.full_name || email).trim()
    if (!email) throw new Error('Sua conta precisa de e-mail para gerar o pagamento.')

    const { compra, payment, reused } = await createVacancyPurchase({
      campeonatoId,
      authUserId: user.id,
      payerName: name || 'Comprador',
      payerEmail: email,
      cpfCnpj: body.cpf_cnpj ? String(body.cpf_cnpj) : null,
      vendedorManagerId: body.vendedor_manager_id || null,
    })

    return NextResponse.json({
      reused: Boolean(reused),
      compra: {
        id: compra.id,
        token: compra.token,
        status: compra.status,
        valor_centavos: compra.valor_centavos,
        campeonato_id: compra.campeonato_id,
        grupo_id: compra.grupo_id,
      },
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            valor_centavos: payment.valor_centavos,
            invoice_url: payment.asaas_invoice_url,
            pix_qrcode: payment.asaas_pix_qrcode,
            pix_payload: payment.asaas_pix_payload,
            asaas_status: payment.asaas_status,
          }
        : null,
      claim_url: `/vagas/compra/${encodeURIComponent(compra.token)}`,
      asaas_configured: isAsaasConfigured(),
    })
  } catch (e: any) {
    if (e instanceof AsaasNotConfiguredError || e?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: e.message, asaas_configured: false }, { status: 503 })
    }
    return NextResponse.json({ error: e?.message || 'Erro ao criar pagamento da vaga.' }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const token = String(req.nextUrl.searchParams.get('token') || '').trim()
    const withContext = req.nextUrl.searchParams.get('context') === '1'
    const equipeId = req.nextUrl.searchParams.get('equipe_id')

    if (!token) {
      return NextResponse.json(
        { error: 'Informe token da compra.', asaas_configured: isAsaasConfigured() },
        { status: 400 },
      )
    }

    if (withContext) {
      const { data: ownership } = await supabaseAdmin
        .from('sistema_compras_vaga')
        .select('auth_user_id')
        .eq('token', token.toUpperCase())
        .maybeSingle()
      if (ownership && ownership.auth_user_id !== user.id) {
        throw new Error('Esta compra pertence a outra conta.')
      }

      const accounts = await getAccountsForUser(user)
      const ctx = await loadClaimContext({
        token,
        authUserId: user.id,
        accounts,
        equipeId,
      })
      return NextResponse.json(ctx)
    }

    const detail = await getVacancyPurchaseByToken(token)
    return NextResponse.json(detail)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao consultar compra.' }, { status: 400 })
  }
}
