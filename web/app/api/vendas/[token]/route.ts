import { NextRequest, NextResponse } from 'next/server'
import { getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { resolveBillingProfile } from '@backend/billing/billing-profile'
import { isAsaasConfigured } from '@backend/billing/asaas'
import { createLiliPayPalOrder } from '@backend/billing/paypal'
import { createVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const methods = new Set(['pix', 'cartao', 'paypal'])

async function loadSale(token: string) {
  const { data, error } = await supabaseAdmin
    .from('sistema_vendas_assistidas')
    .select('*,campeonato:campeonatos(id,nome,logo_url,status,aprovacao_status,produtora_id),vendedor:managers!sistema_vendas_assistidas_vendedor_manager_id_fkey(id,nome,nome_publico_vendas,avatar_url)')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Link de venda não encontrado.')
  if (['cancelada', 'expirada'].includes(String(data.status))) throw new Error('Este link de venda não está mais disponível.')
  if (new Date(data.expira_em).getTime() <= Date.now()) {
    await supabaseAdmin.from('sistema_vendas_assistidas').update({ status: 'expirada', updated_at: new Date().toISOString() }).eq('id', data.id)
    throw new Error('Este link de venda expirou.')
  }
  if (data.campeonato?.status !== 'ativo' || data.campeonato?.aprovacao_status !== 'aprovado') {
    throw new Error('Este campeonato não está disponível para venda.')
  }
  return data as any
}

function publicSale(sale: any) {
  return {
    token: sale.token,
    status: sale.status,
    quantity: sale.quantidade_vagas,
    channel: sale.canal,
    reference: sale.referencia || null,
    expires_at: sale.expira_em,
    championship: sale.campeonato ? { id: sale.campeonato.id, name: sale.campeonato.nome, logo_url: sale.campeonato.logo_url } : null,
    seller: sale.vendedor ? { name: sale.vendedor.nome_publico_vendas || sale.vendedor.nome || 'Afiliado', avatar_url: sale.vendedor.avatar_url || null } : null,
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const sale = await loadSale(String(token || '').trim().toUpperCase())
    return NextResponse.json({ sale: publicSale(sale) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível abrir a venda.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getBearerUser(req)
    const account = await getActiveAccount(req, user)
    const { token } = await context.params
    const sale = await loadSale(String(token || '').trim().toUpperCase())
    if (sale.comprador_auth_user_id && sale.comprador_auth_user_id !== user.id) {
      throw new Error('Este checkout já foi iniciado por outra conta.')
    }
    if (sale.compra_vaga_id) {
      const { data: existing } = await supabaseAdmin.from('sistema_compras_vaga').select('id,token,status,pagamento_id').eq('id', sale.compra_vaga_id).maybeSingle()
      if (existing && ['pendente', 'pago', 'liberado', 'consumido'].includes(String(existing.status))) {
        return NextResponse.json({ checkout_url: `/vagas/compra/${existing.token}`, claim_url: `/vagas/compra/${existing.token}`, reused: true })
      }
    }

    const body = await req.json().catch(() => ({}))
    const method = methods.has(String(body.method || 'pix')) ? String(body.method || 'pix') as 'pix' | 'cartao' | 'paypal' : 'pix'
    const email = String(user.email || account?.data?.email_contato || '').trim()
    if (!email) throw new Error('Sua conta precisa de e-mail para gerar o pagamento.')
    const fallbackName = String(account?.name || user.user_metadata?.full_name || email).trim()
    const billing = method === 'paypal' ? null : await resolveBillingProfile({
      userId: user.id,
      fallbackName,
      document: body.billing_profile?.document || null,
      holderName: body.billing_profile?.name || null,
    })
    const { compra, payment } = await createVacancyPurchase({
      campeonatoId: sale.campeonato_id,
      authUserId: user.id,
      payerName: billing?.name || fallbackName,
      payerEmail: email,
      cpfCnpj: billing?.document || null,
      vendedorManagerId: sale.vendedor_manager_id,
      method,
      quantity: Number(sale.quantidade_vagas || 1),
      forceNew: true,
    })
    const paypalPayment = method === 'paypal' ? await createLiliPayPalOrder({
      reservation: compra,
      campeonatoNome: String(sale.campeonato?.nome || 'Campeonato'),
      amountMinor: Number(compra.valor_centavos || 0),
      currency: 'BRL',
      returnOrigin: req.nextUrl.origin,
      referenceType: 'sistema_compras_vaga',
      returnUrl: `${req.nextUrl.origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=approved&purchase_id=${encodeURIComponent(compra.id)}`,
      cancelUrl: `${req.nextUrl.origin}/vagas/compra/${encodeURIComponent(compra.token)}?paypal=cancelled&purchase_id=${encodeURIComponent(compra.id)}`,
    }) : null
    const resolved = paypalPayment || payment
    const claimUrl = `/vagas/compra/${encodeURIComponent(compra.token)}`
    const checkoutUrl = method === 'pix' ? claimUrl : resolved?.paypal_approval_url || resolved?.asaas_invoice_url || claimUrl

    await supabaseAdmin.from('sistema_vendas_assistidas').update({
      status: 'checkout_iniciado', comprador_auth_user_id: user.id, compra_vaga_id: compra.id,
      meta: { ...(sale.meta || {}), checkout_iniciado_em: new Date().toISOString(), metodo: method }, updated_at: new Date().toISOString(),
    }).eq('id', sale.id)
    return NextResponse.json({ checkout_url: checkoutUrl, claim_url: claimUrl, billing_profile: billing?.public || null, asaas_configured: isAsaasConfigured() })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível iniciar o checkout.' }, { status: 400 })
  }
}
