import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../shared/supabase-admin'
import { attachReservationPayment } from './lili-slot-reservation'

export type PayPalCurrency = 'BRL' | 'USD' | 'EUR'

function environment() {
  return String(process.env.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox'
}

function apiBase() {
  return environment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

function credentials() {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim()
  const secret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || !secret) throw new Error('PayPal ainda não foi configurado na Vercel.')
  return { clientId, secret }
}

export function paypalConfigured() {
  return Boolean(String(process.env.PAYPAL_CLIENT_ID || '').trim() && String(process.env.PAYPAL_CLIENT_SECRET || '').trim())
}

async function accessToken() {
  const { clientId, secret } = credentials()
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.access_token) throw new Error(data?.error_description || 'Não foi possível autenticar no PayPal.')
  return String(data.access_token)
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await accessToken()
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': randomUUID(),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.details?.[0]?.description || data?.message || data?.error_description
    throw new Error(detail || `Erro PayPal (${response.status}).`)
  }
  return data
}

function amountString(minor: number) {
  return (Math.round(minor) / 100).toFixed(2)
}

export async function createLiliPayPalOrder(input: {
  reservation: any
  campeonatoNome: string
  amountMinor: number
  currency: PayPalCurrency
  returnOrigin: string
}) {
  if (!paypalConfigured()) throw new Error('PayPal ainda não foi configurado.')
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Valor inválido para o PayPal.')

  const externalReference = `lili_paypal:${input.reservation.id}`
  const { data: existing } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('external_reference', externalReference)
    .in('status', ['pendente', 'aguardando', 'confirmado', 'pago'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.paypal_order_id && existing?.paypal_approval_url) return existing

  const returnUrl = `${input.returnOrigin}/lili?paypal=approved&reservation=${encodeURIComponent(input.reservation.id)}`
  const cancelUrl = `${input.returnOrigin}/lili?paypal=cancelled&reservation=${encodeURIComponent(input.reservation.id)}`
  const order = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: input.reservation.id,
        custom_id: input.reservation.id,
        invoice_id: input.reservation.codigo,
        description: `Inscrição · ${input.campeonatoNome}`.slice(0, 127),
        amount: { currency_code: input.currency, value: amountString(input.amountMinor) },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'DropZone',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
  })
  const approvalUrl = order?.links?.find((link: any) => link?.rel === 'payer-action' || link?.rel === 'approve')?.href
  if (!approvalUrl) throw new Error('O PayPal não retornou o link de aprovação.')

  const row = {
    finalidade: 'inscricao_equipe',
    referencia_tipo: 'lili_reservas_slot',
    referencia_id: input.reservation.id,
    pagador_auth_user_id: input.reservation.auth_user_id,
    pagador_tipo: 'equipe',
    valor_centavos: input.amountMinor,
    descricao: `Inscrição · ${input.campeonatoNome}`,
    status: 'aguardando',
    billing_type: 'PAYPAL',
    external_reference: externalReference,
    provider: 'paypal',
    moeda: input.currency,
    paypal_order_id: order.id,
    paypal_status: order.status,
    paypal_approval_url: approvalUrl,
    payload_criacao: { ...order, dropzone: { lili_reserva_id: input.reservation.id } },
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

export async function getPayPalOrder(orderId: string) {
  return paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' })
}

function captureFromOrder(order: any) {
  return order?.purchase_units?.flatMap((unit: any) => unit?.payments?.captures || [])?.[0] || null
}

async function validateAndPersistOrder(order: any, expectedPayment: any) {
  const unit = order?.purchase_units?.[0]
  const capture = captureFromOrder(order)
  const amount = capture?.amount || unit?.amount
  const expectedValue = amountString(Number(expectedPayment.valor_centavos))
  if (String(unit?.custom_id || '') !== String(expectedPayment.referencia_id)) throw new Error('A ordem PayPal não pertence a esta reserva.')
  if (String(amount?.currency_code || '') !== String(expectedPayment.moeda || 'BRL')) throw new Error('A moeda retornada pelo PayPal não corresponde à cobrança.')
  if (String(amount?.value || '') !== expectedValue) throw new Error('O valor retornado pelo PayPal não corresponde à cobrança.')

  const completed = String(capture?.status || order?.status || '').toUpperCase() === 'COMPLETED'
  const patch = {
    status: completed ? 'pago' : 'aguardando',
    paypal_status: String(capture?.status || order?.status || ''),
    paypal_capture_id: capture?.id || expectedPayment.paypal_capture_id || null,
    payload_webhook: order,
    pago_em: completed ? new Date().toISOString() : expectedPayment.pago_em,
    updated_at: new Date().toISOString(),
  }
  const { data: updated, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .update(patch)
    .eq('id', expectedPayment.id)
    .select('*')
    .single()
  if (error) throw error
  if (completed) {
    await supabaseAdmin
      .from('lili_reservas_slot')
      .update({ expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', expectedPayment.referencia_id)
      .eq('status', 'ativa')
  }
  return updated
}

export async function captureLiliPayPalOrder(input: { orderId: string; reservationId: string; authUserId: string }) {
  const { data: payment, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('paypal_order_id', input.orderId)
    .eq('referencia_tipo', 'lili_reservas_slot')
    .eq('referencia_id', input.reservationId)
    .eq('pagador_auth_user_id', input.authUserId)
    .maybeSingle()
  if (error) throw error
  if (!payment) throw new Error('Pagamento PayPal não localizado para esta reserva.')
  if (['pago', 'confirmado'].includes(String(payment.status))) return payment

  let order = await getPayPalOrder(input.orderId)
  if (String(order?.status || '').toUpperCase() === 'APPROVED') {
    order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: '{}',
    })
  }
  return validateAndPersistOrder(order, payment)
}

export async function getLiliPayPalPaymentStatus(reservationId: string) {
  const { data: payment, error } = await supabaseAdmin
    .from('sistema_pagamentos')
    .select('*')
    .eq('referencia_tipo', 'lili_reservas_slot')
    .eq('referencia_id', reservationId)
    .eq('provider', 'paypal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!payment?.paypal_order_id || ['pago', 'confirmado'].includes(String(payment.status))) return payment
  try {
    const order = await getPayPalOrder(payment.paypal_order_id)
    return validateAndPersistOrder(order, payment)
  } catch {
    return payment
  }
}

export async function verifyPayPalWebhook(headers: Headers, event: any) {
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID não configurado.')
  const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  })
  return String(verification?.verification_status || '').toUpperCase() === 'SUCCESS'
}

export async function applyPayPalWebhook(event: any) {
  const resource = event?.resource || {}
  const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.id
  const captureId = String(event?.event_type || '').startsWith('PAYMENT.CAPTURE.') ? resource?.id : null
  let query = supabaseAdmin.from('sistema_pagamentos').select('*')
  if (orderId) query = query.eq('paypal_order_id', orderId)
  else if (captureId) query = query.eq('paypal_capture_id', captureId)
  else return { ignored: true }
  const { data: payment, error } = await query.maybeSingle()
  if (error) throw error
  if (!payment) return { ignored: true }

  const eventType = String(event?.event_type || '')
  const completed = eventType === 'PAYMENT.CAPTURE.COMPLETED'
  const denied = ['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REVERSED'].includes(eventType)
  const refunded = eventType === 'PAYMENT.CAPTURE.REFUNDED'
  const status = completed ? 'pago' : refunded ? 'estornado' : denied ? 'falha' : 'aguardando'
  const { error: updateError } = await supabaseAdmin
    .from('sistema_pagamentos')
    .update({
      status,
      paypal_status: resource?.status || eventType,
      paypal_capture_id: captureId || payment.paypal_capture_id,
      payload_webhook: event,
      pago_em: completed ? new Date().toISOString() : payment.pago_em,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)
  if (updateError) throw updateError
  if (completed) {
    await supabaseAdmin
      .from('lili_reservas_slot')
      .update({ expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', payment.referencia_id)
      .eq('status', 'ativa')
  }
  return { updated: true, status }
}
