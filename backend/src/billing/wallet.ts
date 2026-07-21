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
  const { data, error } = await supabaseAdmin.rpc('fn_carteira_creditar', {
    p_dono_tipo: input.donoTipo,
    p_dono_id: input.donoId || null,
    p_auth_user_id: input.authUserId || null,
    p_valor_centavos: input.valorCentavos,
    p_tipo: input.tipo,
    p_descricao: input.descricao || null,
    p_referencia_tipo: input.referenciaTipo,
    p_referencia_id: input.referenciaId,
    p_meta: input.meta || {},
    p_criado_por: input.criadoPor || null,
  })
  if (error) throw error
  return data as { skipped: boolean; carteira_id?: string; saldo_disponivel_centavos?: number }
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
