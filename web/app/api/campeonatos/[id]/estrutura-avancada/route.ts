import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, permissionPublicPayload } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { carregarResumoCampeao, listarEstatisticasEquipes } from '@backend/campeonatos/estatisticas/estatisticas.service'

const MUTABLE_TABLES = new Set([
  'campeonato_divisoes',
  'campeonato_etapas',
  'campeonato_etapa_fontes',
  'campeonato_progressao_regras',
  'campeonato_etapa_premiacoes',
  'campeonato_diario_horarios',
  'campeonato_etapa_equipes',
  'campeonato_grupo_escolha_configuracoes',
  'campeonato_grupo_escolha_bloqueios',
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


async function notifyParticipationOwner(input: { campeonatoId: string; participationId: string; senderId: string; type: string; title: string; body: string; payload?: Record<string, unknown> }) {
  const { data: participation, error: participationError } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id')
    .eq('id', input.participationId)
    .eq('campeonato_id', input.campeonatoId)
    .maybeSingle()
  if (participationError) throw participationError
  if (!participation?.equipe_id) return false
  const { data: team, error: teamError } = await supabaseAdmin
    .from('equipes')
    .select('auth_user_id,dono_auth_user_id')
    .eq('id', participation.equipe_id)
    .maybeSingle()
  if (teamError) throw teamError
  const recipientId = String(team?.dono_auth_user_id || team?.auth_user_id || '')
  if (!recipientId) return false
  const { error } = await supabaseAdmin.from('notificacoes').insert({
    destinatario_auth_user_id: recipientId,
    remetente_auth_user_id: input.senderId,
    tipo: input.type,
    titulo: input.title,
    corpo: input.body,
    payload: { campeonato_id: input.campeonatoId, campeonato_equipe_id: input.participationId, ...(input.payload || {}) },
    status: 'nao_lida',
    referencia_tipo: 'campeonato_escolha_grupo',
    referencia_id: input.participationId,
  })
  if (error) throw error
  return true
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
    return { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: dailyHours || [], teams: teams || [], stageTeams: [], phases: [], groups: [], slots: [], groupChoiceConfigs: [], groupChoiceBlocks: [], groupChoiceHistory: [], progressionExecutions: [], progressionExecutionItems: [] }
  }

  const [{ data: franchise, error: franchiseError }, divisionsResult, stagesResult, dailyResult, teamsResult, phasesResult, groupsResult, slotsResult, choiceConfigResult, choiceBlocksResult, choiceHistoryResult] = await Promise.all([
    supabaseAdmin.from('campeonato_franquias').select('*').eq('id', edition.franquia_id).maybeSingle(),
    supabaseAdmin.from('campeonato_divisoes').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_etapas').select('*').eq('edicao_id', edition.id).order('ordem'),
    supabaseAdmin.from('campeonato_diario_horarios').select('*').eq('campeonato_id', campeonatoId).order('horario'),
    supabaseAdmin.from('campeonato_equipes').select('id,nome_exibicao,equipe_id,line_id,status,equipes(nome,tag,logo_url),equipe_lines(nome,tag,logo_url)').eq('campeonato_id', campeonatoId).eq('status', 'ativo').order('created_at'),
    supabaseAdmin.from('campeonato_fases').select('id,nome,ordem,tipo,status,etapa_id').eq('campeonato_id', campeonatoId).order('ordem'),
    supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id,slots,diario_horario_id').eq('campeonato_id', campeonatoId).order('nome'),
    supabaseAdmin.from('campeonato_slots').select('id,fase_id,grupo_id,slot_numero,slot_letra,status,equipe_id,line_id').eq('campeonato_id', campeonatoId).order('slot_numero'),
    supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').select('*').eq('campeonato_id', campeonatoId),
    supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').select('*').eq('campeonato_id', campeonatoId).eq('ativo', true).order('created_at', { ascending: false }),
    supabaseAdmin.from('campeonato_grupo_escolha_historico').select('*').eq('campeonato_id', campeonatoId).order('created_at', { ascending: false }).limit(500),
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
  if (choiceBlocksResult.error) throw choiceBlocksResult.error
  if (choiceHistoryResult.error) throw choiceHistoryResult.error

  const choiceHistory = choiceHistoryResult.data || []
  const actorIds = [...new Set(choiceHistory.map((row: any) => String(row.alterado_por || '')).filter(Boolean))]
  const actorEntries = await Promise.all(actorIds.map(async (actorId) => {
    const { data } = await supabaseAdmin.auth.admin.getUserById(actorId)
    const metadata = data.user?.user_metadata || {}
    const label = String(metadata.full_name || metadata.name || metadata.user_name || data.user?.email || '').trim()
    return [actorId, label || `Usuário ${actorId.slice(0, 8)}`] as const
  }))
  const actorNames = new Map(actorEntries)
  const enrichedChoiceHistory = choiceHistory.map((row: any) => ({
    ...row,
    alterado_por_nome: row.alterado_por ? actorNames.get(String(row.alterado_por)) || `Usuário ${String(row.alterado_por).slice(0, 8)}` : 'Sistema',
  }))

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
    groupChoiceBlocks: choiceBlocksResult.data || [],
    groupChoiceHistory: enrichedChoiceHistory,
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
      const sourceChampionshipId = text(body?.source_championship_id, 80)
      if (!franchiseId && sourceChampionshipId) {
        const sourcePermission = await getCampeonatoPermission(user.id, sourceChampionshipId)
        if (!sourcePermission.canManage) throw new Error('O campeonato escolhido como season não pertence a esta produtora.')
        const { data: sourceEdition, error: sourceEditionError } = await supabaseAdmin
          .from('campeonato_edicoes')
          .select('id,franquia_id')
          .eq('campeonato_id', sourceChampionshipId)
          .maybeSingle()
        if (sourceEditionError) throw sourceEditionError
        franchiseId = String(sourceEdition?.franquia_id || '')
      }
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
        if (sourceChampionshipId) {
          const { error: sourceLinkError } = await supabaseAdmin.from('campeonato_edicoes').upsert({
            franquia_id: franchiseId,
            campeonato_id: sourceChampionshipId,
            numero_edicao: 1,
            temporada: null,
            titulo_publico: franchiseName,
            status: 'encerrada',
          }, { onConflict: 'campeonato_id' })
          if (sourceLinkError) throw sourceLinkError
        }
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
      const stageType = text(body?.type || 'outra', 30)
      if (!editionId || !name) throw new Error('Edição e nome da etapa são obrigatórios.')
      if (stageType === 'final') {
        const { data: existingFinal, error: existingFinalError } = await supabaseAdmin
          .from('campeonato_etapas')
          .select('id,nome')
          .eq('edicao_id', editionId)
          .eq('tipo', 'final')
          .maybeSingle()
        if (existingFinalError) throw existingFinalError
        if (existingFinal) throw new Error(`Esta edição já possui a Grande Final "${existingFinal.nome}".`)
      }
      const { error } = await supabaseAdmin.from('campeonato_etapas').insert({
        edicao_id: editionId,
        divisao_id: nullableText(body?.division_id, 50),
        nome: name,
        ordem: positiveInt(body?.order, false) || 1,
        tipo: stageType,
        formato: text(body?.format || 'outro', 30),
        capacidade_total: positiveInt(body?.capacity),
        vagas_venda_direta: positiveInt(body?.direct_sales, false),
        valor_vaga: money(body?.vacancy_value),
        classificam_quantidade: stageType === 'final' ? null : positiveInt(body?.qualifiers),
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
    } else if (action === 'publish_final') {
      const { data: championship, error: championshipError } = await supabaseAdmin
        .from('campeonatos')
        .select('id,tipo')
        .eq('id', campeonatoId)
        .maybeSingle()
      if (championshipError) throw championshipError
      if (!championship) throw new Error('Campeonato não encontrado.')

      const { data: edition, error: editionError } = await supabaseAdmin
        .from('campeonato_edicoes')
        .select('id,status,metadados')
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()
      if (editionError) throw editionError
      if (!edition) throw new Error('Cadastre a edição do campeonato antes de publicar o resultado final.')

      const [{ count: totalFalls, error: totalFallsError }, { count: pendingFalls, error: pendingFallsError }] = await Promise.all([
        supabaseAdmin.from('campeonato_partidas').select('id', { count: 'exact', head: true }).eq('campeonato_id', campeonatoId),
        supabaseAdmin.from('campeonato_partidas').select('id', { count: 'exact', head: true }).eq('campeonato_id', campeonatoId).neq('status', 'finalizada'),
      ])
      if (totalFallsError) throw totalFallsError
      if (pendingFallsError) throw pendingFallsError
      if (!totalFalls) throw new Error('O campeonato ainda não possui quedas para encerrar.')
      if (pendingFalls) throw new Error(`Existem ${pendingFalls} queda(s) ainda não finalizada(s). Finalize todas antes de publicar o resultado final.`)

      const resumoCampeao = await carregarResumoCampeao(campeonatoId)
      const isLeague = String(championship.tipo || '').toLowerCase() === 'liga'
      let finalRanking: any[] = []
      if (isLeague) {
        const { data: leagueGroups, error: leagueGroupsError } = await supabaseAdmin
          .from('campeonato_grupos')
          .select('id,nome')
          .eq('campeonato_id', campeonatoId)
        if (leagueGroupsError) throw leagueGroupsError
        if (!leagueGroups?.length) throw new Error('A Liga ainda não possui agrupamentos para encerrar.')
        for (const group of leagueGroups) {
          const ranking = await listarEstatisticasEquipes(campeonatoId, { grupoId: String(group.id) })
          if (!ranking.length) throw new Error(`O agrupamento ${group.nome || 'da Liga'} ainda não possui classificação calculada.`)
          finalRanking.push(...ranking.map((row: any) => ({ ...row, grupo_id: group.id, grupo_nome: group.nome })))
        }
      } else {
        finalRanking = resumoCampeao.fase?.id
          ? await listarEstatisticasEquipes(campeonatoId, { faseId: resumoCampeao.fase.id })
          : await listarEstatisticasEquipes(campeonatoId, {})
        if (!finalRanking.length) throw new Error('Não há classificação calculada para publicar.')
        if (resumoCampeao.fase && !resumoCampeao.final_concluida) throw new Error('Finalize todas as quedas da Grande Final antes de publicar.')
        if (resumoCampeao.aguardando_desempate || (resumoCampeao.fase && !resumoCampeao.campeao)) throw new Error('A Grande Final ainda não definiu um campeão pelas regras configuradas.')
      }

      const publishedAt = new Date().toISOString()
      const metadata = {
        ...(edition.metadados && typeof edition.metadados === 'object' ? edition.metadados : {}),
        final_publicado_em: publishedAt,
        final_publicado_por: user.id,
        final_total_equipes: finalRanking.length,
        final_campeao_campeonato_equipe_id: isLeague ? null : (resumoCampeao.campeao?.campeonato_equipe_id || finalRanking[0]?.campeonato_equipe_id || null),
      }
      const [{ error: stageError }, { error: divisionError }, { error: editionUpdateError }, { error: registrationError }] = await Promise.all([
        supabaseAdmin.from('campeonato_etapas').update({ status: 'encerrada', updated_at: publishedAt }).eq('edicao_id', edition.id).neq('status', 'cancelada'),
        supabaseAdmin.from('campeonato_divisoes').update({ status: 'encerrada', updated_at: publishedAt }).eq('edicao_id', edition.id).neq('status', 'cancelada'),
        supabaseAdmin.from('campeonato_edicoes').update({ status: 'encerrada', data_fim: publishedAt.slice(0, 10), metadados: metadata, updated_at: publishedAt }).eq('id', edition.id),
        supabaseAdmin.from('campeonato_configuracoes').update({ aceita_novas_inscricoes_equipes: false }).eq('campeonato_id', campeonatoId),
      ])
      if (stageError) throw stageError
      if (divisionError) throw divisionError
      if (editionUpdateError) throw editionUpdateError
      if (registrationError) throw registrationError
    } else if (action === 'reopen_final') {
      const { data: edition, error: editionError } = await supabaseAdmin
        .from('campeonato_edicoes')
        .select('id,status,metadados')
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()
      if (editionError) throw editionError
      if (!edition) throw new Error('Edição não encontrada.')
      if (edition.status !== 'encerrada') throw new Error('A edição não está encerrada.')
      const reopenedAt = new Date().toISOString()
      const metadata = {
        ...(edition.metadados && typeof edition.metadados === 'object' ? edition.metadados : {}),
        final_publicado_em: null,
        final_publicado_por: null,
        final_reaberto_em: reopenedAt,
        final_reaberto_por: user.id,
      }
      const [{ error: stageError }, { error: divisionError }, { error: editionUpdateError }] = await Promise.all([
        supabaseAdmin.from('campeonato_etapas').update({ status: 'ativa', updated_at: reopenedAt }).eq('edicao_id', edition.id).eq('status', 'encerrada'),
        supabaseAdmin.from('campeonato_divisoes').update({ status: 'ativa', updated_at: reopenedAt }).eq('edicao_id', edition.id).eq('status', 'encerrada'),
        supabaseAdmin.from('campeonato_edicoes').update({ status: 'ativa', data_fim: null, metadados: metadata, updated_at: reopenedAt }).eq('id', edition.id),
      ])
      if (stageError) throw stageError
      if (divisionError) throw divisionError
      if (editionUpdateError) throw editionUpdateError
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
    } else if (action === 'set_group_choice_block') {
      const phaseId = text(body?.phase_id)
      const groupId = nullableText(body?.group_id, 80)
      const slotId = nullableText(body?.slot_id, 80)
      if (!phaseId || (!!groupId === !!slotId)) throw new Error('Informe uma fase e apenas um grupo ou slot.')
      const { error } = await supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').insert({
        campeonato_id: campeonatoId,
        fase_id: phaseId,
        grupo_id: groupId,
        slot_id: slotId,
        motivo: nullableText(body?.reason, 300),
        criado_por: user.id,
      })
      if (error) throw error
    } else if (action === 'remove_group_choice_block') {
      const blockId = text(body?.block_id)
      if (!blockId) throw new Error('Bloqueio não informado.')
      const { error } = await supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').update({ ativo: false, removido_por: user.id, removed_at: new Date().toISOString() }).eq('id', blockId).eq('campeonato_id', campeonatoId).eq('ativo', true)
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
      await notifyParticipationOwner({ campeonatoId, participationId, senderId: user.id, type: oldGroupId ? 'escolha_grupo_movida_admin' : 'escolha_grupo_definida_admin', title: oldGroupId ? 'Grupo e slot alterados' : 'Grupo e slot definidos', body: oldGroupId ? 'A administração alterou o grupo ou slot da sua equipe. Consulte a Central do Campeonato.' : 'A administração definiu o grupo e slot da sua equipe. Consulte a Central do Campeonato.', payload: { grupo_id: groupId, slot_id: reserved.id } })
    } else if (action === 'cancel_group_choice_admin') {
      const participationId = text(body?.campeonato_equipe_id)
      if (!participationId) throw new Error('Equipe/line é obrigatória.')
      const { data: participation, error: participationError } = await supabaseAdmin.from('campeonato_equipes').select('id,grupo_id,slot_id').eq('id', participationId).eq('campeonato_id', campeonatoId).maybeSingle()
      if (participationError) throw participationError
      if (!participation?.grupo_id || !participation?.slot_id) throw new Error('Esta equipe não possui escolha ativa.')
      const { data: group, error: groupError } = await supabaseAdmin.from('campeonato_grupos').select('fase_id').eq('id', participation.grupo_id).eq('campeonato_id', campeonatoId).maybeSingle()
      if (groupError) throw groupError
      if (!group) throw new Error('Grupo atual não encontrado.')
      const oldGroupId = String(participation.grupo_id)
      const oldSlotId = String(participation.slot_id)
      const { error: updateError } = await supabaseAdmin.from('campeonato_equipes').update({ grupo_id: null, slot_id: null, slot_numero: null }).eq('id', participationId).eq('campeonato_id', campeonatoId)
      if (updateError) throw updateError
      const { error: freeError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', oldSlotId).eq('campeonato_id', campeonatoId)
      if (freeError) throw freeError
      const { error: historyError } = await supabaseAdmin.from('campeonato_grupo_escolha_historico').insert({ campeonato_id: campeonatoId, fase_id: group.fase_id, campeonato_equipe_id: participationId, grupo_anterior_id: oldGroupId, grupo_novo_id: null, slot_anterior_id: oldSlotId, slot_novo_id: null, origem: 'administrador', alterado_por: user.id, observacao: nullableText(body?.note, 500) || 'Escolha cancelada pela administração.' })
      if (historyError) throw historyError
      await notifyParticipationOwner({ campeonatoId, participationId, senderId: user.id, type: 'escolha_grupo_cancelada_admin', title: 'Escolha de grupo cancelada', body: 'A administração cancelou a escolha de grupo e slot da sua equipe. Consulte a Central do Campeonato.' })
    } else if (action === 'restore_group_choice_admin') {
      const participationId = text(body?.campeonato_equipe_id)
      if (!participationId) throw new Error('Equipe/line é obrigatória.')
      const { data: participation, error: participationError } = await supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,grupo_id,slot_id').eq('id', participationId).eq('campeonato_id', campeonatoId).maybeSingle()
      if (participationError) throw participationError
      if (!participation) throw new Error('Equipe não encontrada.')
      if (participation.grupo_id || participation.slot_id) throw new Error('A equipe já possui escolha ativa.')
      const { data: cancelled, error: cancelledError } = await supabaseAdmin.from('campeonato_grupo_escolha_historico').select('*').eq('campeonato_id', campeonatoId).eq('campeonato_equipe_id', participationId).is('grupo_novo_id', null).not('grupo_anterior_id', 'is', null).not('slot_anterior_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (cancelledError) throw cancelledError
      if (!cancelled) throw new Error('Nenhuma escolha cancelada encontrada.')
      const { data: slot, error: slotError } = await supabaseAdmin.from('campeonato_slots').select('id,slot_numero,status,equipe_id,line_id').eq('id', cancelled.slot_anterior_id).eq('campeonato_id', campeonatoId).eq('grupo_id', cancelled.grupo_anterior_id).maybeSingle()
      if (slotError) throw slotError
      if (!slot || slot.status !== 'livre' || slot.equipe_id || slot.line_id) throw new Error('O slot anterior não está mais disponível.')
      const { data: reserved, error: reserveError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: participation.equipe_id, line_id: participation.line_id, status: 'ocupado' }).eq('id', slot.id).eq('status', 'livre').is('equipe_id', null).is('line_id', null).select('id,slot_numero').maybeSingle()
      if (reserveError) throw reserveError
      if (!reserved) throw new Error('O slot anterior acabou de ser ocupado.')
      const { error: updateError } = await supabaseAdmin.from('campeonato_equipes').update({ grupo_id: cancelled.grupo_anterior_id, slot_id: reserved.id, slot_numero: reserved.slot_numero }).eq('id', participationId).eq('campeonato_id', campeonatoId)
      if (updateError) {
        await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', reserved.id)
        throw updateError
      }
      const { error: historyError } = await supabaseAdmin.from('campeonato_grupo_escolha_historico').insert({ campeonato_id: campeonatoId, fase_id: cancelled.fase_id, campeonato_equipe_id: participationId, grupo_anterior_id: null, grupo_novo_id: cancelled.grupo_anterior_id, slot_anterior_id: null, slot_novo_id: reserved.id, origem: 'administrador', alterado_por: user.id, observacao: nullableText(body?.note, 500) || 'Escolha restaurada pela administração.' })
      if (historyError) throw historyError
      await notifyParticipationOwner({ campeonatoId, participationId, senderId: user.id, type: 'escolha_grupo_restaurada_admin', title: 'Escolha de grupo restaurada', body: 'A administração restaurou a escolha anterior de grupo e slot da sua equipe. Consulte a Central do Campeonato.', payload: { grupo_id: cancelled.grupo_anterior_id, slot_id: reserved.id } })
    } else if (action === 'send_group_choice_notifications') {
      const participationIds: string[] = Array.isArray(body?.campeonato_equipe_ids)
        ? [...new Set<string>(body.campeonato_equipe_ids.map((value: unknown) => text(value, 80)).filter(Boolean))].slice(0, 200)
        : []
      if (!participationIds.length) throw new Error('Selecione ao menos uma equipe para avisar.')
      const notificationType = text(body?.notification_type || 'pending', 40)
      const allowedTypes = new Set(['pending', 'deadline', 'general'])
      if (!allowedTypes.has(notificationType)) throw new Error('Tipo de aviso inválido.')
      const { data: championship, error: championshipError } = await supabaseAdmin.from('campeonatos').select('nome').eq('id', campeonatoId).maybeSingle()
      if (championshipError) throw championshipError
      const championshipName = championship?.nome || 'Campeonato'
      let sent = 0
      for (const participationId of participationIds) {
        const title = notificationType === 'deadline' ? 'Prazo de escolha de grupo próximo' : notificationType === 'general' ? 'Aviso sobre grupo e slot' : 'Escolha de grupo e slot pendente'
        const bodyText = notificationType === 'deadline'
          ? `${championshipName}: confira o prazo e conclua sua escolha de grupo e slot antes do encerramento.`
          : notificationType === 'general'
            ? `${championshipName}: consulte a Central do Campeonato para verificar sua situação de grupo e slot.`
            : `${championshipName}: sua equipe ainda precisa escolher grupo e slot na Central do Campeonato.`
        if (await notifyParticipationOwner({ campeonatoId, participationId, senderId: user.id, type: `escolha_grupo_${notificationType}`, title, body: bodyText, payload: { notification_type: notificationType } })) sent += 1
      }
      return NextResponse.json({ ok: true, sent, ...(await loadStructure(campeonatoId)) })
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

