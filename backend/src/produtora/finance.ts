import { supabaseAdmin } from '../shared/supabase-admin'
import { requireProducerWorkspaceAccess } from './workspace-access'

export type ProducerFinanceEntryType = 'receita' | 'despesa'
export type ProducerFinanceEntryStatus = 'previsto' | 'realizado' | 'cancelado'

export const PRODUCER_FINANCE_CATEGORIES = new Set([
  'patrocinio',
  'premiacao',
  'design',
  'narracao',
  'servidor',
  'producao',
  'marketing',
  'plataforma',
  'equipe',
  'viagem',
  'imposto',
  'taxa',
  'outros',
])

function cents(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function quantityFromMeta(meta: any) {
  const parsed = Number(meta?.quantidade_vagas || 1)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.floor(parsed))
}

function normalizePeriod(value?: string | null) {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 7)
}

function periodBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return {
    period,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function percentage(value: number, target: number) {
  if (target <= 0) return 0
  return Math.max(0, Math.round((value / target) * 1000) / 10)
}

function margin(profit: number, netRevenue: number) {
  if (netRevenue <= 0) return 0
  return Math.round((profit / netRevenue) * 1000) / 10
}

async function ensureChampionship(produtoraId: string, campeonatoId?: string | null) {
  if (!campeonatoId) return null
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,produtora_id')
    .eq('id', campeonatoId)
    .eq('produtora_id', produtoraId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Campeonato não pertence a esta produtora.')
  return data
}

export async function loadProducerFinanceSummary(input: {
  authUserId: string
  produtoraId: string
  period?: string | null
  campeonatoId?: string | null
}) {
  await requireProducerWorkspaceAccess(input.authUserId, input.produtoraId, 'financeiro')
  const bounds = periodBounds(normalizePeriod(input.period))
  const selectedChampionship = await ensureChampionship(input.produtoraId, input.campeonatoId)

  let championshipQuery = supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,status,aprovacao_status,created_at')
    .eq('produtora_id', input.produtoraId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (selectedChampionship) championshipQuery = championshipQuery.eq('id', selectedChampionship.id)

  const { data: championships, error: championshipError } = await championshipQuery
  if (championshipError) throw championshipError
  const championshipIds = (championships || []).map((item: any) => String(item.id))
  const emptyRows = Promise.resolve({ data: [] as any[], error: null as any })
  const [configsResult, commissionsResult, entriesResult, goalResult, purchasesResult] = await Promise.all([
    championshipIds.length
      ? supabaseAdmin
        .from('campeonato_configuracoes')
        .select('campeonato_id,premiacao,numero_vagas,valor_inscricao')
        .in('campeonato_id', championshipIds)
      : emptyRows,
    championshipIds.length
      ? supabaseAdmin
        .from('sistema_comissoes')
        .select('id,campeonato_id,vendedor_manager_id,valor_bruto_centavos,comissao_vendedor_centavos,comissao_plataforma_centavos,valor_liquido_produtora_centavos,status,meta,created_at')
        .in('campeonato_id', championshipIds)
      : emptyRows,
    supabaseAdmin
      .from('produtora_financeiro_lancamentos')
      .select('*')
      .eq('produtora_id', input.produtoraId)
      .gte('data_competencia', bounds.startDate)
      .lt('data_competencia', bounds.endDate)
      .order('data_competencia', { ascending: false })
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('produtora_financeiro_metas')
      .select('*')
      .eq('produtora_id', input.produtoraId)
      .eq('competencia', `${bounds.period}-01`)
      .maybeSingle(),
    championshipIds.length
      ? supabaseAdmin
        .from('sistema_compras_vaga')
        .select('id,campeonato_id,pagamento_id,valor_centavos,status,expira_em,meta,created_at')
        .in('campeonato_id', championshipIds)
        .eq('status', 'pendente')
      : emptyRows,
  ])

  if (configsResult.error) throw configsResult.error
  if (commissionsResult.error) throw commissionsResult.error
  if (entriesResult.error) throw entriesResult.error
  if (goalResult.error && !['PGRST116'].includes(goalResult.error.code || '')) throw goalResult.error
  if (purchasesResult.error) throw purchasesResult.error

  const configs = configsResult.data || []
  const allCommissions = (commissionsResult.data || []).filter((row: any) => row.status === 'creditada')
  const periodStartMs = new Date(bounds.startIso).getTime()
  const periodEndMs = new Date(bounds.endIso).getTime()
  const periodCommissions = allCommissions.filter((row: any) => {
    const createdMs = new Date(row.created_at || 0).getTime()
    return Number.isFinite(createdMs) && createdMs >= periodStartMs && createdMs < periodEndMs
  })
  const entries = (entriesResult.data || []).filter((row: any) => !selectedChampionship || row.campeonato_id === selectedChampionship.id)
  const realizedEntries = entries.filter((row: any) => row.status === 'realizado')
  const plannedEntries = entries.filter((row: any) => row.status === 'previsto')
  const manualRevenue = realizedEntries
    .filter((row: any) => row.tipo === 'receita')
    .reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)
  const manualExpenses = realizedEntries
    .filter((row: any) => row.tipo === 'despesa')
    .reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)
  const plannedRevenue = plannedEntries
    .filter((row: any) => row.tipo === 'receita')
    .reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)
  const plannedExpenses = plannedEntries
    .filter((row: any) => row.tipo === 'despesa')
    .reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)

  const grossSales = periodCommissions.reduce((sum: number, row: any) => sum + cents(row.valor_bruto_centavos), 0)
  const netSales = periodCommissions.reduce((sum: number, row: any) => sum + cents(row.valor_liquido_produtora_centavos), 0)
  const sellerCommission = periodCommissions.reduce((sum: number, row: any) => sum + cents(row.comissao_vendedor_centavos), 0)
  const platformFee = periodCommissions.reduce((sum: number, row: any) => sum + cents(row.comissao_plataforma_centavos), 0)
  const soldSeats = periodCommissions.reduce((sum: number, row: any) => sum + quantityFromMeta(row.meta), 0)
  const grossRevenue = grossSales + manualRevenue
  const netRevenue = netSales + manualRevenue
  const estimatedProfit = netRevenue - manualExpenses
  const projectedProfit = netRevenue + plannedRevenue - manualExpenses - plannedExpenses
  const ticketAverage = soldSeats > 0 ? Math.round(grossSales / soldSeats) : 0
  const prizeCommitment = configs.reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.premiacao || 0) * 100)), 0)

  const pendingPurchases = (purchasesResult.data || []).filter((row: any) => !selectedChampionship || row.campeonato_id === selectedChampionship.id)
  const pendingPaymentIds = Array.from(new Set(pendingPurchases.map((row: any) => row.pagamento_id).filter(Boolean).map(String)))
  const pendingPaymentMap = new Map<string, any>()
  if (pendingPaymentIds.length) {
    const { data: pendingPayments, error: pendingPaymentError } = await supabaseAdmin
      .from('sistema_pagamentos')
      .select('id,status,valor_centavos,created_at')
      .in('id', pendingPaymentIds)
      .in('status', ['pendente', 'aguardando'])
    if (pendingPaymentError) throw pendingPaymentError
    for (const payment of pendingPayments || []) pendingPaymentMap.set(String(payment.id), payment)
  }
  const activeReceivables = pendingPurchases.filter((row: any) => row.pagamento_id && pendingPaymentMap.has(String(row.pagamento_id)))
  const receivablesAmount = activeReceivables.reduce((sum: number, row: any) => {
    const payment = pendingPaymentMap.get(String(row.pagamento_id))
    return sum + cents(payment?.valor_centavos ?? row.valor_centavos)
  }, 0)

  const configByChamp = new Map(configs.map((row: any) => [String(row.campeonato_id), row]))
  const periodCommissionByChamp = new Map<string, any[]>()
  const allCommissionByChamp = new Map<string, any[]>()
  for (const row of allCommissions) {
    const key = String(row.campeonato_id || '')
    allCommissionByChamp.set(key, [...(allCommissionByChamp.get(key) || []), row])
  }
  for (const row of periodCommissions) {
    const key = String(row.campeonato_id || '')
    periodCommissionByChamp.set(key, [...(periodCommissionByChamp.get(key) || []), row])
  }

  const championshipFinance = (championships || []).map((champ: any) => {
    const rows = periodCommissionByChamp.get(String(champ.id)) || []
    const allRows = allCommissionByChamp.get(String(champ.id)) || []
    const champEntries = entries.filter((row: any) => row.campeonato_id === champ.id && row.status === 'realizado')
    const manualIncome = champEntries.filter((row: any) => row.tipo === 'receita').reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)
    const costs = champEntries.filter((row: any) => row.tipo === 'despesa').reduce((sum: number, row: any) => sum + cents(row.valor_centavos), 0)
    const gross = rows.reduce((sum: number, row: any) => sum + cents(row.valor_bruto_centavos), 0) + manualIncome
    const net = rows.reduce((sum: number, row: any) => sum + cents(row.valor_liquido_produtora_centavos), 0) + manualIncome
    const soldPeriod = rows.reduce((sum: number, row: any) => sum + quantityFromMeta(row.meta), 0)
    const soldTotal = allRows.reduce((sum: number, row: any) => sum + quantityFromMeta(row.meta), 0)
    const config: any = configByChamp.get(String(champ.id)) || {}
    const capacity = Math.max(0, Number(config.numero_vagas || 0))
    return {
      id: champ.id,
      nome: champ.nome,
      logo_url: champ.logo_url || null,
      status: champ.status,
      aprovacao_status: champ.aprovacao_status,
      receita_bruta_centavos: gross,
      receita_liquida_centavos: net,
      despesas_centavos: costs,
      lucro_estimado_centavos: net - costs,
      premiacao_centavos: Math.max(0, Math.round(Number(config.premiacao || 0) * 100)),
      valor_inscricao_centavos: Math.max(0, Math.round(Number(config.valor_inscricao || 0) * 100)),
      vagas_vendidas_periodo: soldPeriod,
      vagas_vendidas_total: soldTotal,
      vagas_total: capacity,
      ocupacao_percentual: capacity > 0 ? percentage(soldTotal, capacity) : 0,
    }
  })

  const managerIds = Array.from(new Set(periodCommissions.map((row: any) => row.vendedor_manager_id).filter(Boolean).map(String)))
  const managerMap = new Map<string, any>()
  if (managerIds.length) {
    const { data: managers, error } = await supabaseAdmin
      .from('managers')
      .select('id,nome,username,avatar_url')
      .in('id', managerIds)
    if (error) throw error
    for (const manager of managers || []) managerMap.set(String(manager.id), manager)
  }
  const sellerMap = new Map<string, { manager_id: string; nome: string; vendas: number; vagas: number; bruto: number; comissao: number }>()
  for (const row of periodCommissions) {
    if (!row.vendedor_manager_id) continue
    const id = String(row.vendedor_manager_id)
    const manager = managerMap.get(id) || {}
    const current = sellerMap.get(id) || {
      manager_id: id,
      nome: String(manager.nome || manager.username || 'Vendedor'),
      vendas: 0,
      vagas: 0,
      bruto: 0,
      comissao: 0,
    }
    current.vendas += 1
    current.vagas += quantityFromMeta(row.meta)
    current.bruto += cents(row.valor_bruto_centavos)
    current.comissao += cents(row.comissao_vendedor_centavos)
    sellerMap.set(id, current)
  }

  const goal: any = goalResult.data || null
  const goalRevenue = cents(goal?.meta_receita_centavos)
  const goalProfit = cents(goal?.meta_lucro_centavos)
  const goalSeats = Math.max(0, Number(goal?.meta_vagas || 0))

  return {
    resumo: {
      periodo: bounds.period,
      inicio: bounds.startDate,
      fim_exclusivo: bounds.endDate,
      receita_bruta_centavos: grossRevenue,
      receita_liquida_centavos: netRevenue,
      receitas_manuais_centavos: manualRevenue,
      despesas_centavos: manualExpenses,
      receitas_previstas_centavos: plannedRevenue,
      despesas_previstas_centavos: plannedExpenses,
      lucro_estimado_centavos: estimatedProfit,
      lucro_projetado_centavos: projectedProfit,
      margem_percentual: margin(estimatedProfit, netRevenue),
      comissao_vendedores_centavos: sellerCommission,
      taxa_plataforma_centavos: platformFee,
      recebiveis_centavos: receivablesAmount,
      recebiveis_quantidade: activeReceivables.length,
      vagas_vendidas: soldSeats,
      ticket_medio_centavos: ticketAverage,
      premiacao_comprometida_centavos: prizeCommitment,
      meta_receita_centavos: goalRevenue,
      meta_lucro_centavos: goalProfit,
      meta_vagas: goalSeats,
      progresso_meta_receita_percentual: percentage(grossRevenue, goalRevenue),
      progresso_meta_lucro_percentual: percentage(Math.max(0, estimatedProfit), goalProfit),
      progresso_meta_vagas_percentual: percentage(soldSeats, goalSeats),
    },
    meta: goal,
    campeonatos: championshipFinance,
    lancamentos: entries,
    vendedores: Array.from(sellerMap.values()).sort((a, b) => b.bruto - a.bruto),
  }
}

export async function saveProducerFinanceGoal(input: {
  authUserId: string
  produtoraId: string
  period?: string | null
  metaReceitaCentavos?: unknown
  metaLucroCentavos?: unknown
  metaVagas?: unknown
}) {
  await requireProducerWorkspaceAccess(input.authUserId, input.produtoraId, 'financeiro')
  const period = normalizePeriod(input.period)
  const payload = {
    produtora_id: input.produtoraId,
    competencia: `${period}-01`,
    meta_receita_centavos: Math.max(0, cents(input.metaReceitaCentavos)),
    meta_lucro_centavos: Math.max(0, cents(input.metaLucroCentavos)),
    meta_vagas: Math.max(0, Math.floor(Number(input.metaVagas || 0))),
    criado_por_auth_user_id: input.authUserId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin
    .from('produtora_financeiro_metas')
    .upsert(payload, { onConflict: 'produtora_id,competencia' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createProducerFinanceEntry(input: {
  authUserId: string
  produtoraId: string
  campeonatoId?: string | null
  tipo?: string | null
  categoria?: string | null
  descricao?: string | null
  valorCentavos?: unknown
  dataCompetencia?: string | null
  status?: string | null
  observacao?: string | null
}) {
  await requireProducerWorkspaceAccess(input.authUserId, input.produtoraId, 'financeiro')
  await ensureChampionship(input.produtoraId, input.campeonatoId)
  const tipo = String(input.tipo || '').trim() as ProducerFinanceEntryType
  const categoria = String(input.categoria || '').trim()
  const status = String(input.status || 'realizado').trim() as ProducerFinanceEntryStatus
  const descricao = String(input.descricao || '').trim()
  const valorCentavos = cents(input.valorCentavos)
  const dataCompetencia = String(input.dataCompetencia || new Date().toISOString().slice(0, 10)).trim()
  if (!['receita', 'despesa'].includes(tipo)) throw new Error('Tipo de lançamento inválido.')
  if (!PRODUCER_FINANCE_CATEGORIES.has(categoria)) throw new Error('Categoria financeira inválida.')
  if (!['previsto', 'realizado', 'cancelado'].includes(status)) throw new Error('Status financeiro inválido.')
  if (!descricao) throw new Error('Informe uma descrição para o lançamento.')
  if (valorCentavos <= 0) throw new Error('O valor do lançamento deve ser maior que zero.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompetencia)) throw new Error('Data de competência inválida.')

  const { data, error } = await supabaseAdmin
    .from('produtora_financeiro_lancamentos')
    .insert({
      produtora_id: input.produtoraId,
      campeonato_id: input.campeonatoId || null,
      tipo,
      categoria,
      descricao,
      valor_centavos: valorCentavos,
      data_competencia: dataCompetencia,
      status,
      observacao: String(input.observacao || '').trim() || null,
      criado_por_auth_user_id: input.authUserId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateProducerFinanceEntry(input: {
  authUserId: string
  produtoraId: string
  entryId: string
  campeonatoId?: string | null
  tipo?: string | null
  categoria?: string | null
  descricao?: string | null
  valorCentavos?: unknown
  dataCompetencia?: string | null
  status?: string | null
  observacao?: string | null
}) {
  await requireProducerWorkspaceAccess(input.authUserId, input.produtoraId, 'financeiro')
  await ensureChampionship(input.produtoraId, input.campeonatoId)
  const tipo = String(input.tipo || '').trim() as ProducerFinanceEntryType
  const categoria = String(input.categoria || '').trim()
  const status = String(input.status || 'realizado').trim() as ProducerFinanceEntryStatus
  const descricao = String(input.descricao || '').trim()
  const valorCentavos = cents(input.valorCentavos)
  const dataCompetencia = String(input.dataCompetencia || '').trim()
  if (!input.entryId) throw new Error('Lançamento não informado.')
  if (!['receita', 'despesa'].includes(tipo)) throw new Error('Tipo de lançamento inválido.')
  if (!PRODUCER_FINANCE_CATEGORIES.has(categoria)) throw new Error('Categoria financeira inválida.')
  if (!['previsto', 'realizado', 'cancelado'].includes(status)) throw new Error('Status financeiro inválido.')
  if (!descricao || valorCentavos <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dataCompetencia)) throw new Error('Dados do lançamento incompletos.')

  const { data, error } = await supabaseAdmin
    .from('produtora_financeiro_lancamentos')
    .update({
      campeonato_id: input.campeonatoId || null,
      tipo,
      categoria,
      descricao,
      valor_centavos: valorCentavos,
      data_competencia: dataCompetencia,
      status,
      observacao: String(input.observacao || '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.entryId)
    .eq('produtora_id', input.produtoraId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Lançamento não encontrado.')
  return data
}

export async function deleteProducerFinanceEntry(input: {
  authUserId: string
  produtoraId: string
  entryId: string
}) {
  await requireProducerWorkspaceAccess(input.authUserId, input.produtoraId, 'financeiro')
  const { data, error } = await supabaseAdmin
    .from('produtora_financeiro_lancamentos')
    .delete()
    .eq('id', input.entryId)
    .eq('produtora_id', input.produtoraId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Lançamento não encontrado.')
  return data
}
