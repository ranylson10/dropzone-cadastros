import { supabaseAdmin } from '../shared/supabase-admin'

export type WalletOwnerType = 'sistema' | 'produtora' | 'manager' | 'vendedor' | 'auth_user'

export async function getOrCreateWallet(input: {
  donoTipo: WalletOwnerType
  donoId?: string | null
  authUserId?: string | null
}) {
  if (input.donoTipo === 'sistema') {
    const { data, error } = await supabaseAdmin
      .from('sistema_carteiras')
      .select('*')
      .eq('dono_tipo', 'sistema')
      .maybeSingle()
    if (error) throw error
    if (data) return data
    const created = await supabaseAdmin
      .from('sistema_carteiras')
      .insert({ dono_tipo: 'sistema', dono_id: null })
      .select('*')
      .single()
    if (created.error) throw created.error
    return created.data
  }

  if (!input.donoId) throw new Error('donoId obrigatório para carteira.')

  const { data: existing, error } = await supabaseAdmin
    .from('sistema_carteiras')
    .select('*')
    .eq('dono_tipo', input.donoTipo)
    .eq('dono_id', input.donoId)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  const created = await supabaseAdmin
    .from('sistema_carteiras')
    .insert({
      dono_tipo: input.donoTipo,
      dono_id: input.donoId,
      auth_user_id: input.authUserId || null,
    })
    .select('*')
    .single()
  if (created.error) throw created.error
  return created.data
}

async function appendLedger(input: {
  carteiraId: string
  tipo: string
  direcao: 'credito' | 'debito'
  valorCentavos: number
  descricao?: string
  referenciaTipo?: string
  referenciaId?: string
  meta?: Record<string, unknown>
  criadoPor?: string | null
  saldoApos: number
}) {
  const { error } = await supabaseAdmin.from('sistema_carteira_lancamentos').insert({
    carteira_id: input.carteiraId,
    tipo: input.tipo,
    direcao: input.direcao,
    valor_centavos: input.valorCentavos,
    saldo_apos_centavos: input.saldoApos,
    descricao: input.descricao || null,
    referencia_tipo: input.referenciaTipo || null,
    referencia_id: input.referenciaId || null,
    meta: input.meta || {},
    criado_por: input.criadoPor || null,
  })
  if (error) throw error
}

/** Crédito no saldo disponível (pagamento/comissão). Idempotente por referência. */
export async function creditWallet(input: {
  donoTipo: WalletOwnerType
  donoId?: string | null
  authUserId?: string | null
  valorCentavos: number
  tipo: string
  descricao?: string
  referenciaTipo: string
  referenciaId: string
  meta?: Record<string, unknown>
  criadoPor?: string | null
}) {
  if (input.valorCentavos <= 0) throw new Error('Valor de crédito inválido.')

  // idempotência: já existe lançamento com mesma ref+tipo?
  const { data: prev } = await supabaseAdmin
    .from('sistema_carteira_lancamentos')
    .select('id')
    .eq('referencia_tipo', input.referenciaTipo)
    .eq('referencia_id', input.referenciaId)
    .eq('tipo', input.tipo)
    .eq('direcao', 'credito')
    .maybeSingle()
  if (prev) return { skipped: true as const }

  const wallet = await getOrCreateWallet({
    donoTipo: input.donoTipo,
    donoId: input.donoId,
    authUserId: input.authUserId,
  })

  const novo = Number(wallet.saldo_disponivel_centavos || 0) + input.valorCentavos
  const { data: updated, error } = await supabaseAdmin
    .from('sistema_carteiras')
    .update({
      saldo_disponivel_centavos: novo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id)
    .select('*')
    .single()
  if (error) throw error

  await appendLedger({
    carteiraId: wallet.id,
    tipo: input.tipo,
    direcao: 'credito',
    valorCentavos: input.valorCentavos,
    descricao: input.descricao,
    referenciaTipo: input.referenciaTipo,
    referenciaId: input.referenciaId,
    meta: input.meta,
    criadoPor: input.criadoPor,
    saldoApos: novo,
  })

  return { skipped: false as const, wallet: updated }
}

/** Debita saldo disponível (saque). */
export async function debitWallet(input: {
  carteiraId: string
  valorCentavos: number
  tipo: string
  descricao?: string
  referenciaTipo: string
  referenciaId: string
  meta?: Record<string, unknown>
  criadoPor?: string | null
}) {
  if (input.valorCentavos <= 0) throw new Error('Valor de débito inválido.')

  const { data: wallet, error } = await supabaseAdmin
    .from('sistema_carteiras')
    .select('*')
    .eq('id', input.carteiraId)
    .maybeSingle()
  if (error) throw error
  if (!wallet) throw new Error('Carteira não encontrada.')

  const atual = Number(wallet.saldo_disponivel_centavos || 0)
  if (atual < input.valorCentavos) throw new Error('Saldo insuficiente.')

  const novo = atual - input.valorCentavos
  const { error: upErr } = await supabaseAdmin
    .from('sistema_carteiras')
    .update({
      saldo_disponivel_centavos: novo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id)
  if (upErr) throw upErr

  await appendLedger({
    carteiraId: wallet.id,
    tipo: input.tipo,
    direcao: 'debito',
    valorCentavos: input.valorCentavos,
    descricao: input.descricao,
    referenciaTipo: input.referenciaTipo,
    referenciaId: input.referenciaId,
    meta: input.meta,
    criadoPor: input.criadoPor,
    saldoApos: novo,
  })

  return { saldo: novo }
}

export async function listWalletMovements(carteiraId: string, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('sistema_carteira_lancamentos')
    .select('*')
    .eq('carteira_id', carteiraId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getCommissionBps() {
  const { data } = await supabaseAdmin
    .from('sistema_precos')
    .select('chave,valor_centavos')
    .in('chave', ['comissao_vendedor_bps', 'comissao_plataforma_bps'])
  const map = new Map((data || []).map((r: any) => [r.chave, Number(r.valor_centavos) || 0]))
  return {
    vendedorBps: map.get('comissao_vendedor_bps') ?? 1000,
    plataformaBps: map.get('comissao_plataforma_bps') ?? 500,
  }
}

/** Split de inscrição: bruto → vendedor + plataforma + líquido produtora. */
export function splitCommission(brutoCentavos: number, vendedorBps: number, plataformaBps: number) {
  const vendedor = Math.floor((brutoCentavos * Math.max(0, vendedorBps)) / 10000)
  const plataforma = Math.floor((brutoCentavos * Math.max(0, plataformaBps)) / 10000)
  const liquido = Math.max(0, brutoCentavos - vendedor - plataforma)
  return { vendedor, plataforma, liquido }
}
