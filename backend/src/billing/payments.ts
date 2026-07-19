import { supabaseAdmin } from '../shared/supabase-admin'
import {
  createPaymentLink,
  findOrCreateCustomer,
  getPixQrCode,
  isAsaasConfigured,
  isPaidStatus,
  mapAsaasPaymentStatus,
  AsaasNotConfiguredError,
  type AsaasPayment,
} from './asaas'
import { creditWallet, getCommissionBps, splitCommission } from './wallet'

function moneyReais(centavos: number) {
  return Math.round(centavos) / 100
}

function dueDatePlusDays(days = 3) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function appUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://dropzone-cadastros.vercel.app').replace(/\/$/, '')
}

/**
 * Gera (ou reutiliza) link ASAAS para pagar a cobrança do campeonato (pacote DropZone).
 */
export async function createChampionshipPackagePayment(input: {
  campeonatoId: string
  authUserId: string
  payerName: string
  payerEmail: string
  cpfCnpj?: string | null
}) {
  if (!isAsaasConfigured()) throw new AsaasNotConfiguredError()

  const { data: cobranca, error: cErr } = await supabaseAdmin
    .from('campeonato_cobranca')
    .select('*')
    .eq('campeonato_id', input.campeonatoId)
    .maybeSingle()
  if (cErr) throw cErr
  if (!cobranca) throw new Error('Cobrança do campeonato não encontrada. Crie o campeonato novamente após o SQL de preços.')
  if (['pago', 'cortesia', 'isento'].includes(cobranca.status)) {
    throw new Error('Esta cobrança já está quitada ou isenta.')
  }
  if (!cobranca.valor_total_centavos || cobranca.valor_total_centavos < 100) {
    throw new Error('Valor da cobrança inválido (mínimo R$ 1,00).')
  }

  // reutiliza pagamento pendente existente
  const externalReference = `cobranca_campeonato:${input.campeonatoId}`
  const { data: existing } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('external_reference', externalReference)
    .in('status', ['pendente', 'aguardando', 'confirmado'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.asaas_invoice_url && !isPaidStatus(existing.status)) {
    return existing
  }

  const customer = await findOrCreateCustomer({
    name: input.payerName,
    email: input.payerEmail,
    cpfCnpj: input.cpfCnpj,
    externalReference: `auth:${input.authUserId}`,
  })

  const payment = await createPaymentLink({
    customerId: customer.id,
    valueReais: moneyReais(cobranca.valor_total_centavos),
    dueDate: dueDatePlusDays(5),
    description: `DropZone · Pacote campeonato ${input.campeonatoId.slice(0, 8)}`,
    externalReference,
    billingType: 'UNDEFINED',
    callbackUrl: `${appUrl()}/?pagamento=ok`,
  })

  let pix: { encodedImage?: string; payload?: string } = {}
  try {
    pix = await getPixQrCode(payment.id)
  } catch {
    // opcional se billingType não for PIX puro
  }

  const row = {
    finalidade: 'cobranca_campeonato',
    referencia_tipo: 'campeonato_cobranca',
    referencia_id: input.campeonatoId,
    pagador_auth_user_id: input.authUserId,
    pagador_tipo: 'produtora',
    valor_centavos: cobranca.valor_total_centavos,
    descricao: payment.description || null,
    status: mapAsaasPaymentStatus(payment.status),
    asaas_customer_id: customer.id,
    asaas_payment_id: payment.id,
    asaas_invoice_url: payment.invoiceUrl || null,
    asaas_bank_slip_url: payment.bankSlipUrl || null,
    asaas_pix_qrcode: pix.encodedImage || null,
    asaas_pix_payload: pix.payload || null,
    asaas_status: payment.status,
    billing_type: payment.billingType || 'UNDEFINED',
    external_reference: externalReference,
    payload_criacao: payment as any,
    updated_at: new Date().toISOString(),
  }

  const { data: saved, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .upsert(row, { onConflict: 'external_reference' })
    .select('*')
    .single()
  if (error) throw error
  return saved
}

/**
 * Processa webhook / confirmação de pagamento ASAAS.
 */
export async function applyAsaasPaymentUpdate(payment: AsaasPayment, rawWebhook?: unknown) {
  const asaasId = payment.id
  if (!asaasId) throw new Error('Pagamento ASAAS sem id.')

  let { data: row } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('asaas_payment_id', asaasId)
    .maybeSingle()

  if (!row && payment.externalReference) {
    const r2 = await supabaseAdmin
      .from('sistema_pagamentos')
      .select('*')
      .eq('external_reference', payment.externalReference)
      .maybeSingle()
    row = r2.data
  }

  if (!row) {
    // pagamento não originado pelo sistema
    return { ignored: true }
  }

  const status = mapAsaasPaymentStatus(payment.status)
  const wasPaid = isPaidStatus(row.status)

  const { data: updated, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .update({
      status,
      asaas_status: payment.status,
      asaas_invoice_url: payment.invoiceUrl || row.asaas_invoice_url,
      payload_webhook: rawWebhook || payment,
      pago_em: isPaidStatus(status) ? (payment.paymentDate || payment.clientPaymentDate || new Date().toISOString()) : row.pago_em,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select('*')
    .single()
  if (error) throw error

  if (!wasPaid && isPaidStatus(status)) {
    await onPaymentConfirmed(updated)
  }

  return { ignored: false, payment: updated }
}

async function onPaymentConfirmed(pagamento: any) {
  // 1) Cobrança de campeonato (pacote)
  if (pagamento.finalidade === 'cobranca_campeonato') {
    const campeonatoId = pagamento.referencia_id
    await supabaseAdmin
      .from('campeonato_cobranca')
      .update({
        status: 'pago',
        pago_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        observacao: 'Pago via ASAAS',
      })
      .eq('campeonato_id', campeonatoId)

    // credita plataforma
    await creditWallet({
      donoTipo: 'sistema',
      valorCentavos: pagamento.valor_centavos,
      tipo: 'credito_pagamento',
      descricao: `Pacote campeonato ${campeonatoId}`,
      referenciaTipo: 'pagamento',
      referenciaId: pagamento.id,
      meta: { finalidade: pagamento.finalidade },
    })
    return
  }

  // 2) Inscrição de equipe (futuro / quando valor_inscricao > 0)
  if (pagamento.finalidade === 'inscricao_equipe') {
    await creditInscriptionSplit(pagamento)
  }
}

/**
 * Split de inscrição: comissão vendedor + plataforma + resto produtora.
 * Espera meta no pagamento: { campeonato_id, produtora_id, vendedor_manager_id?, vendedor_auth_user_id? }
 */
export async function creditInscriptionSplit(pagamento: any) {
  const meta = pagamento.meta || pagamento.payload_criacao?.dropzone || {}
  const bruto = Number(pagamento.valor_centavos || 0)
  if (bruto <= 0) return

  const { vendedorBps, plataformaBps } = await getCommissionBps()
  // se não houver vendedor, 0% vendedor
  const hasSeller = Boolean(meta.vendedor_auth_user_id || meta.vendedor_manager_id)
  const split = splitCommission(
    bruto,
    hasSeller ? vendedorBps : 0,
    plataformaBps,
  )

  await supabaseAdmin.from('sistema_comissoes').insert({
    pagamento_id: pagamento.id,
    campeonato_id: meta.campeonato_id || null,
    vendedor_manager_id: meta.vendedor_manager_id || null,
    vendedor_auth_user_id: meta.vendedor_auth_user_id || null,
    valor_bruto_centavos: bruto,
    comissao_vendedor_centavos: split.vendedor,
    comissao_plataforma_centavos: split.plataforma,
    valor_liquido_produtora_centavos: split.liquido,
    bps_vendedor: hasSeller ? vendedorBps : 0,
    bps_plataforma: plataformaBps,
    status: 'creditada',
    meta,
  })

  if (split.plataforma > 0) {
    await creditWallet({
      donoTipo: 'sistema',
      valorCentavos: split.plataforma,
      tipo: 'credito_comissao',
      descricao: 'Taxa plataforma (inscrição)',
      referenciaTipo: 'pagamento',
      referenciaId: `${pagamento.id}:plataforma`,
    })
  }

  if (split.vendedor > 0 && meta.vendedor_manager_id) {
    await creditWallet({
      donoTipo: 'manager',
      donoId: meta.vendedor_manager_id,
      authUserId: meta.vendedor_auth_user_id || null,
      valorCentavos: split.vendedor,
      tipo: 'credito_comissao',
      descricao: 'Comissão de venda (inscrição)',
      referenciaTipo: 'pagamento',
      referenciaId: `${pagamento.id}:vendedor`,
      meta,
    })
  }

  if (split.liquido > 0 && meta.produtora_id) {
    await creditWallet({
      donoTipo: 'produtora',
      donoId: meta.produtora_id,
      valorCentavos: split.liquido,
      tipo: 'credito_pagamento',
      descricao: 'Inscrição líquida',
      referenciaTipo: 'pagamento',
      referenciaId: `${pagamento.id}:produtora`,
      meta,
    })
  }
}
