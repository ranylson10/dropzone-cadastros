import { supabaseAdmin } from '../../shared/supabase-admin'
import {
  CATALOG_VERSION,
  CHAPTER_GROUP_LABELS,
  PERFIL_DESCRIPTIONS,
  PERFIL_LABELS,
} from './rulebook.chapters'
import { RULEBOOK_QUESTIONS } from './rulebook.catalog'
import { INFRACAO_TEMPLATES } from './rulebook.infracoes'
import {
  applyProfileDefaults,
  buildEngineState,
  questionsMetaForClient,
} from './rulebook.engine'
import { seedAnswersFromCampeonato } from './rulebook.seed'
import {
  loadCampeonatoConfig,
  mergeLinkedAnswers,
  syncCampeonatoFromRulebookAnswers,
} from './rulebook.sync'
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

async function getCampeonatoMeta(campeonatoId: string): Promise<{
  nome: string
  logoUrl: string | null
}> {
  const { data } = await supabaseAdmin
    .from('campeonatos')
    .select('nome, logo_url')
    .eq('id', campeonatoId)
    .maybeSingle()
  return {
    nome: String(data?.nome || 'Campeonato'),
    logoUrl: data?.logo_url ? String(data.logo_url) : null,
  }
}

async function getCampeonatoNome(campeonatoId: string): Promise<string> {
  const meta = await getCampeonatoMeta(campeonatoId)
  return meta.nome
}

async function loadCampeonatoSeedSource(campeonatoId: string) {
  return loadCampeonatoConfig(campeonatoId)
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
    chapterGroups: CHAPTER_GROUP_LABELS,
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
    const meta = await getCampeonatoMeta(campeonatoId)
    return buildRulebookResponse(normalizeRow(existing.data), meta.nome, {
      logoUrl: meta.logoUrl,
    })
  }

  const perfil: RulebookPerfil = input.perfil || 'comunitario'
  const campSource = await loadCampeonatoSeedSource(campeonatoId)
  const seeded = seedAnswersFromCampeonato(campSource, {})
  const respostas = applyProfileDefaults(perfil, seeded.respostas)
  const logoUrl = campSource.logo_url ? String(campSource.logo_url) : null
  const nome = String(campSource.nome || (await getCampeonatoNome(campeonatoId)) || 'Campeonato')
  const engine = buildEngineState({
    perfil,
    respostas,
    campeonatoNome: nome,
    logoUrl,
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
    logoUrl,
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
  const camp = await loadCampeonatoConfig(campeonatoId)
  const row = normalizeRow(data)
  // Campeonato é fonte da verdade nos campos ligados
  row.respostas = mergeLinkedAnswers(row.respostas, camp)
  const logoUrl = camp.logo_url ? String(camp.logo_url) : null
  return buildRulebookResponse(row, String(camp.nome || 'Campeonato'), {
    linkedFromCampeonato: true,
    logoUrl,
  })
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
  const campMeta = await getCampeonatoMeta(campeonatoId)
  const documento =
    row.documento && typeof row.documento === 'object'
      ? {
          ...row.documento,
          campeonatoNome:
            (row.documento as any).campeonatoNome || campMeta.nome,
          logoUrl: (row.documento as any).logoUrl || campMeta.logoUrl,
        }
      : row.documento
  return {
    documento,
    perfil: row.perfil,
    publicado_em: row.publicado_em,
    versao: row.versao,
    campeonato_id: row.campeonato_id,
  }
}

function buildRulebookResponse(
  row: RulebookRow,
  campeonatoNome = 'Campeonato',
  meta?: {
    seedCampos?: string[]
    seedAplicado?: boolean
    linkedFromCampeonato?: boolean
    logoUrl?: string | null
  },
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
    logoUrl: meta?.logoUrl ?? (row.documento as any)?.logoUrl ?? null,
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
      chapterGroups: CHAPTER_GROUP_LABELS as Record<string, string>,
    },
    meta: {
      seedAplicado: Boolean(meta?.seedAplicado),
      seedCampos: meta?.seedCampos || [],
      linkedFromCampeonato: Boolean(meta?.linkedFromCampeonato),
      linkedFields: [
        'possui_premiacao',
        'descricao_premiacao',
        'premiacao_total',
        'divisao_premiacao_json',
        'possui_taxa',
        'valor_taxa',
        'possui_transmissao',
        'plataforma',
        'emulador_proibido',
        'qtd_titulares',
        'permite_reservas',
        'qtd_reservas',
        'modalidade',
      ],
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

  // Sincroniza campos ligados de volta ao campeonato (premiação, taxa, etc.)
  if (input.payload.respostas) {
    await syncCampeonatoFromRulebookAnswers(input.campeonatoId, respostas)
  }

  // Re-lê campeonato após sync para manter engine alinhado
  const campAfter = await loadCampeonatoConfig(input.campeonatoId)
  const respostasFinais = mergeLinkedAnswers(respostas, campAfter)
  // Garante descrição da premiação coerente com a divisão estruturada
  if (respostasFinais.possui_premiacao === true && respostasFinais.divisao_premiacao_json) {
    const total = respostasFinais.premiacao_total
    const parts = [`Premiação total: ${String(total || '')}.`, 'Divisão:']
    try {
      const items = JSON.parse(String(respostasFinais.divisao_premiacao_json))
      if (Array.isArray(items)) {
        for (const it of items) {
          parts.push(`${it.nome}: R$ ${Number(it.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        }
      }
    } catch {
      // ignore
    }
    if (!respostasFinais.descricao_premiacao) {
      respostasFinais.descricao_premiacao = parts.join('\n')
    } else if (respostasFinais.divisao_premiacao_json) {
      respostasFinais.descricao_premiacao = parts.join('\n')
    }
  }

  const nome = String(campAfter.nome || (await getCampeonatoNome(input.campeonatoId)))
  const logoUrl = campAfter.logo_url ? String(campAfter.logo_url) : null
  const engine = buildEngineState({
    perfil,
    respostas: respostasFinais,
    infracoes,
    confirmacoes_alertas: confirmacoes,
    campeonatoNome: nome,
    logoUrl,
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
  return buildRulebookResponse(normalizeRow(data), nome, {
    linkedFromCampeonato: true,
    logoUrl,
  })
}

export async function publishRulebook(input: {
  campeonatoId: string
  userId: string
  forceConfirmAlerts?: Record<string, boolean>
}) {
  const campMeta = await getCampeonatoMeta(input.campeonatoId)
  const nome = campMeta.nome
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
    logoUrl: campMeta.logoUrl,
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

  return buildRulebookResponse(normalizeRow(data), nome, { logoUrl: campMeta.logoUrl })
}
