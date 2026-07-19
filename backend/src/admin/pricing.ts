import { supabaseAdmin } from '../shared/supabase-admin'

export type PricingFeatureFlags = {
  export?: boolean
  stream?: boolean
  rulebook?: boolean
  stats?: boolean
  broadcast?: boolean
}

export type PriceLine = {
  chave: string
  rotulo: string
  valor_centavos: number
  qtd?: number
}

export type PriceQuote = {
  tipo: string
  numero_vagas: number
  recursos: Required<PricingFeatureFlags>
  linhas: PriceLine[]
  valor_base_centavos: number
  valor_vagas_centavos: number
  valor_recursos_centavos: number
  valor_total_centavos: number
  valor_total_brl: string
}

const TIPO_BASE: Record<string, string> = {
  diario: 'base_diario',
  copa: 'base_copa',
  liga: 'base_liga',
  xtreino: 'base_xtreino',
  confronto: 'base_confronto',
}

const FEATURE_KEYS: Array<{ flag: keyof PricingFeatureFlags; chave: string }> = [
  { flag: 'export', chave: 'rec_export' },
  { flag: 'stream', chave: 'rec_stream' },
  { flag: 'rulebook', chave: 'rec_rulebook' },
  { flag: 'stats', chave: 'rec_stats' },
  { flag: 'broadcast', chave: 'rec_broadcast' },
]

function moneyBRL(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
}

function normalizeTipo(raw: unknown) {
  const t = String(raw || 'copa').toLowerCase().trim()
  if (TIPO_BASE[t]) return t
  return 'copa'
}

export async function loadPriceTable() {
  const { data, error } = await supabaseAdmin
    .from('sistema_precos')
    .select('chave,rotulo,descricao,categoria,valor_centavos,meta,ativo')
    .order('categoria')
    .order('chave')
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return [] as any[]
    throw error
  }
  return data || []
}

export async function quoteChampionshipPrice(input: {
  tipo?: string
  numero_vagas?: number
  recursos?: PricingFeatureFlags
}): Promise<PriceQuote> {
  const tipo = normalizeTipo(input.tipo)
  const numero_vagas = Math.max(0, Math.min(256, Math.floor(Number(input.numero_vagas) || 0)))
  const recursos: Required<PricingFeatureFlags> = {
    export: Boolean(input.recursos?.export),
    stream: Boolean(input.recursos?.stream),
    rulebook: Boolean(input.recursos?.rulebook),
    stats: Boolean(input.recursos?.stats),
    broadcast: Boolean(input.recursos?.broadcast),
  }

  const table = await loadPriceTable()
  const byKey = new Map(table.filter((r: any) => r.ativo !== false).map((r: any) => [r.chave, r]))

  const linhas: PriceLine[] = []
  let valor_base_centavos = 0
  let valor_vagas_centavos = 0
  let valor_recursos_centavos = 0

  const baseKey = TIPO_BASE[tipo]
  const baseRow = byKey.get(baseKey)
  if (baseRow) {
    valor_base_centavos = Number(baseRow.valor_centavos) || 0
    linhas.push({
      chave: baseKey,
      rotulo: baseRow.rotulo || baseKey,
      valor_centavos: valor_base_centavos,
      qtd: 1,
    })
  }

  const porVaga = Number(byKey.get('por_vaga')?.valor_centavos) || 0
  const porVagaExtra = Number(byKey.get('por_vaga_extra')?.valor_centavos) || porVaga
  const limite = 12
  if (numero_vagas > 0) {
    const ate = Math.min(numero_vagas, limite)
    const acima = Math.max(0, numero_vagas - limite)
    if (ate > 0 && porVaga > 0) {
      const sub = ate * porVaga
      valor_vagas_centavos += sub
      linhas.push({
        chave: 'por_vaga',
        rotulo: byKey.get('por_vaga')?.rotulo || 'Por vaga',
        valor_centavos: sub,
        qtd: ate,
      })
    }
    if (acima > 0 && porVagaExtra > 0) {
      const sub = acima * porVagaExtra
      valor_vagas_centavos += sub
      linhas.push({
        chave: 'por_vaga_extra',
        rotulo: byKey.get('por_vaga_extra')?.rotulo || 'Por vaga extra',
        valor_centavos: sub,
        qtd: acima,
      })
    }
  }

  for (const feat of FEATURE_KEYS) {
    if (!recursos[feat.flag]) continue
    const row = byKey.get(feat.chave)
    if (!row) continue
    const v = Number(row.valor_centavos) || 0
    valor_recursos_centavos += v
    linhas.push({
      chave: feat.chave,
      rotulo: row.rotulo || feat.chave,
      valor_centavos: v,
      qtd: 1,
    })
  }

  const valor_total_centavos = valor_base_centavos + valor_vagas_centavos + valor_recursos_centavos

  return {
    tipo,
    numero_vagas,
    recursos,
    linhas,
    valor_base_centavos,
    valor_vagas_centavos,
    valor_recursos_centavos,
    valor_total_centavos,
    valor_total_brl: moneyBRL(valor_total_centavos),
  }
}

export async function saveChampionshipBilling(
  campeonatoId: string,
  quote: PriceQuote,
  opts?: { status?: string; observacao?: string; userId?: string },
) {
  const row = {
    campeonato_id: campeonatoId,
    valor_base_centavos: quote.valor_base_centavos,
    valor_vagas_centavos: quote.valor_vagas_centavos,
    valor_recursos_centavos: quote.valor_recursos_centavos,
    valor_total_centavos: quote.valor_total_centavos,
    breakdown: quote.linhas,
    recursos: quote.recursos,
    numero_vagas: quote.numero_vagas,
    tipo_campeonato: quote.tipo,
    status: opts?.status || 'pendente',
    observacao: opts?.observacao || null,
    atualizado_por: opts?.userId || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin
    .from('campeonato_cobranca')
    .upsert(row, { onConflict: 'campeonato_id' })
  if (error) {
    // tabela ainda não migrada — não quebra criação do campeonato
    if (['42P01', 'PGRST205', '42703'].includes(error.code || '')) return null
    throw error
  }
  return row
}
