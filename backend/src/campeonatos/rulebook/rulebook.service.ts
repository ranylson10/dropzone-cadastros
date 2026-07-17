import { supabaseAdmin } from '../../shared/supabase-admin'
import { CATALOG_VERSION, PERFIL_DESCRIPTIONS, PERFIL_LABELS } from './rulebook.chapters'
import { RULEBOOK_QUESTIONS } from './rulebook.catalog'
import { INFRACAO_TEMPLATES } from './rulebook.infracoes'
import {
  applyProfileDefaults,
  buildEngineState,
  questionsMetaForClient,
} from './rulebook.engine'
import { seedAnswersFromCampeonato } from './rulebook.seed'
import type {
  AnswersMap,
  InfracaoConfig,
  RulebookPerfil,
  RulebookRow,
  RulebookSaveInput,
  RulebookStatus,
} from './rulebook.types'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

async function getCampeonatoNome(campeonatoId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('campeonatos')
    .select('nome')
    .eq('id', campeonatoId)
    .maybeSingle()
  return String(data?.nome || 'Campeonato')
}

async function loadCampeonatoSeedSource(campeonatoId: string) {
  const { data: camp } = await supabaseAdmin
    .from('campeonatos')
    .select('*')
    .eq('id', campeonatoId)
    .maybeSingle()

  let config: Record<string, unknown> = {}
  try {
    const { data: cfg } = await supabaseAdmin
      .from('campeonato_configuracoes')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (cfg && typeof cfg === 'object') config = cfg as Record<string, unknown>
  } catch {
    // tabela opcional
  }

  return { ...(camp || {}), ...config }
}

function normalizeRow(raw: any): RulebookRow {
  return {
    id: raw.id,
    campeonato_id: raw.campeonato_id,
    perfil: raw.perfil,
    etapa_atual: Number(raw.etapa_atual || 0),
    respostas: (raw.respostas && typeof raw.respostas === 'object' ? raw.respostas : {}) as AnswersMap,
    modules_ativos: Array.isArray(raw.modules_ativos) ? raw.modules_ativos.map(String) : [],
    infracoes: Array.isArray(raw.infracoes) ? raw.infracoes : [],
    alertas: Array.isArray(raw.alertas) ? raw.alertas : [],
    confirmacoes_alertas:
      raw.confirmacoes_alertas && typeof raw.confirmacoes_alertas === 'object'
        ? raw.confirmacoes_alertas
        : {},
    documento: raw.documento && typeof raw.documento === 'object' ? raw.documento : {},
    status: raw.status || 'rascunho',
    catalog_version: raw.catalog_version || CATALOG_VERSION,
    versao: Number(raw.versao || 1),
    publicado_em: raw.publicado_em || null,
    criado_por: raw.criado_por || null,
    atualizado_por: raw.atualizado_por || null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

export function getRulebookCatalogPublic() {
  return {
    version: CATALOG_VERSION,
    perfis: (Object.keys(PERFIL_LABELS) as RulebookPerfil[]).map((id) => ({
      id,
      label: PERFIL_LABELS[id],
      description: PERFIL_DESCRIPTIONS[id],
    })),
    questions: RULEBOOK_QUESTIONS,
    infracaoTemplates: INFRACAO_TEMPLATES,
  }
}

export async function getOrCreateRulebook(input: {
  campeonatoId: string
  userId: string
  perfil?: RulebookPerfil
}) {
  const { campeonatoId, userId } = input

  const existing = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()

  if (existing.error && missingRelation(existing.error)) {
    throw new Error(
      'Tabela campeonato_rulebooks não encontrada. Execute a migration 20260717_campeonato_rulebook.sql no Supabase.',
    )
  }
  if (existing.error) throw new Error(existing.error.message)

  if (existing.data) {
    const nome = await getCampeonatoNome(campeonatoId)
    return buildRulebookResponse(normalizeRow(existing.data), nome)
  }

  const perfil: RulebookPerfil = input.perfil || 'comunitario'
  const campSource = await loadCampeonatoSeedSource(campeonatoId)
  const seeded = seedAnswersFromCampeonato(campSource, {})
  const respostas = applyProfileDefaults(perfil, seeded.respostas)
  const nome = String(campSource.nome || (await getCampeonatoNome(campeonatoId)) || 'Campeonato')
  const engine = buildEngineState({
    perfil,
    respostas,
    campeonatoNome: nome,
  })

  const insertPayload = {
    campeonato_id: campeonatoId,
    perfil,
    etapa_atual: 0,
    respostas: engine.respostas,
    modules_ativos: engine.modules,
    infracoes: engine.infracoes,
    alertas: engine.alerts,
    confirmacoes_alertas: {},
    documento: engine.documento,
    status: engine.alerts.some((a) => a.severity === 'blocking')
      ? 'bloqueado_alertas'
      : 'rascunho',
    catalog_version: CATALOG_VERSION,
    versao: 1,
    criado_por: userId,
    atualizado_por: userId,
  }

  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return buildRulebookResponse(normalizeRow(data), nome, {
    seedCampos: seeded.campos,
    seedAplicado: seeded.campos.length > 0,
  })
}

export async function getRulebook(campeonatoId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()

  if (error && missingRelation(error)) {
    throw new Error(
      'Tabela campeonato_rulebooks não encontrada. Execute a migration 20260717_campeonato_rulebook.sql no Supabase.',
    )
  }
  if (error) throw new Error(error.message)
  if (!data) return null
  const nome = await getCampeonatoNome(campeonatoId)
  return buildRulebookResponse(normalizeRow(data), nome)
}

export async function getPublishedRulebook(campeonatoId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'publicado')
    .maybeSingle()

  if (error && missingRelation(error)) {
    throw new Error(
      'Tabela campeonato_rulebooks não encontrada. Execute a migration 20260717_campeonato_rulebook.sql no Supabase.',
    )
  }
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = normalizeRow(data)
  return {
    documento: row.documento,
    perfil: row.perfil,
    publicado_em: row.publicado_em,
    versao: row.versao,
    campeonato_id: row.campeonato_id,
  }
}

function buildRulebookResponse(
  row: RulebookRow,
  campeonatoNome = 'Campeonato',
  meta?: { seedCampos?: string[]; seedAplicado?: boolean },
) {
  const engine = buildEngineState({
    perfil: row.perfil,
    respostas: row.respostas,
    infracoes: row.infracoes as InfracaoConfig[],
    confirmacoes_alertas: row.confirmacoes_alertas,
    campeonatoNome:
      campeonatoNome
      || (row.documento as any)?.campeonatoNome
      || 'Campeonato',
  })

  // Prefer regenerated live state for UI accuracy; document from engine
  const questions = questionsMetaForClient(row.perfil, engine.respostas)

  const answeredRequired = questions.allVisible.filter((q) => {
    if (!q.required) return true
    const v = engine.respostas[q.id]
    if (v === undefined || v === null || v === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  }).length
  const totalRequired = questions.allVisible.filter((q) => q.required).length

  return {
    rulebook: {
      ...row,
      respostas: engine.respostas,
      modules_ativos: engine.modules,
      infracoes: engine.infracoes,
      alertas: engine.alerts,
      documento: engine.documento,
      status: row.status,
    },
    engine: {
      canPublish: engine.canPublish,
      modules: engine.modules,
      alerts: engine.alerts,
      progress: {
        answeredRequired,
        totalRequired,
        percent:
          totalRequired > 0
            ? Math.round((answeredRequired / totalRequired) * 100)
            : 0,
      },
    },
    questions,
    catalog: {
      version: CATALOG_VERSION,
      perfis: (Object.keys(PERFIL_LABELS) as RulebookPerfil[]).map((id) => ({
        id,
        label: PERFIL_LABELS[id],
        description: PERFIL_DESCRIPTIONS[id],
      })),
    },
    meta: {
      seedAplicado: Boolean(meta?.seedAplicado),
      seedCampos: meta?.seedCampos || [],
    },
  }
}

export async function saveRulebook(input: {
  campeonatoId: string
  userId: string
  payload: RulebookSaveInput
}) {
  const current = await getRulebook(input.campeonatoId)
  if (!current) {
    await getOrCreateRulebook({
      campeonatoId: input.campeonatoId,
      userId: input.userId,
      perfil: input.payload.perfil,
    })
  }

  const { data: rowRaw, error: fetchError } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .select('*')
    .eq('campeonato_id', input.campeonatoId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  const row = normalizeRow(rowRaw)

  let perfil = input.payload.perfil || row.perfil
  let respostas: AnswersMap = {
    ...row.respostas,
    ...(input.payload.respostas || {}),
  }

  // Ao trocar perfil, reaplica defaults apenas para chaves ainda vazias (exceto personalizado limpa defaults não respondidos)
  if (input.payload.perfil && input.payload.perfil !== row.perfil) {
    if (input.payload.perfil === 'personalizado') {
      respostas = { ...(input.payload.respostas || row.respostas) }
    } else {
      respostas = applyProfileDefaults(input.payload.perfil, {
        ...(input.payload.respostas || row.respostas),
      })
    }
    perfil = input.payload.perfil
  } else {
    respostas = applyProfileDefaults(perfil, respostas)
  }

  const infracoes =
    input.payload.infracoes !== undefined
      ? input.payload.infracoes
      : (row.infracoes as InfracaoConfig[])

  const confirmacoes =
    input.payload.confirmacoes_alertas !== undefined
      ? input.payload.confirmacoes_alertas
      : row.confirmacoes_alertas

  const nome = await getCampeonatoNome(input.campeonatoId)
  const engine = buildEngineState({
    perfil,
    respostas,
    infracoes,
    confirmacoes_alertas: confirmacoes,
    campeonatoNome: nome,
  })

  const etapa =
    input.payload.etapa_atual !== undefined
      ? input.payload.etapa_atual
      : row.etapa_atual

  let status: RulebookStatus = row.status === 'publicado' ? 'em_revisao' : row.status
  if (engine.alerts.some((a) => a.severity === 'blocking') && !engine.canPublish) {
    status = 'bloqueado_alertas'
  } else if (status === 'bloqueado_alertas') {
    status = 'rascunho'
  }
  if (row.status === 'publicado' && input.payload.respostas) {
    status = 'em_revisao'
  }

  const updatePayload = {
    perfil,
    etapa_atual: etapa,
    respostas: engine.respostas,
    modules_ativos: engine.modules,
    infracoes: engine.infracoes,
    alertas: engine.alerts,
    confirmacoes_alertas: confirmacoes,
    documento: engine.documento,
    status,
    catalog_version: CATALOG_VERSION,
    versao: row.status === 'publicado' ? row.versao + 1 : row.versao,
    atualizado_por: input.userId,
    publicado_em: row.publicado_em,
  }

  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .update(updatePayload)
    .eq('campeonato_id', input.campeonatoId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return buildRulebookResponse(normalizeRow(data), nome)
}

export async function publishRulebook(input: {
  campeonatoId: string
  userId: string
  forceConfirmAlerts?: Record<string, boolean>
}) {
  const nome = await getCampeonatoNome(input.campeonatoId)
  const current = await getRulebook(input.campeonatoId)
  if (!current) {
    throw new Error('Rulebook ainda não foi criado para este campeonato.')
  }

  const confirmacoes = {
    ...current.rulebook.confirmacoes_alertas,
    ...(input.forceConfirmAlerts || {}),
  }

  const engine = buildEngineState({
    perfil: current.rulebook.perfil,
    respostas: current.rulebook.respostas,
    infracoes: current.rulebook.infracoes as InfracaoConfig[],
    confirmacoes_alertas: confirmacoes,
    campeonatoNome: nome,
  })

  if (!engine.canPublish) {
    const msgs = engine.alerts
      .filter((a) => a.severity === 'blocking')
      .map((a) => a.message)
    throw new Error(
      `Não é possível publicar o regulamento. Resolva os alertas: ${msgs.join(' | ')}`,
    )
  }

  const { data, error } = await supabaseAdmin
    .from('campeonato_rulebooks')
    .update({
      respostas: engine.respostas,
      modules_ativos: engine.modules,
      infracoes: engine.infracoes,
      alertas: engine.alerts,
      confirmacoes_alertas: confirmacoes,
      documento: engine.documento,
      status: 'publicado',
      publicado_em: new Date().toISOString(),
      atualizado_por: input.userId,
      catalog_version: CATALOG_VERSION,
    })
    .eq('campeonato_id', input.campeonatoId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  // Espelha URL pública no campo regras_url do campeonato (best-effort)
  try {
    await supabaseAdmin
      .from('campeonatos')
      .update({
        regras_url: `/campeonatos/${input.campeonatoId}/regulamento`,
      })
      .eq('id', input.campeonatoId)
  } catch {
    // ignore
  }

  return buildRulebookResponse(normalizeRow(data), nome)
}
