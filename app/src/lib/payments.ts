export type PaymentMethod = 'pix' | 'cartao' | 'paypal'

export type VacancyPaymentResult = {
  reused: boolean
  compra: {
    id: string
    token: string
    status: string
    valor_centavos: number
    campeonato_id: string
    grupo_id?: string | null
  }
  payment: null | {
    id: string
    status: string
    valor_centavos: number
    invoice_url?: string | null
    pix_qrcode?: string | null
    pix_payload?: string | null
    provider?: string | null
    metodo?: string | null
    billing_type?: string | null
    paypal_approval_url?: string | null
  }
  claim_url: string
  asaas_configured: boolean
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  paypal: 'PayPal',
}
