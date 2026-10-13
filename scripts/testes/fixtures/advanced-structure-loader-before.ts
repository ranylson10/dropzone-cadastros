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

