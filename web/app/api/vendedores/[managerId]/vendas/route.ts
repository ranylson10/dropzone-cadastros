import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getBearerUser } from '@backend/auth/server-auth'
import { isAsaasConfigured } from '@backend/billing/asaas'
import { paypalConfigured } from '@backend/billing/paypal'
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
    throw new Error('Vendedor não encontrado para esta conta.')
  }
  if (['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) {
    throw new Error('Este vendedor não pode gerar vendas agora.')
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
  if (!seller) throw new Error('Este campeonato não está liberado para este vendedor.')
  const permissions = (seller.permissoes || {}) as Record<string, any>
  if (permissions.vender_vagas === false || permissions.gerar_pagamentos === false) {
    throw new Error('Este vendedor não tem permissão para gerar cobranças deste campeonato.')
  }
  return seller
}

export async function GET(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { managerId } = await context.params
    await requireOwnManager(managerId, user.id)

    const [{ data: purchases, error }, { data: assisted, error: assistedError }] = await Promise.all([
      supabaseAdmin
      .from('sistema_compras_vaga')
      .select('id,token,campeonato_id,grupo_id,status,valor_centavos,expira_em,pago_em,liberado_em,consumido_em,created_at,updated_at,meta,pagamento_id')
      .eq('vendedor_manager_id', managerId)
      .order('created_at', { ascending: false })
      .limit(80),
      supabaseAdmin
        .from('sistema_vendas_assistidas')
        .select('id,token,campeonato_id,quantidade_vagas,canal,referencia,status,comprador_auth_user_id,compra_vaga_id,expira_em,created_at')
        .eq('vendedor_manager_id', managerId)
        .order('created_at', { ascending: false })
        .limit(80),
    ])
    if (error) throw error
    if (assistedError) throw assistedError

    const championshipIds = [...new Set([...(purchases || []), ...(assisted || [])].map((row: any) => row.campeonato_id).filter(Boolean))]
    const paymentIds = [...new Set((purchases || []).map((row: any) => row.pagamento_id).filter(Boolean))]
    const groupIds = [...new Set((purchases || []).map((row: any) => row.grupo_id).filter(Boolean))]

    const [championshipsResult, paymentsResult, groupsResult] = await Promise.all([
      championshipIds.length
        ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url').in('id', championshipIds)
        : Promise.resolve({ data: [], error: null } as any),
      paymentIds.length
        ? supabaseAdmin.from('sistema_pagamentos').select('id,status,provider,billing_type,asaas_status,asaas_invoice_url,paypal_approval_url,pago_em,valor_centavos').in('id', paymentIds)
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

    const purchaseSales = (purchases || []).map((purchase: any) => {
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
        quantidade_vagas: Number(purchase.meta?.quantidade_vagas || 1),
        vagas_usadas: Number(purchase.meta?.vagas_usadas || 0),
        vagas_restantes: Number(purchase.meta?.vagas_restantes ?? Math.max(0, Number(purchase.meta?.quantidade_vagas || 1) - Number(purchase.meta?.vagas_usadas || 0))),
        campeonato: championships.get(purchase.campeonato_id) || null,
        grupo: groups.get(purchase.grupo_id) || null,
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              metodo:
                payment.provider === 'paypal'
                  ? 'paypal'
                  : String(payment.billing_type || '').toUpperCase() === 'CREDIT_CARD'
                    ? 'cartao'
                    : 'pix',
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

    const purchasesById = new Set((purchases || []).map((purchase: any) => purchase.id))
    const linkSales = (assisted || []).filter((entry: any) => !entry.compra_vaga_id || !purchasesById.has(entry.compra_vaga_id)).map((entry: any) => ({
      id: entry.id, token: entry.token, status: entry.status, valor_centavos: 0,
      created_at: entry.created_at, expira_em: entry.expira_em, pago_em: null, liberado_em: null, consumido_em: null,
      comprador_nome: entry.referencia || null, quantidade_vagas: Number(entry.quantidade_vagas || 1), vagas_usadas: 0,
      vagas_restantes: Number(entry.quantidade_vagas || 1), campeonato: championships.get(entry.campeonato_id) || null, grupo: null,
      payment: null, channel: entry.canal, claim_url: absolutize(req, `/vendas/${encodeURIComponent(entry.token)}`),
      payment_url: absolutize(req, `/vendas/${encodeURIComponent(entry.token)}`),
    }))
    const sales = [...linkSales, ...purchaseSales].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
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
    if (!campeonatoId) throw new Error('campeonato_id obrigatório.')
    await requireSellerPermission(managerId, campeonatoId)

    const method = ['pix', 'cartao', 'paypal'].includes(String(body.method || 'pix'))
      ? String(body.method || 'pix') as 'pix' | 'cartao' | 'paypal'
      : 'pix'
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(body.quantidade_vagas || body.quantidade || 1))))
    const buyerName = String(body.referencia || body.comprador_nome || '').trim()
    const channel = ['whatsapp', 'instagram', 'tiktok', 'link', 'outro'].includes(String(body.canal || 'whatsapp')) ? String(body.canal || 'whatsapp') : 'whatsapp'
    const token = `VS-${randomBytes(8).toString('base64url').toUpperCase()}`
    const now = new Date().toISOString()
    const checkoutPath = `/vendas/${encodeURIComponent(token)}`
    const checkoutUrl = absolutize(req, checkoutPath)
    const { data: sale, error: saleError } = await supabaseAdmin.from('sistema_vendas_assistidas').insert({
      token, vendedor_manager_id: managerId, vendedor_auth_user_id: user.id, campeonato_id: campeonatoId,
      quantidade_vagas: quantity, canal: channel, referencia: buyerName || null,
      meta: { criada_por_vendedor_em: now, metodo_sugerido: method },
    }).select('id,token,status,quantidade_vagas,expira_em').single()
    if (saleError) throw saleError

    return NextResponse.json({
      sale: {
        id: sale.id,
        token: sale.token,
        status: sale.status,
        checkout_url: checkoutUrl,
        quantidade_vagas: quantity,
      },
      mensagem: [
        `Compra de ${quantity} vaga${quantity > 1 ? 's' : ''}: ${checkoutUrl}`,
        'Abra o link, entre na sua conta e pague com segurança pela DropZone.',
        `Código da venda: ${sale.token}`,
      ].join('\n'),
      asaas_configured: isAsaasConfigured(),
      paypal_configured: paypalConfigured(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar venda assistida.' }, { status: 400 })
  }
}
