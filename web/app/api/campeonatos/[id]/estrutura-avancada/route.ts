import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, permissionPublicPayload } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes } from '@backend/campeonatos/estatisticas/estatisticas.service'

const MUTABLE_TABLES = new Set([
  'campeonato_divisoes',
  'campeonato_etapas',
  'campeonato_etapa_fontes',
  'campeonato_progressao_regras',
  'campeonato_etapa_premiacoes',
  'campeonato_diario_horarios',
  'campeonato_etapa_equipes',
  'campeonato_grupo_escolha_configuracoes',
])

function text(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max)
}

function nullableText(value: unknown, max = 500) {
  const result = text(value, max)
  return result || null
}

function positiveInt(value: unknown, nullable = true) {
  if (value === '' || value == null) return nullable ? null : 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('Valor inteiro inválido.')
  return parsed
}

function money(value: unknown) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Valor monetário inválido.')
  return parsed
}

async function loadStructure(campeonatoId: string) {
  const { data: edition, error: editionError } = await supabaseAdmin
    .from('campeonato_edicoes')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (editionError) throw editionError

  if (!edition) {
    const [{ data: dailyHours, error: dailyError }, { data: teams, error: teamsError }] = await Promise.all([
      supabaseAdmin.from('campeonato_diario_horarios').select('*').eq('campeonato_id', campeonatoId).order('horario'),
      supabaseAdmin.from('campeonato_equipes').select('id,nome_exibicao,equipe_id,line_id,status,equipes(nome,tag,logo_url),equipe_lines(nome,tag,logo_url)').eq('campeonato_id', campeonatoId).eq('status', 'ativo').order('created_at'),
    ])
    if (dailyError) throw dailyError
    if (teamsError) throw teamsError
    return { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: dailyHours || [], teams: teams || [], stageTeams: [], phases: [], groups: [], slots: [], groupChoiceConfigs: [], groupChoiceHistory: [], progressionExecutions: [], progressionExecutionItems: [] }
  }

  const [{ data: franchise, error: franchiseError }, divisionsResult, stagesResult, dailyResult, teamsResult, phasesResult, groupsResult, slotsResult, choiceConfigResult, choiceHistoryResult] = await Promise.all([
    supabaseAdmin.from('campeonato_franquias').select('*').eq('id', edition.franquia_id).maybeSingle(),
    supabaseAdmin.from('campeonato_divisoes').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_etapas').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_diario_horarios').select('*').eq('campeonato_id', campeonatoId).order('horario'),
    supabaseAdmin.from('campeonato_equipes').select('id,nome_exibicao,equipe_id,line_id,status,equipes(nome,tag,logo_url),equipe_lines(nome,tag,logo_url)').eq('campeonato_id', campeonatoId).eq('status', 'ativo').order('created_at'),
    supabaseAdmin.from('campeonato_fases').select('id,nome,ordem,status,etapa_id').eq('campeonato_id', campeonatoId).order('ordem'),
    supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id,slots,diario_horario_id').eq('campeonato_id', campeonatoId).order('nome'),
    supabaseAdmin.from('campeonato_slots').select('id,fase_id,grupo_id,slot_numero,slot_letra,status,equipe_id,line_id').eq('campeonato_id', campeonatoId).order('slot_numero'),
    supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').select('*').eq('campeonato_id', campeonatoId),
    supabaseAdmin.from('campeonato_grupo_escolha_historico').select('*').eq('campeonato_id', campeonatoId).order('created_at', { ascending: false }).limit(100),
  ])
  if (franchiseError) throw franchiseError
  if (divisionsResult.error) throw divisionsResult.error
  if (stagesResult.error) throw stagesResult.error
  if (dailyResult.error) throw dailyResult.error
  if (teamsResult.error) throw teamsResult.error
  if (phasesResult.error) throw phasesResult.error
  if (groupsResult.error) throw groupsResult.error
  if (slotsResult.error) throw slotsResult.error
  if (choiceConfigResult.error) throw choiceConfigResult.error
  if (choiceHistoryResult.error) throw choiceHistoryResult.error

  const stageIds = (stagesResult.data || []).map((row) => String(row.id))
  let sources: unknown[] = []
  let progressions: unknown[] = []
  let prizes: unknown[] = []
  let stageTeams: unknown[] = []
  let progressionExecutions: unknown[] = []
  let progressionExecutionItems: unknown[] = []
  if (stageIds.length) {
    const [sourcesResult, progressionsResult, prizesResult, stageTeamsResult, executionsResult] = await Promise.all([
      supabaseAdmin.from('campeonato_etapa_fontes').select('*').in('etapa_destino_id', stageIds).order('created_at'),
      supabaseAdmin.from('campeonato_progressao_regras').select('*').in('etapa_origem_id', stageIds).order('created_at'),
      supabaseAdmin.from('campeonato_etapa_premiacoes').select('*').in('etapa_id', stageIds).order('posicao'),
      supabaseAdmin.from('campeonato_etapa_equipes').select('*').in('etapa_id', stageIds).neq('status', 'retirada').order('created_at'),
      supabaseAdmin.from('campeonato_progressao_execucoes').select('*').eq('campeonato_id', campeonatoId).order('created_at', { ascending: false }).limit(30),
    ])
    if (sourcesResult.error) throw sourcesResult.error
    if (progressionsResult.error) throw progressionsResult.error
    if (prizesResult.error) throw prizesResult.error
    if (stageTeamsResult.error) throw stageTeamsResult.error
    if (executionsResult.error) throw executionsResult.error
    sources = sourcesResult.data || []
    progressions = progressionsResult.data || []
    prizes = prizesResult.data || []
    stageTeams = stageTeamsResult.data || []
    progressionExecutions = executionsResult.data || []
    const executionIds = (executionsResult.data || []).map((row: any) => String(row.id))
    if (executionIds.length) {
      const itemsResult = await supabaseAdmin.from('campeonato_progressao_execucao_itens').select('*').in('execucao_id', executionIds).order('posicao_origem')
      if (itemsResult.error) throw itemsResult.error
      progressionExecutionItems = itemsResult.data || []
    }
  }

  return {
    edition,
    franchise: franchise || null,
    divisions: divisionsResult.data || [],
    stages: stagesResult.data || [],
    sources,
    progressions,
    prizes,
    dailyHours: dailyResult.data || [],
    teams: teamsResult.data || [],
    stageTeams,
    phases: phasesResult.data || [],
    groups: groupsResult.data || [],
    slots: slotsResult.data || [],
    groupChoiceConfigs: choiceConfigResult.data || [],
    groupChoiceHistory: choiceHistoryResult.data || [],
    progressionExecutions,
    progressionExecutionItems,
  }
}

async function buildProgressionPreview(campeonatoId: string, ruleId: string) {
  const { data: rule, error: ruleError } = await supabaseAdmin
    .from('campeonato_progressao_regras')
    .select('*')
    .eq('id', ruleId)
    .maybeSingle()
  if (ruleError) throw ruleError
  if (!rule) throw new Error('Regra de progressão não encontrada.')
  if (!rule.etapa_destino_id) throw new Error('A regra não possui etapa de destino.')
  const [{ data: sourceStage, error: sourceStageError }, { data: destinationStage, error: destinationStageError }] = await Promise.all([
    supabaseAdmin.from('campeonato_etapas').select('id,nome,capacidade_total,campeonato_edicoes!inner(campeonato_id)').eq('id', rule.etapa_origem_id).maybeSingle(),
    supabaseAdmin.from('campeonato_etapas').select('id,nome,capacidade_total,campeonato_edicoes!inner(campeonato_id)').eq('id', rule.etapa_destino_id).maybeSingle(),
  ])
  if (sourceStageError) throw sourceStageError
  if (destinationStageError) throw destinationStageError
  const sourceChampionship = String((sourceStage as any)?.campeonato_edicoes?.campeonato_id || '')
  const destinationChampionship = String((destinationStage as any)?.campeonato_edicoes?.campeonato_id || '')
  if (!sourceStage || !destinationStage || sourceChampionship !== campeonatoId || destinationChampionship !== campeonatoId) throw new Error('Regra inválida para este campeonato.')

  const { data: phases, error: phasesError } = await supabaseAdmin
    .from('campeonato_fases')
    .select('id,nome,ordem')
    .eq('campeonato_id', campeonatoId)
    .eq('etapa_id', rule.etapa_origem_id)
    .order('ordem', { ascending: false })
  if (phasesError) throw phasesError
  const phase = phases?.[0] || null
  if (!phase) throw new Error('Vincule uma fase com resultados à etapa de origem.')

  const ranking = await listarEstatisticasEquipes(campeonatoId, { faseId: String(phase.id) })
  const start = Number(rule.posicao_inicio || 1)
  const endFromQuantity = rule.quantidade ? start + Number(rule.quantidade) - 1 : null
  const end = Number(rule.posicao_fim || endFromQuantity || start)
  const selected = ranking.filter((row: any) => Number(row.colocacao) >= start && Number(row.colocacao) <= end)

  const [{ data: destinationLinks, error: destinationError }, { data: activeExecutions, error: executionsError }] = await Promise.all([
    supabaseAdmin.from('campeonato_etapa_equipes').select('*').eq('etapa_id', rule.etapa_destino_id).neq('status', 'retirada'),
    supabaseAdmin.from('campeonato_progressao_execucoes').select('id,regra_id,status,created_at').eq('campeonato_id', campeonatoId).eq('regra_id', ruleId).eq('status', 'aplicada').order('created_at', { ascending: false }),
  ])
  if (destinationError) throw destinationError
  if (executionsError) throw executionsError
  const linksByTeam = new Map<string, any>((destinationLinks || []).map((row: any) => [String(row.campeonato_equipe_id), row]))
  const capacity = Number(destinationStage.capacidade_total || 0)
  const available = capacity ? Math.max(0, capacity - (destinationLinks || []).length) : Number.POSITIVE_INFINITY
  const candidates = selected.map((row: any) => {
    const existing = linksByTeam.get(String(row.campeonato_equipe_id)) as any
    const sameRule = existing && String(existing.regra_progressao_id || '') === ruleId
    return { ...row, alreadyApplied: Boolean(sameRule), conflict: Boolean(existing && !sameRule), existingDestination: existing || null }
  })
  const newCount = candidates.filter((row: any) => !row.alreadyApplied && !row.conflict).length
  // Contrato legado da 85D: canApply: newCount <= available
  const conflictCount = candidates.filter((row: any) => row.conflict).length
  return {
    rule: { ...rule, origem: sourceStage, destino: destinationStage }, phase, candidates,
    activeExecution: activeExecutions?.[0] || null,
    summary: { selected: candidates.length, newCount, conflictCount, alreadyApplied: candidates.filter((row: any) => row.alreadyApplied).length, capacity: capacity || null, occupied: (destinationLinks || []).length, available: Number.isFinite(available) ? available : null, canApply: newCount <= available && conflictCount === 0 },
  }
}

async function context(request: NextRequest, campeonatoId: string) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    throw new Error('UNAUTHORIZED')
  }

  let user: Awaited<ReturnType<typeof getBearerUser>>
  try {
    user = await getBearerUser(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Sessao ausente.' || message === 'Sessao invalida.') {
      throw new Error('UNAUTHORIZED')
    }
    throw error
  }

  const permission = await getCampeonatoPermission(user.id, campeonatoId)
  if (!permission.canView || permission.role === 'none') throw new Error('FORBIDDEN')
  return { user, permission }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { permission } = await context(request, id)
    const structure = await loadStructure(id)
    return NextResponse.json({ ok: true, permission: permissionPublicPayload(permission), ...structure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar estrutura avançada.'
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ error: message === 'UNAUTHORIZED' ? 'Não autenticado.' : message === 'FORBIDDEN' ? 'Sem permissão.' : message }, { status })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campeonatoId } = await params
    const { user, permission } = await context(request, campeonatoId)
    if (!permission.canManage) return NextResponse.json({ error: 'Sem permissão para alterar este campeonato.' }, { status: 403 })
    const body = await request.json()
    const action = text(body?.action, 60)

    if (action === 'preview_progression') {
      const preview = await buildProgressionPreview(campeonatoId, text(body?.rule_id))
      return NextResponse.json({ ok: true, preview })
    } else if (action === 'apply_progression') {
      const ruleId = text(body?.rule_id)
      const replaceConflicts = Boolean(body?.replace_conflicts)
      const preview = await buildProgressionPreview(campeonatoId, ruleId)
      if (preview.summary.conflictCount && !replaceConflicts) throw new Error('Existem equipes já vinculadas ao destino por outra origem. Revise os conflitos ou autorize a substituição controlada.')
      const effectiveNew = preview.candidates.filter((row: any) => !row.alreadyApplied)
      const occupiedAfterReplacement = Number(preview.summary.occupied || 0) + effectiveNew.filter((row: any) => !row.conflict).length
      if (preview.summary.capacity && occupiedAfterReplacement > Number(preview.summary.capacity)) throw new Error('A etapa de destino não possui vagas suficientes para aplicar esta progressão.')

      const { data: execution, error: executionError } = await supabaseAdmin.from('campeonato_progressao_execucoes').insert({
        campeonato_id: campeonatoId,
        regra_id: ruleId,
        fase_id: preview.phase.id,
        status: 'aplicada',
        previa_snapshot: preview,
        aplicada_por: user.id,
        aplicada_em: new Date().toISOString(),
      }).select('id').single()
      if (executionError) throw executionError

      let applied = 0
      for (const row of effectiveNew) {
        const existing = row.existingDestination as any
        const previousDestination = existing ? { ...existing } : null
        const { data: sourceLink, error: sourceReadError } = await supabaseAdmin.from('campeonato_etapa_equipes').select('*').eq('etapa_id', preview.rule.etapa_origem_id).eq('campeonato_equipe_id', row.campeonato_equipe_id).eq('campeonato_id', campeonatoId).maybeSingle()
        if (sourceReadError) throw sourceReadError
        const payload = {
          campeonato_id: campeonatoId,
          etapa_id: preview.rule.etapa_destino_id,
          campeonato_equipe_id: row.campeonato_equipe_id,
          tipo_origem: preview.rule.tipo === 'promocao' ? 'promocao' : 'outra_etapa',
          etapa_origem_id: preview.rule.etapa_origem_id,
          posicao_origem: row.colocacao,
          status: preview.rule.tipo === 'promocao' ? 'promovida' : 'classificada',
          observacao: `Progressão aplicada pela regra ${ruleId}.`,
          regra_progressao_id: ruleId,
          progressao_execucao_id: execution.id,
        }
        const { data: destinationLink, error: destinationError } = await supabaseAdmin.from('campeonato_etapa_equipes').upsert(payload, { onConflict: 'etapa_id,campeonato_equipe_id' }).select('id').single()
        if (destinationError) throw destinationError
        const sourceStatusBefore = sourceLink?.status || null
        const { error: sourceError } = await supabaseAdmin.from('campeonato_etapa_equipes').update({ status: payload.status, posicao_origem: row.colocacao }).eq('etapa_id', preview.rule.etapa_origem_id).eq('campeonato_equipe_id', row.campeonato_equipe_id).eq('campeonato_id', campeonatoId)
        if (sourceError) throw sourceError
        const { error: itemError } = await supabaseAdmin.from('campeonato_progressao_execucao_itens').insert({
          execucao_id: execution.id,
          campeonato_equipe_id: row.campeonato_equipe_id,
          vinculo_origem_id: sourceLink?.id || null,
          vinculo_destino_id: destinationLink.id,
          posicao_origem: row.colocacao,
          status_origem_anterior: sourceStatusBefore,
          destino_anterior: previousDestination,
          resultado: row.conflict ? 'substituida' : 'incluida',
        })
        if (itemError) throw itemError
        applied += 1
      }
      const finalPreview = await buildProgressionPreview(campeonatoId, ruleId)
      const { error: snapshotError } = await supabaseAdmin.from('campeonato_progressao_execucoes').update({ resultado_snapshot: finalPreview }).eq('id', execution.id)
      if (snapshotError) throw snapshotError
      return NextResponse.json({ ok: true, applied, execution_id: execution.id, preview: finalPreview, ...(await loadStructure(campeonatoId)) })
    } else if (action === 'reverse_progression') {
      const executionId = text(body?.execution_id)
      const reason = nullableText(body?.reason, 500)
      const { data: execution, error: executionError } = await supabaseAdmin.from('campeonato_progressao_execucoes').select('*').eq('id', executionId).eq('campeonato_id', campeonatoId).maybeSingle()
      if (executionError) throw executionError
      if (!execution || execution.status !== 'aplicada') throw new Error('Execução ativa não encontrada.')
      const { data: items, error: itemsError } = await supabaseAdmin.from('campeonato_progressao_execucao_itens').select('*').eq('execucao_id', executionId)
      if (itemsError) throw itemsError
      for (const item of items || []) {
        if (item.destino_anterior) {
          const previous = item.destino_anterior as any
          const { error } = await supabaseAdmin.from('campeonato_etapa_equipes').update({
            tipo_origem: previous.tipo_origem,
            etapa_origem_id: previous.etapa_origem_id,
            posicao_origem: previous.posicao_origem,
            status: previous.status,
            observacao: previous.observacao,
            regra_progressao_id: previous.regra_progressao_id || null,
            progressao_execucao_id: previous.progressao_execucao_id || null,
          }).eq('id', item.vinculo_destino_id).eq('campeonato_id', campeonatoId)
          if (error) throw error
        } else {
          const { error } = await supabaseAdmin.from('campeonato_etapa_equipes').update({ status: 'retirada' }).eq('id', item.vinculo_destino_id).eq('progressao_execucao_id', executionId).eq('campeonato_id', campeonatoId)
          if (error) throw error
        }
        if (item.vinculo_origem_id && item.status_origem_anterior) {
          const { error } = await supabaseAdmin.from('campeonato_etapa_equipes').update({ status: item.status_origem_anterior }).eq('id', item.vinculo_origem_id).eq('campeonato_id', campeonatoId)
          if (error) throw error
        }
      }
      const { error: reverseError } = await supabaseAdmin.from('campeonato_progressao_execucoes').update({ status: 'revertida', revertida_por: user.id, revertida_em: new Date().toISOString(), motivo_reversao: reason }).eq('id', executionId).eq('status', 'aplicada')
      if (reverseError) throw reverseError
      return NextResponse.json({ ok: true, reversed: (items || []).length, ...(await loadStructure(campeonatoId)) })
    } else if (action === 'save_edition') {
      const franchiseName = text(body?.franchise_name)
      if (!franchiseName) throw new Error('Informe o nome histórico do campeonato.')
      let franchiseId = text(body?.franchise_id)
      if (franchiseId) {
        const { error } = await supabaseAdmin.from('campeonato_franquias').update({
          nome: franchiseName,
          descricao: nullableText(body?.franchise_description, 1200),
          status: text(body?.franchise_status || 'ativo', 20),
        }).eq('id', franchiseId)
        if (error) throw error
      } else {
        const { data, error } = await supabaseAdmin.from('campeonato_franquias').insert({
          nome: franchiseName,
          descricao: nullableText(body?.franchise_description, 1200),
          criado_por: user.id,
        }).select('id').single()
        if (error) throw error
        franchiseId = String(data.id)
      }
      const editionPayload = {
        franquia_id: franchiseId,
        campeonato_id: campeonatoId,
        numero_edicao: positiveInt(body?.edition_number),
        temporada: nullableText(body?.season, 80),
        titulo_publico: nullableText(body?.public_title, 180),
        status: text(body?.edition_status || 'planejada', 20),
      }
      const { error } = await supabaseAdmin.from('campeonato_edicoes').upsert(editionPayload, { onConflict: 'campeonato_id' })
      if (error) throw error
    } else if (action === 'create_division') {
      const editionId = text(body?.edition_id)
      const name = text(body?.name)
      if (!editionId || !name) throw new Error('Edição e nome da série são obrigatórios.')
      const { error } = await supabaseAdmin.from('campeonato_divisoes').insert({
        edicao_id: editionId,
        nome: name,
        codigo: nullableText(body?.code, 30),
        ordem: positiveInt(body?.order, false) || 1,
        descricao: nullableText(body?.description, 800),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        premia_mvp: Boolean(body?.awards_mvp),
      })
      if (error) throw error
    } else if (action === 'create_stage') {
      const editionId = text(body?.edition_id)
      const name = text(body?.name)
      if (!editionId || !name) throw new Error('Edição e nome da etapa são obrigatórios.')
      const { error } = await supabaseAdmin.from('campeonato_etapas').insert({
        edicao_id: editionId,
        divisao_id: nullableText(body?.division_id, 50),
        nome: name,
        ordem: positiveInt(body?.order, false) || 1,
        tipo: text(body?.type || 'outra', 30),
        formato: text(body?.format || 'outro', 30),
        capacidade_total: positiveInt(body?.capacity),
        vagas_venda_direta: positiveInt(body?.direct_sales, false),
        valor_vaga: money(body?.vacancy_value),
        classificam_quantidade: positiveInt(body?.qualifiers),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        premia_mvp: Boolean(body?.awards_mvp),
      })
      if (error) throw error
    } else if (action === 'create_source') {
      const { error } = await supabaseAdmin.from('campeonato_etapa_fontes').insert({
        etapa_destino_id: text(body?.stage_id),
        tipo_origem: text(body?.source_type, 30),
        etapa_origem_id: nullableText(body?.source_stage_id, 50),
        divisao_origem_id: nullableText(body?.source_division_id, 50),
        quantidade: positiveInt(body?.quantity, false),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'create_progression') {
      const type = text(body?.progression_type, 30)
      const { error } = await supabaseAdmin.from('campeonato_progressao_regras').insert({
        etapa_origem_id: text(body?.stage_id),
        etapa_destino_id: nullableText(body?.destination_stage_id, 50),
        divisao_destino_id: nullableText(body?.destination_division_id, 50),
        tipo: type,
        posicao_inicio: positiveInt(body?.position_start),
        posicao_fim: positiveInt(body?.position_end),
        quantidade: positiveInt(body?.quantity),
        automatica: Boolean(body?.automatic),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'create_prize') {
      const { error } = await supabaseAdmin.from('campeonato_etapa_premiacoes').insert({
        etapa_id: text(body?.stage_id),
        tipo: text(body?.prize_type || 'colocacao', 30),
        posicao: positiveInt(body?.position),
        titulo: nullableText(body?.title, 120),
        valor: money(body?.value),
        descricao: nullableText(body?.description, 500),
      })
      if (error) throw error
    } else if (action === 'save_group_choice_config') {
      const phaseId = text(body?.phase_id)
      if (!phaseId) throw new Error('Fase não informada.')
      const { data: phase, error: phaseError } = await supabaseAdmin.from('campeonato_fases').select('id').eq('id', phaseId).eq('campeonato_id', campeonatoId).maybeSingle()
      if (phaseError) throw phaseError
      if (!phase) throw new Error('Fase inválida para este campeonato.')
      const { error } = await supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').upsert({
        campeonato_id: campeonatoId,
        fase_id: phaseId,
        aberta: Boolean(body?.open),
        permite_troca: body?.allow_change !== false,
        abre_em: nullableText(body?.opens_at, 40),
        fecha_em: nullableText(body?.closes_at, 40),
        criado_por: user.id,
        atualizado_por: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'fase_id' })
      if (error) throw error
    } else if (action === 'assign_group_manual') {
      const participationId = text(body?.campeonato_equipe_id)
      const groupId = text(body?.group_id)
      const slotId = text(body?.slot_id)
      if (!participationId || !groupId || !slotId) throw new Error('Equipe, grupo e slot são obrigatórios.')
      const [{ data: participation, error: participationError }, { data: group, error: groupError }] = await Promise.all([
        supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,grupo_id,slot_id').eq('id', participationId).eq('campeonato_id', campeonatoId).maybeSingle(),
        supabaseAdmin.from('campeonato_grupos').select('id,fase_id').eq('id', groupId).eq('campeonato_id', campeonatoId).maybeSingle(),
      ])
      if (participationError) throw participationError
      if (groupError) throw groupError
      if (!participation || !group) throw new Error('Equipe ou grupo inválido.')
      const { data: chosenSlot, error: chosenSlotError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', slotId).eq('campeonato_id', campeonatoId).eq('grupo_id', groupId).eq('status', 'livre').is('equipe_id', null).is('line_id', null).maybeSingle()
      if (chosenSlotError) throw chosenSlotError
      if (!chosenSlot) throw new Error('O slot selecionado não está mais disponível.')
      const { data: reserved, error: reserveError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: participation.equipe_id, line_id: participation.line_id, status: 'ocupado' }).eq('id', chosenSlot.id).eq('status', 'livre').is('equipe_id', null).is('line_id', null).select('id,slot_numero').maybeSingle()
      if (reserveError) throw reserveError
      if (!reserved) throw new Error('O slot escolhido acabou de ser ocupado.')
      const oldSlotId = participation.slot_id ? String(participation.slot_id) : null
      const oldGroupId = participation.grupo_id ? String(participation.grupo_id) : null
      const { error: updateError } = await supabaseAdmin.from('campeonato_equipes').update({ grupo_id: groupId, slot_id: reserved.id, slot_numero: reserved.slot_numero }).eq('id', participationId).eq('campeonato_id', campeonatoId)
      if (updateError) {
        await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', reserved.id)
        throw updateError
      }
      if (oldSlotId && oldSlotId !== String(reserved.id)) await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', oldSlotId).eq('campeonato_id', campeonatoId)
      const { error: historyError } = await supabaseAdmin.from('campeonato_grupo_escolha_historico').insert({ campeonato_id: campeonatoId, fase_id: group.fase_id, campeonato_equipe_id: participationId, grupo_anterior_id: oldGroupId, grupo_novo_id: groupId, slot_anterior_id: oldSlotId, slot_novo_id: reserved.id, origem: 'administrador', alterado_por: user.id, observacao: nullableText(body?.note, 500) })
      if (historyError) throw historyError
    } else if (action === 'create_daily_hour') {
      const hour = text(body?.hour, 8)
      if (!hour) throw new Error('Informe o horário.')
      const { error } = await supabaseAdmin.from('campeonato_diario_horarios').insert({
        campeonato_id: campeonatoId,
        horario: hour,
        nome_exibicao: nullableText(body?.display_name, 80),
        capacidade: positiveInt(body?.capacity),
        valor_vaga: money(body?.vacancy_value),
        premiacao_descricao: nullableText(body?.prize_description, 500),
        premiacao_valor: money(body?.prize_value),
        mapa: nullableText(body?.map, 80),
        numero_quedas: positiveInt(body?.drops, false) || 1,
      })
      if (error) throw error
    } else if (action === 'assign_team') {
      const stageId = text(body?.stage_id)
      const participationId = text(body?.campeonato_equipe_id)
      if (!stageId || !participationId) throw new Error('Etapa e equipe são obrigatórias.')
      const [{ data: stageRow, error: stageError }, { data: participationRow, error: participationError }] = await Promise.all([
        supabaseAdmin.from('campeonato_etapas').select('id,capacidade_total,campeonato_edicoes!inner(campeonato_id)').eq('id', stageId).maybeSingle(),
        supabaseAdmin.from('campeonato_equipes').select('id,campeonato_id').eq('id', participationId).maybeSingle(),
      ])
      if (stageError) throw stageError
      if (participationError) throw participationError
      const stageChampionshipId = String((stageRow as any)?.campeonato_edicoes?.campeonato_id || '')
      if (!stageRow || !participationRow || stageChampionshipId !== campeonatoId || String(participationRow.campeonato_id) !== campeonatoId) throw new Error('Etapa ou equipe inválida para este campeonato.')
      const { count, error: countError } = await supabaseAdmin.from('campeonato_etapa_equipes').select('id', { count: 'exact', head: true }).eq('etapa_id', stageId).neq('status', 'retirada')
      if (countError) throw countError
      if (stageRow.capacidade_total != null && Number(count || 0) >= Number(stageRow.capacidade_total)) throw new Error('A etapa já atingiu sua capacidade máxima.')
      const { error } = await supabaseAdmin.from('campeonato_etapa_equipes').upsert({
        campeonato_id: campeonatoId,
        etapa_id: stageId,
        campeonato_equipe_id: participationId,
        tipo_origem: text(body?.source_type || 'manual', 30),
        etapa_origem_id: nullableText(body?.source_stage_id, 50),
        posicao_origem: positiveInt(body?.source_position),
        status: 'ativa',
        observacao: nullableText(body?.note, 500),
      }, { onConflict: 'etapa_id,campeonato_equipe_id' })
      if (error) throw error
    } else if (action === 'remove_team') {
      const stageTeamId = text(body?.stage_team_id)
      if (!stageTeamId) throw new Error('Vínculo da equipe não informado.')
      const { error } = await supabaseAdmin.from('campeonato_etapa_equipes').update({ status: 'retirada' }).eq('id', stageTeamId).eq('campeonato_id', campeonatoId)
      if (error) throw error
    } else if (action === 'link_phase') {
      const phaseId = text(body?.phase_id)
      const stageId = nullableText(body?.stage_id, 50)
      if (!phaseId) throw new Error('Fase não informada.')
      if (stageId) {
        const { data: stageRow, error: stageError } = await supabaseAdmin.from('campeonato_etapas').select('id,campeonato_edicoes!inner(campeonato_id)').eq('id', stageId).maybeSingle()
        if (stageError) throw stageError
        if (String((stageRow as any)?.campeonato_edicoes?.campeonato_id || '') !== campeonatoId) throw new Error('Etapa inválida para este campeonato.')
      }
      const { error } = await supabaseAdmin.from('campeonato_fases').update({ etapa_id: stageId }).eq('id', phaseId).eq('campeonato_id', campeonatoId)
      if (error) throw error
    } else if (action === 'link_daily_group') {
      const dailyHourId = text(body?.daily_hour_id)
      const groupId = text(body?.group_id)
      if (!dailyHourId || !groupId) throw new Error('Horário e grupo são obrigatórios.')
      const { error: clearError } = await supabaseAdmin.from('campeonato_grupos').update({ diario_horario_id: null }).eq('campeonato_id', campeonatoId).eq('diario_horario_id', dailyHourId)
      if (clearError) throw clearError
      const { error: groupError } = await supabaseAdmin.from('campeonato_grupos').update({ diario_horario_id: dailyHourId }).eq('id', groupId).eq('campeonato_id', campeonatoId)
      if (groupError) throw groupError
      const { error: hourError } = await supabaseAdmin.from('campeonato_diario_horarios').update({ grupo_id: groupId }).eq('id', dailyHourId).eq('campeonato_id', campeonatoId)
      if (hourError) throw hourError
    } else if (action === 'delete') {
      const table = text(body?.table, 80)
      const rowId = text(body?.row_id, 60)
      if (!MUTABLE_TABLES.has(table) || !rowId) throw new Error('Exclusão inválida.')
      const { error } = await supabaseAdmin.from(table).delete().eq('id', rowId)
      if (error) throw error
    } else {
      throw new Error('Ação não reconhecida.')
    }

    return NextResponse.json({ ok: true, ...(await loadStructure(campeonatoId)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao salvar estrutura avançada.'
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ error: message === 'UNAUTHORIZED' ? 'Não autenticado.' : message }, { status })
  }
}

export async function PATCH(request: NextRequest, contextParams: { params: Promise<{ id: string }> }) {
  return POST(request, contextParams)
}

export async function DELETE(request: NextRequest, contextParams: { params: Promise<{ id: string }> }) {
  return POST(request, contextParams)
}

