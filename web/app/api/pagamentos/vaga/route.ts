import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError, isAsaasConfigured } from '@backend/billing/asaas'
import {
  createVacancyPurchase,
  getVacancyPurchaseByToken,
  loadClaimContext,
} from '@backend/billing/vacancy-purchase'
import { createLiliPayPalOrder } from '@backend/billing/paypal'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { resolveBillingProfile } from '@backend/billing/billing-profile'

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
    const method = ['pix', 'cartao', 'paypal'].includes(String(body.method || 'pix'))
      ? String(body.method || 'pix') as 'pix' | 'cartao' | 'paypal'
      : 'pix'
    if (!campeonatoId) throw new Error('campeonato_id obrigatório.')

    const email = String(user.email || account?.data?.email_contato || '').trim()
    const name = String(account?.name || user.user_metadata?.full_name || email).trim()
    if (!email) throw new Error('Sua conta precisa de e-mail para gerar o pagamento.')
    const billing = method === 'paypal'
      ? null
      : await resolveBillingProfile({
          userId: user.id,
          fallbackName: name || 'Comprador',
          document: body.billing_profile?.document || body.cpf_cnpj || null,
          holderName: body.billing_profile?.name || null,
        })

    const { compra, payment, reused } = await createVacancyPurchase({
      campeonatoId,
      authUserId: user.id,
      payerName: billing?.name || name || 'Comprador',
      payerEmail: email,
      cpfCnpj: billing?.document || null,
      vendedorManagerId: body.vendedor_manager_id || null,
      method,
    })
    const paypalPayment = method === 'paypal'
      ? await createLiliPayPalOrder({
          reservation: compra,
          campeonatoNome: String(compra.meta?.campeonato_nome || 'Campeonato'),
          amountMinor: Number(compra.valor_centavos || 0),
          currency: 'BRL',
          returnOrigin: req.nextUrl.origin,
          referenceType: 'sistema_compras_vaga',
          returnUrl: `${req.nextUrl.origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=approved&purchase_id=${encodeURIComponent(compra.id)}`,
          cancelUrl: `${req.nextUrl.origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=cancelled&purchase_id=${encodeURIComponent(compra.id)}`,
        })
      : null
    const resolvedPayment = paypalPayment || payment

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
      payment: resolvedPayment
        ? {
            id: resolvedPayment.id,
            status: resolvedPayment.status,
            valor_centavos: resolvedPayment.valor_centavos,
            invoice_url: resolvedPayment.asaas_invoice_url || null,
            pix_qrcode: resolvedPayment.asaas_pix_qrcode || null,
            pix_payload: resolvedPayment.asaas_pix_payload || null,
            asaas_status: resolvedPayment.asaas_status || null,
            provider: resolvedPayment.provider || (method === 'paypal' ? 'paypal' : 'asaas'),
            metodo: method,
            billing_type: resolvedPayment.billing_type || null,
            paypal_order_id: resolvedPayment.paypal_order_id || null,
            paypal_approval_url: resolvedPayment.paypal_approval_url || null,
          }
        : null,
      claim_url: `/vagas/compra/${encodeURIComponent(compra.token)}`,
      asaas_configured: isAsaasConfigured(),
    })
  } catch (e: any) {
    if (e instanceof AsaasNotConfiguredError || e?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: 'Pagamento online indisponível no momento.', asaas_configured: false }, { status: 503 })
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

    const { data: ownership, error: ownershipError } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .select('auth_user_id,status,meta')
      .eq('token', token.toUpperCase())
      .maybeSingle()
    if (ownershipError) throw ownershipError
    if (!ownership) throw new Error('Compra não encontrada.')
    const assistedSale = Boolean((ownership.meta as any)?.venda_assistida)
    const assistedReleased = assistedSale && ['pago', 'liberado', 'consumido'].includes(String(ownership.status || ''))
    if (ownership.auth_user_id !== user.id && !assistedReleased) {
      throw new Error('Esta compra pertence a outra conta.')
    }

    if (withContext) {
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
