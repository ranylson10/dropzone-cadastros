import { booleanEnv, optionalEnv } from '../shared/env'
/**
 * Cliente ASAAS (sandbox/produção).
 * Se ASAAS_API_KEY não existir, funções lançam AsaasNotConfiguredError —
 * o resto do sistema continua normal.
 */

export class AsaasNotConfiguredError extends Error {
  constructor() {
    super('ASAAS não configurado. Defina ASAAS_API_KEY (e opcional ASAAS_ENV=sandbox|production).')
    this.name = 'AsaasNotConfiguredError'
  }
}

export type AsaasCustomer = {
  id: string
  name?: string
  email?: string
  cpfCnpj?: string
}

export type AsaasPayment = {
  id: string
  status: string
  value: number
  netValue?: number
  invoiceUrl?: string
  bankSlipUrl?: string
  invoiceNumber?: string
  externalReference?: string
  billingType?: string
  customer?: string
  dueDate?: string
  paymentDate?: string
  clientPaymentDate?: string
  description?: string
}

function baseUrl() {
  const env = optionalEnv('ASAAS_ENV', optionalEnv('ASAAS_API_URL', 'sandbox')).toLowerCase()
  if (env.includes('api.asaas.com') || env === 'production' || env === 'prod') {
    return 'https://api.asaas.com/v3'
  }
  if (env.startsWith('http')) return env.replace(/\/$/, '')
  return 'https://sandbox.asaas.com/api/v3'
}

function apiKey() {
  const key = optionalEnv('ASAAS_API_KEY')
  if (!key) throw new AsaasNotConfiguredError()
  return key
}

export function isAsaasConfigured() {
  return booleanEnv('ASAAS_API_KEY')
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = apiKey()
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      ...(init?.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.description
      || json?.message
      || `ASAAS HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

export async function findOrCreateCustomer(input: {
  name: string
  email: string
  cpfCnpj?: string | null
  externalReference?: string
}): Promise<AsaasCustomer> {
  const email = String(input.email || '').trim().toLowerCase()
  if (!email) throw new Error('E-mail do pagador é obrigatório para o ASAAS.')

  const cpfDigits = input.cpfCnpj ? String(input.cpfCnpj).replace(/\D/g, '') : ''

  // busca por e-mail
  const found = await asaasFetch<{ data?: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
  )
  const existing = found.data?.[0]
  if (existing?.id) {
    // Cliente já existe sem documento: atualiza CPF/CNPJ (necessário para cobrança PIX).
    if (cpfDigits && !String(existing.cpfCnpj || '').replace(/\D/g, '')) {
      return asaasFetch<AsaasCustomer>(`/customers/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ cpfCnpj: cpfDigits }),
      })
    }
    return existing
  }

  const body: Record<string, unknown> = {
    name: String(input.name || email).slice(0, 100),
    email,
    notificationDisabled: true,
  }
  if (cpfDigits) body.cpfCnpj = cpfDigits
  if (input.externalReference) body.externalReference = input.externalReference

  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createPaymentLink(input: {
  customerId: string
  valueReais: number
  dueDate: string // YYYY-MM-DD
  description: string
  externalReference: string
  billingType?: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  callbackUrl?: string
}): Promise<AsaasPayment> {
  const value = Math.round(Number(input.valueReais) * 100) / 100
  if (!Number.isFinite(value) || value < 1) {
    throw new Error('Valor mínimo de cobrança ASAAS: R$ 1,00.')
  }

  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: input.billingType || 'UNDEFINED',
    value,
    dueDate: input.dueDate,
    description: String(input.description || 'DropZone').slice(0, 500),
    externalReference: input.externalReference,
  }
  // callback.successUrl só funciona se o domínio estiver cadastrado na conta ASAAS
  // (Minha Conta → Informações). Se falhar por isso, recria sem callback.
  if (input.callbackUrl) {
    body.callback = {
      successUrl: input.callbackUrl,
      autoRedirect: true,
    }
  }

  try {
    return await asaasFetch<AsaasPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    const msg = String(err?.message || '')
    const domainMissing =
      /domínio configurado|dominio configurado|Cadastre um site/i.test(msg)
    if (domainMissing && body.callback) {
      delete body.callback
      return asaasFetch<AsaasPayment>('/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }
    if (domainMissing) {
      throw new Error(
        'Não foi possível gerar o PIX na conta ASAAS. Verifique a chave da API e se a conta está ativa.',
      )
    }
    throw err
  }
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`)
}

export async function getPixQrCode(paymentId: string): Promise<{
  encodedImage?: string
  payload?: string
  expirationDate?: string
}> {
  return asaasFetch(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`)
}

/** Mapeia status ASAAS → status interno. */
export function mapAsaasPaymentStatus(asaasStatus: string): string {
  const s = String(asaasStatus || '').toUpperCase()
  if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(s)) return 'pago'
  if (s === 'CONFIRMED') return 'confirmado'
  if (['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(s)) return 'aguardando'
  if (s === 'OVERDUE') return 'vencido'
  if (['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(s)) {
    return 'estornado'
  }
  if (['DELETED', 'RESTORED'].includes(s)) return 'cancelado'
  return 'pendente'
}

export function isPaidStatus(status: string) {
  return status === 'pago' || status === 'confirmado'
}
