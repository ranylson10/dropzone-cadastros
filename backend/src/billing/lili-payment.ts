import { supabaseAdmin } from '../shared/supabase-admin'
import {
  createPaymentLink,
  findOrCreateCustomer,
  getPayment,
  getPixQrCode,
  isPaidStatus,
  mapAsaasPaymentStatus,
} from './asaas'
import { attachReservationPayment } from './lili-slot-reservation'

function dueDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function createLiliAsaasPayment(input: {
  reservation: any
  payerName: string
  payerEmail: string
  cpfCnpj: string
  campeonatoNome: string
  valorCentavos: number
  method: 'pix' | 'cartao'
}) {
  const digits = String(input.cpfCnpj || '').replace(/\D/g, '')
  if (![11, 14].includes(digits.length)) throw new Error('Informe um CPF ou CNPJ válido para gerar a cobrança.')
  const customer = await findOrCreateCustomer({
    name: input.payerName,
    email: input.payerEmail,
    cpfCnpj: digits,
    externalReference: `auth:${input.reservation.auth_user_id}`,
  })
  const externalReference = `lili_reserva:${input.reservation.id}`
  const { data: existing } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('external_reference', externalReference)
    .in('status', ['pendente', 'aguardando', 'confirmado', 'pago'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  const remote = await createPaymentLink({
    customerId: customer.id,
    valueReais: Math.round(input.valorCentavos) / 100,
    dueDate: dueDate(),
    description: `Inscrição · ${input.campeonatoNome}`.slice(0, 500),
    externalReference,
    billingType: input.method === 'pix' ? 'PIX' : 'CREDIT_CARD',
  })
  let pix: { encodedImage?: string; payload?: string } = {}
  if (input.method === 'pix') {
    try { pix = await getPixQrCode(remote.id) } catch { /* QR pode demorar; invoice continua disponível */ }
  }
  const row = {
    finalidade: 'inscricao_equipe',
    referencia_tipo: 'lili_reservas_slot',
    referencia_id: input.reservation.id,
    pagador_auth_user_id: input.reservation.auth_user_id,
    pagador_tipo: 'equipe',
    valor_centavos: input.valorCentavos,
    descricao: remote.description || null,
    status: mapAsaasPaymentStatus(remote.status),
    asaas_customer_id: customer.id,
    asaas_payment_id: remote.id,
    asaas_invoice_url: remote.invoiceUrl || null,
    asaas_bank_slip_url: remote.bankSlipUrl || null,
    asaas_pix_qrcode: pix.encodedImage || null,
    asaas_pix_payload: pix.payload || null,
    asaas_status: remote.status,
    billing_type: remote.billingType || (input.method === 'pix' ? 'PIX' : 'CREDIT_CARD'),
    external_reference: externalReference,
    payload_criacao: { ...remote, dropzone: { lili_reserva_id: input.reservation.id } },
    updated_at: new Date().toISOString(),
  }
  const { data: saved, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .upsert(row, { onConflict: 'external_reference' })
    .select('*')
    .single()
  if (error) throw error
  await attachReservationPayment(input.reservation.id, '', saved.id)
  return saved
}

export async function getLiliPaymentStatus(reservationId: string) {
  const { data: payment, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('referencia_tipo', 'lili_reservas_slot')
    .eq('referencia_id', reservationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!payment) return null
  if (payment.asaas_payment_id && !isPaidStatus(payment.status)) {
    try {
      const remote = await getPayment(payment.asaas_payment_id)
      const status = mapAsaasPaymentStatus(remote.status)
      const { data: updated } = await supabaseAdmin
        .from('sistema_pagamentos')
        .update({ status, asaas_status: remote.status, pago_em: isPaidStatus(status) ? new Date().toISOString() : payment.pago_em, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
        .select('*')
        .single()
      return updated || payment
    } catch { return payment }
  }
  return payment
}
