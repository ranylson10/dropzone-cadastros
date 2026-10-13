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

