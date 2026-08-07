import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { createVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { isAsaasConfigured } from '@backend/billing/asaas'
import { createLiliPayPalOrder, paypalConfigured } from '@backend/billing/paypal'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function absolutize(req: NextRequest, path: string) {
  return new URL(path, req.nextUrl.origin).toString()
}

async function requireOwnManager(managerId: string, authUserId: string) {
  const { data: manager, error } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,auth_user_id,email_contato,status')
    .eq('id', managerId)
    .maybeSingle()
  if (error) throw error
  if (!manager || manager.auth_user_id !== authUserId) {
    throw new Error('Vendedor nÃ£o encontrado para esta conta.')
  }
  if (['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) {
    throw new Error('Este vendedor nÃ£o pode gerar vendas agora.')
  }
  return manager
}

async function requireSellerPermission(managerId: string, campeonatoId: string) {
  const { data: seller, error } = await supabaseAdmin
    .from('campeonato_vendedores')
    .select('id,campeonato_id,manager_id,status,permissoes,limite_vagas')
    .eq('manager_id', managerId)
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) throw error
  if (!seller) throw new Error('Este campeonato nÃ£o estÃ¡ liberado para este vendedor.')
  const permissions = (seller.permissoes || {}) as Record<string, any>
  if (permissions.vender_vagas === false || permissions.gerar_pagamentos === false) {
    throw new Error('Este vendedor nÃ£o tem permissÃ£o para gerar cobranÃ§as deste campeonato.')
  }
  return seller
}

export async function GET(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { managerId } = await context.params
    await requireOwnManager(managerId, user.id)

    const { data: purchases, error } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .select('id,token,campeonato_id,grupo_id,status,valor_centavos,expira_em,pago_em,liberado_em,consumido_em,created_at,updated_at,meta,pagamento_id')
      .eq('vendedor_manager_id', managerId)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) throw error

    const championshipIds = [...new Set((purchases || []).map((row: any) => row.campeonato_id).filter(Boolean))]
    const paymentIds = [...new Set((purchases || []).map((row: any) => row.pagamento_id).filter(Boolean))]
    const groupIds = [...new Set((purchases || []).map((row: any) => row.grupo_id).filter(Boolean))]

    const [championshipsResult, paymentsResult, groupsResult] = await Promise.all([
      championshipIds.length
        ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url').in('id', championshipIds)
        : Promise.resolve({ data: [], error: null } as any),
      paymentIds.length
        ? supabaseAdmin.from('sistema_pagamentos').select('id,status,metodo,provider,billing_type,asaas_status,asaas_invoice_url,paypal_approval_url,pago_em,valor_centavos').in('id', paymentIds)
        : Promise.resolve({ data: [], error: null } as any),
      groupIds.length
        ? supabaseAdmin.from('campeonato_grupos').select('id,nome').in('id', groupIds)
        : Promise.resolve({ data: [], error: null } as any),
    ])
    if (championshipsResult.error) throw championshipsResult.error
    if (paymentsResult.error) throw paymentsResult.error
    if (groupsResult.error) throw groupsResult.error

    const championships = new Map((championshipsResult.data || []).map((row: any) => [row.id, row]))
    const payments = new Map((paymentsResult.data || []).map((row: any) => [row.id, row]))
    const groups = new Map((groupsResult.data || []).map((row: any) => [row.id, row]))

    const sales = (purchases || []).map((purchase: any) => {
      const payment: any = purchase.pagamento_id ? payments.get(purchase.pagamento_id) : null
      const claimPath = `/vagas/compra/${encodeURIComponent(purchase.token)}`
      return {
        id: purchase.id,
        token: purchase.token,
        status: purchase.status,
        valor_centavos: purchase.valor_centavos,
        created_at: purchase.created_at,
        expira_em: purchase.expira_em,
        pago_em: purchase.pago_em || payment?.pago_em || null,
        liberado_em: purchase.liberado_em,
        consumido_em: purchase.consumido_em,
        comprador_nome: purchase.meta?.comprador_nome || null,
        comprador_whatsapp: purchase.meta?.comprador_whatsapp || null,
        campeonato: championships.get(purchase.campeonato_id) || null,
        grupo: groups.get(purchase.grupo_id) || null,
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              metodo: payment.metodo,
              provider: payment.provider,
              billing_type: payment.billing_type,
              asaas_status: payment.asaas_status,
              invoice_url: payment.asaas_invoice_url,
              paypal_approval_url: payment.paypal_approval_url,
              valor_centavos: payment.valor_centavos,
            }
          : null,
        claim_url: absolutize(req, claimPath),
        payment_url: payment?.paypal_approval_url || payment?.asaas_invoice_url || absolutize(req, claimPath),
      }
    })

    return NextResponse.json({ sales, asaas_configured: isAsaasConfigured(), paypal_configured: paypalConfigured() })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar vendas.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { managerId } = await context.params
    const manager = await requireOwnManager(managerId, user.id)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    if (!campeonatoId) throw new Error('campeonato_id obrigatÃ³rio.')
    await requireSellerPermission(managerId, campeonatoId)

    const method = ['pix', 'cartao', 'paypal'].includes(String(body.method || 'pix'))
      ? String(body.method || 'pix') as 'pix' | 'cartao' | 'paypal'
      : 'pix'
    const cpfCnpj = String(body.cpf_cnpj || '').replace(/\D/g, '')
    if (method !== 'paypal' && !cpfCnpj) throw new Error('Informe o CPF/CNPJ do comprador para gerar cobrança online.')

    const buyerName = String(body.comprador_nome || '').trim()
    const buyerEmail = String(body.comprador_email || '').trim()
    const buyerWhatsapp = String(body.comprador_whatsapp || '').trim()
    const payerEmail = buyerEmail || String(user.email || manager.email_contato || '').trim()
    if (!payerEmail) throw new Error('Informe um e-mail do comprador ou cadastre e-mail no vendedor.')

    const { compra, payment, reused } = await createVacancyPurchase({
      campeonatoId,
      authUserId: user.id,
      payerName: buyerName || manager.nome || manager.username || 'Comprador',
      payerEmail,
      cpfCnpj,
      vendedorManagerId: managerId,
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

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const assistedMeta = {
      ...(compra.meta || {}),
      venda_assistida: true,
      venda_assistida_status: 'aguardando_pagamento',
      venda_assistida_gerada_em: now,
      vendedor_manager_id: managerId,
      vendedor_auth_user_id: user.id,
      comprador_nome: buyerName || null,
      comprador_email: buyerEmail || null,
      comprador_whatsapp: buyerWhatsapp || null,
      checkout_publico: true,
    }
    const { data: updated } = await supabaseAdmin
      .from('sistema_compras_vaga')
      .update({ meta: assistedMeta, expira_em: expiresAt, updated_at: now })
      .eq('id', compra.id)
      .select('*')
      .maybeSingle()

    const finalCompra = updated || { ...compra, meta: assistedMeta }
    const claimPath = `/vagas/compra/${encodeURIComponent(finalCompra.token)}`
    const claimUrl = absolutize(req, claimPath)
    const paymentUrl = resolvedPayment?.paypal_approval_url || resolvedPayment?.asaas_invoice_url || claimUrl

    return NextResponse.json({
      reused: Boolean(reused),
      sale: {
        id: finalCompra.id,
        token: finalCompra.token,
        status: finalCompra.status,
        valor_centavos: finalCompra.valor_centavos,
        payment_url: paymentUrl,
        claim_url: claimUrl,
      },
      payment: resolvedPayment
        ? {
            id: resolvedPayment.id,
            status: resolvedPayment.status,
            metodo: method,
            provider: resolvedPayment.provider || (method === 'paypal' ? 'paypal' : 'online'),
            invoice_url: resolvedPayment.asaas_invoice_url || null,
            paypal_approval_url: resolvedPayment.paypal_approval_url || null,
            pix_qrcode: resolvedPayment.asaas_pix_qrcode || null,
            pix_payload: resolvedPayment.asaas_pix_payload || null,
          }
        : null,
      mensagem: [
        `Pagamento da vaga: ${paymentUrl}`,
        `Depois do pagamento, inscreva a equipe por aqui: ${claimUrl}`,
        `Token: ${finalCompra.token}`,
      ].join('\n'),
      asaas_configured: isAsaasConfigured(),
      paypal_configured: paypalConfigured(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar venda assistida.' }, { status: 400 })
  }
}
