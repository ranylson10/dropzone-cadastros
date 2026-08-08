export type WalletSummary = {
  id?: string
  saldo_disponivel_centavos?: number
  saldo_bloqueado_centavos?: number
  dono_tipo?: string
  pix_chave?: string | null
  pix_tipo?: string | null
  pix_titular?: string | null
}

export type WalletMovement = {
  id?: string
  tipo?: string
  direcao?: 'credito' | 'debito' | string
  valor_centavos?: number
  descricao?: string | null
  status?: string | null
  created_at?: string
  pago_em?: string | null
  finalidade?: string | null
  billing_type?: string | null
}

export type WalletReceipt = {
  id?: string
  tipo?: string
  status?: string
  valor_centavos?: number
  descricao?: string
  data_movimento?: string
  autenticacao?: string
  origem?: { nome?: string; instituicao?: string }
  destino?: { nome?: string; instituicao?: string; chave_pix?: string }
}

export const fallbackWallet = {
  carteira: {
    saldo_disponivel_centavos: 0,
    saldo_bloqueado_centavos: 0,
    dono_tipo: 'auth_user',
  } satisfies WalletSummary,
  lancamentos: [
    {
      id: 'demo-lancamento',
      tipo: 'credito_demo',
      direcao: 'credito',
      valor_centavos: 3000,
      descricao: 'Exemplo de comissão creditada após venda confirmada',
      status: 'confirmado',
      created_at: undefined,
    },
  ] satisfies WalletMovement[],
  pagamentos: [
    {
      id: 'demo-pagamento',
      finalidade: 'compra_vaga',
      valor_centavos: 3000,
      descricao: 'Exemplo de compra de vaga',
      status: 'pago',
      billing_type: 'PIX',
      created_at: undefined,
    },
  ] satisfies WalletMovement[],
}

export const cents = (value?: number | null) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const compactDate = (value?: string | null) => {
  if (!value) return 'data a confirmar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('pt-BR')
}

export const movementTitle = (item: WalletMovement) =>
  item.descricao || item.finalidade || item.tipo || 'Movimento da carteira'

export const movementStatus = (item: WalletMovement) =>
  String(item.status || item.direcao || 'registrado').replaceAll('_', ' ')

