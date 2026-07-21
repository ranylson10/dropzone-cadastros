import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser, getActiveAccount } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { createInscriptionPayment } from '@backend/billing/payments'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function requireInscriptionPaymentAccess(
  req: NextRequest,
  user: Awaited<ReturnType<typeof getBearerUser>>,
  part: { campeonato_id: string; equipe_id: string | null },
) {
  const championshipPermission = await getCampeonatoPermission(user.id, part.campeonato_id)
  if (championshipPermission.role === 'owner' || championshipPermission.canManage) return

  if (!part.equipe_id) throw new Error('Sem permissão para acessar esta inscrição.')

  const accounts = await getAccountsForUser(user)
  await requireEquipeAccess(user.id, accounts, part.equipe_id, 'ver')
}

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

    // Somente dono/staff da equipe ou organizador autorizado.
    await requireInscriptionPaymentAccess(req, user, part)

    const email = String(user.email || account?.data?.email_contato || '').trim()
    const name = String(account?.name || user.user_metadata?.full_name || email).trim()

    const payment = await createInscriptionPayment({
      campeonatoId: part.campeonato_id,
      campeonatoEquipeId: part.id,
      authUserId: user.id,
      payerName: name || 'Equipe',
      payerEmail: email || `equipe-${part.equipe_id}@dropzone.local`,
      cpfCnpj: body.cpf_cnpj ? String(body.cpf_cnpj) : null,
      // A atribuição do vendedor é derivada da participação no backend.
      // IDs enviados pelo cliente não são confiáveis para comissão.
      vendedorManagerId: null,
      vendedorAuthUserId: null,
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
    const user = await getBearerUser(req)
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
      .select('id,campeonato_id,equipe_id')
      .eq('id', ceId)
      .maybeSingle()

    if (!part) throw new Error('Participação não encontrada.')
    await requireInscriptionPaymentAccess(req, user, part)

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
