import { supabaseAdmin } from '../shared/supabase-admin'
import { appUrl as configuredAppUrl } from '../shared/env'
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
  return configuredAppUrl()
}

/**
 * Gera (ou reutiliza) link ASAAS para pagar a cobranca do campeonato (pacote DropZone).
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
  if (!cobranca) throw new Error('Cobranca do campeonato nao encontrada. Crie o campeonato novamente apos o SQL de precos.')
  if (['pago', 'cortesia', 'isento'].includes(cobranca.status)) {
    throw new Error('Esta cobranca ja esta quitada ou isenta.')
  }
  if (!cobranca.valor_total_centavos || cobranca.valor_total_centavos < 100) {
    throw new Error('Valor da cobranca invalido (minimo R$ 1,00).')
  }

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
    // opcional
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
 * Cria pagamento ASAAS de inscricao de equipe (valor_inscricao do campeonato).
 */
export async function createInscriptionPayment(input: {
  campeonatoId: string
  campeonatoEquipeId: string
  authUserId: string
  payerName: string
  payerEmail: string
  cpfCnpj?: string | null
  vendedorManagerId?: string | null
  vendedorAuthUserId?: string | null
  produtoraId?: string | null
}) {
  if (!isAsaasConfigured()) throw new AsaasNotConfiguredError()

  const { data: champ, error: cErr } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,produtora_id')
    .eq('id', input.campeonatoId)
    .maybeSingle()
  if (cErr) throw cErr
  if (!champ) throw new Error('Campeonato nao encontrado.')

  const { data: config } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('valor_inscricao')
    .eq('campeonato_id', input.campeonatoId)
    .maybeSingle()

  const valorReais = Number(config?.valor_inscricao || 0)
  if (!Number.isFinite(valorReais) || valorReais < 1) {
    throw new Error('Este campeonato nao tem valor de inscricao cobravel (min. R$ 1,00).')
  }
  const valorCentavos = Math.round(valorReais * 100)

  const externalReference = `inscricao:${input.campeonatoEquipeId}`
  const { data: existing } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('external_reference', externalReference)
    .in('status', ['pendente', 'aguardando', 'confirmado', 'pago'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.asaas_invoice_url && !isPaidStatus(existing.status)) return existing
  if (existing && isPaidStatus(existing.status)) return existing

  let vendedorManagerId = input.vendedorManagerId || null
  let vendedorAuthUserId = input.vendedorAuthUserId || null
  if (!vendedorManagerId) {
    const { data: part } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('origem_entrada,criado_por')
      .eq('id', input.campeonatoEquipeId)
      .maybeSingle()
    if (part?.origem_entrada === 'vendedor' && part.criado_por) {
      const { data: vend } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('manager_id,manager_auth_user_id')
        .eq('campeonato_id', input.campeonatoId)
        .eq('manager_auth_user_id', part.criado_por)
        .eq('status', 'ativo')
        .maybeSingle()
      if (vend) {
        vendedorManagerId = vend.manager_id
        vendedorAuthUserId = vend.manager_auth_user_id
      }
    }
  }

  const produtoraId = input.produtoraId || champ.produtora_id || null

  const customer = await findOrCreateCustomer({
    name: input.payerName,
    email: input.payerEmail,
    cpfCnpj: input.cpfCnpj,
    externalReference: `auth:${input.authUserId}`,
  })

  const payment = await createPaymentLink({
    customerId: customer.id,
    valueReais: valorReais,
    dueDate: dueDatePlusDays(3),
    description: `Inscricao · ${champ.nome || 'Campeonato'}`.slice(0, 500),
    externalReference,
    billingType: 'UNDEFINED',
    callbackUrl: `${appUrl()}/?pagamento=inscricao_ok`,
  })

  let pix: { encodedImage?: string; payload?: string } = {}
  try {
    pix = await getPixQrCode(payment.id)
  } catch {
    // ignore
  }

  const dropzoneMeta = {
    campeonato_id: input.campeonatoId,
    campeonato_equipe_id: input.campeonatoEquipeId,
    produtora_id: produtoraId,
    vendedor_manager_id: vendedorManagerId,
    vendedor_auth_user_id: vendedorAuthUserId,
  }

  const row = {
    finalidade: 'inscricao_equipe',
    referencia_tipo: 'campeonato_equipes',
    referencia_id: input.campeonatoEquipeId,
    pagador_auth_user_id: input.authUserId,
    pagador_tipo: 'equipe',
    valor_centavos: valorCentavos,
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
    payload_criacao: { ...payment, dropzone: dropzoneMeta },
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
 * Processa webhook / confirmacao de pagamento ASAAS.
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
      pago_em: isPaidStatus(status)
        ? (payment.paymentDate || payment.clientPaymentDate || new Date().toISOString())
        : row.pago_em,
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

    await supabaseAdmin
      .from('campeonatos')
      .update({
        aprovacao_status: 'aprovado',
      })
      .eq('id', campeonatoId)

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

  if (pagamento.finalidade === 'inscricao_equipe') {
    await creditInscriptionSplit(pagamento)
    return
  }

  if (pagamento.finalidade === 'compra_vaga') {
    // Import dinâmico evita ciclo em load com vacancy-purchase.ts
    const { liberarCompraVagaComSplit } = await import('./vacancy-purchase')
    await liberarCompraVagaComSplit(pagamento)
  }
}

/**
 * Split de inscricao: bruto -> vendedor + plataforma + resto produtora.
 */
export async function creditInscriptionSplit(pagamento: any) {
  const meta = pagamento.meta || pagamento.payload_criacao?.dropzone || {}
  const bruto = Number(pagamento.valor_centavos || 0)
  if (bruto <= 0) return

  const { vendedorBps, plataformaBps } = await getCommissionBps()
  const hasSeller = Boolean(meta.vendedor_auth_user_id || meta.vendedor_manager_id)
  const split = splitCommission(bruto, hasSeller ? vendedorBps : 0, plataformaBps)

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
      descricao: 'Taxa plataforma (inscricao)',
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
      descricao: 'Comissao de venda (inscricao)',
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
      descricao: 'Inscricao liquida',
      referenciaTipo: 'pagamento',
      referenciaId: `${pagamento.id}:produtora`,
      meta,
    })
  }
}
