import { NextRequest, NextResponse } from 'next/server'
import { getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError, isAsaasConfigured } from '@backend/billing/asaas'
import { createLiliPayPalOrder } from '@backend/billing/paypal'
import { createVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

function dbSetupError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  if (!['42P01', 'PGRST205'].includes(code)) return false
  return /commerce_carrinhos|commerce_carrinho_itens/i.test(message)
}

async function loadCartItem(userId: string, itemId: string) {
  const { data, error } = await supabaseAdmin
    .from('commerce_carrinho_itens')
    .select(`
      id,
      campeonato_id,
      quantidade,
      preco_unitario_centavos,
      vendedor_manager_id,
      meta,
      carrinho:commerce_carrinhos!inner(id,auth_user_id,status),
      campeonato:campeonatos(id,nome)
    `)
    .eq('id', itemId)
    .eq('carrinho.auth_user_id', userId)
    .eq('carrinho.status', 'ativo')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Item do carrinho nao encontrado.')
  return data as any
}

async function checkoutCartItem({
  itemId,
  user,
  account,
  method,
  cpfCnpj,
  origin,
}: {
  itemId: string
  user: any
  account: any
  method: 'pix' | 'cartao' | 'paypal'
  cpfCnpj: string | null
  origin: string
}) {
  const item = await loadCartItem(user.id, itemId)
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(item.quantidade || 1))))
  const email = String(user.email || account?.data?.email_contato || '').trim()
  const name = String(account?.name || user.user_metadata?.full_name || email).trim()
  if (!email) throw new Error('Sua conta precisa de e-mail para gerar o pagamento.')

  const { compra, payment, reused } = await createVacancyPurchase({
    campeonatoId: item.campeonato_id,
    authUserId: user.id,
    payerName: name || 'Comprador',
    payerEmail: email,
    cpfCnpj,
    vendedorManagerId: item.vendedor_manager_id || null,
    method,
    quantity,
    forceNew: true,
    flexibleCheckout: true,
  })

  const paypalPayment = method === 'paypal'
    ? await createLiliPayPalOrder({
        reservation: compra,
        campeonatoNome: String((Array.isArray(item.campeonato) ? item.campeonato[0]?.nome : item.campeonato?.nome) || compra.meta?.campeonato_nome || 'Campeonato'),
        amountMinor: Number(compra.valor_centavos || 0),
        currency: 'BRL',
        returnOrigin: origin,
        referenceType: 'sistema_compras_vaga',
        returnUrl: `${origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=approved&purchase_id=${encodeURIComponent(compra.id)}`,
        cancelUrl: `${origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=cancelled&purchase_id=${encodeURIComponent(compra.id)}`,
      })
    : null
  const resolvedPayment = paypalPayment || payment
  const claimUrl = `/vagas/compra/${encodeURIComponent(compra.token)}`
  const checkoutUrl = resolvedPayment?.paypal_approval_url || resolvedPayment?.asaas_invoice_url || claimUrl

  await supabaseAdmin
    .from('commerce_carrinho_itens')
    .update({
      meta: {
        ...(item.meta || {}),
        compra_vaga_id: compra.id,
        compra_token: compra.token,
        checkout_method: method,
        checked_out_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  return {
    reused: Boolean(reused),
    item_id: item.id,
    championship_name: String((Array.isArray(item.campeonato) ? item.campeonato[0]?.nome : item.campeonato?.nome) || 'Campeonato'),
    quantity,
    compra: {
      id: compra.id,
      token: compra.token,
      status: compra.status,
      valor_centavos: compra.valor_centavos,
      campeonato_id: compra.campeonato_id,
      grupo_id: compra.grupo_id,
      quantidade_vagas: Number(compra.meta?.quantidade_vagas || quantity),
      valor_unitario_centavos: Number(compra.meta?.valor_unitario_centavos || 0),
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
    claim_url: claimUrl,
    checkout_url: checkoutUrl,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const body = await req.json().catch(() => ({}))
    const itemIds = [...new Set([
      String(body.item_id || '').trim(),
      ...(Array.isArray(body.item_ids) ? body.item_ids.map((value: unknown) => String(value || '').trim()) : []),
    ].filter(Boolean))]
    const method = ['pix', 'cartao', 'paypal'].includes(String(body.method || 'pix'))
      ? String(body.method || 'pix') as 'pix' | 'cartao' | 'paypal'
      : 'pix'
    if (!itemIds.length) throw new Error('Item do carrinho obrigatorio.')

    const checkouts = []
    for (const itemId of itemIds) {
      checkouts.push(await checkoutCartItem({
        itemId,
        user,
        account,
        method,
        cpfCnpj: body.cpf_cnpj ? String(body.cpf_cnpj) : null,
        origin: req.nextUrl.origin,
      }))
    }
    if (checkouts.length === 1) return NextResponse.json({ ...checkouts[0], asaas_configured: isAsaasConfigured() })
    return NextResponse.json({
      checkouts,
      total_centavos: checkouts.reduce((sum, checkout) => sum + Number(checkout.compra.valor_centavos || 0), 0),
      asaas_configured: isAsaasConfigured(),
    })
  } catch (error: any) {
    if (error instanceof AsaasNotConfiguredError || error?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: 'Pagamento online indisponivel no momento.', asaas_configured: false }, { status: 503 })
    }
    if (dbSetupError(error)) {
      return NextResponse.json(
        { error: 'Estrutura de carrinho não encontrada no banco.', needs_migration: true },
        { status: 503 },
      )
    }
    return NextResponse.json(
      {
        error: error?.message || 'Erro ao gerar checkout do carrinho.',
        code: error?.code || null,
      },
      { status: 400 },
    )
  }
}
