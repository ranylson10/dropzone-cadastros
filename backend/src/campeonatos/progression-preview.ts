import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../shared/paginated-query'
import { listarEstatisticasEquipes } from './estatisticas/estatisticas.service'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
class ProgressionPreviewError extends Error {}
function identifier(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new ProgressionPreviewError('Referência de progressão inválida.')
  return value.toLowerCase()
}
function positiveInteger(value: unknown, fallback?: number) {
  if (value == null && fallback !== undefined) value = fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new ProgressionPreviewError('Faixa de progressão inválida.')
  return value
}
async function scopedStage(championship: string, stageId: string) {
  const { data, error } = await supabaseAdmin.from('campeonato_etapas')
    .select('id,nome,capacidade_total,campeonato_edicoes!inner(campeonato_id)')
    .eq('id', stageId).eq('campeonato_edicoes.campeonato_id', championship).maybeSingle()
  if (error) throw error
  const stage = data as unknown as { id: string; nome: string; capacidade_total: number | null; campeonato_edicoes: { campeonato_id: string } | null } | null
  if (!stage || stage.id !== stageId || stage.campeonato_edicoes?.campeonato_id !== championship) throw new ProgressionPreviewError('Regra inválida para este campeonato.')
  return stage
}

/** Caller authorizes championship management. This read plan is not a transactional write snapshot. */
export async function buildProgressionPreview(championship: string, ruleId: string) {
  try { return await readProgressionPreview(championship, ruleId) }
  catch (error) {
    if (error instanceof ProgressionPreviewError) throw error
    throw new Error('Não foi possível carregar a prévia de progressão. Atualize o acompanhamento e tente novamente.')
  }
}

async function readProgressionPreview(championship: string, ruleId: string) {
  championship = identifier(championship); ruleId = identifier(ruleId)
  const { data: record, error: ruleError } = await supabaseAdmin.from('campeonato_progressao_regras')
    .select('*,origem:campeonato_etapas!campeonato_progressao_regras_etapa_origem_id_fkey!inner(id,campeonato_edicoes!inner(campeonato_id))')
    .eq('id', ruleId).eq('origem.campeonato_edicoes.campeonato_id', championship).maybeSingle()
  if (ruleError) throw ruleError
  if (!record) throw new ProgressionPreviewError('Regra de progressão não encontrada.')
  if (!record.etapa_destino_id) throw new ProgressionPreviewError('A regra não possui etapa de destino.')
  const sourceId = identifier(record.etapa_origem_id), destinationId = identifier(record.etapa_destino_id)
  if (record.id !== ruleId || record.origem?.id !== sourceId || record.origem.campeonato_edicoes?.campeonato_id !== championship || sourceId === destinationId) throw new ProgressionPreviewError('Regra inválida para este campeonato.')
  const { origem: _scope, ...rule } = record
  const start = positiveInteger(rule.posicao_inicio, 1)
  const quantity = rule.quantidade == null ? null : positiveInteger(rule.quantidade)
  const end = positiveInteger(rule.posicao_fim, quantity == null ? start : start + quantity - 1)
  if (end < start) throw new ProgressionPreviewError('Faixa de progressão inválida.')
  const [sourceStage, destinationStage] = await Promise.all([scopedStage(championship, sourceId), scopedStage(championship, destinationId)])
  // The published capacity trigger treats NULL as unbounded and zero as zero vacancies.
  const capacity = destinationStage.capacidade_total
  if (capacity !== null && (typeof capacity !== 'number' || !Number.isSafeInteger(capacity) || capacity < 0)) throw new ProgressionPreviewError('Capacidade da etapa inválida.')
  const { data: phase, error: phaseError } = await supabaseAdmin.from('campeonato_fases')
    .select('id,nome,ordem').eq('campeonato_id', championship).eq('etapa_id', sourceId)
    .order('ordem', { ascending: false }).order('id', { ascending: true }).limit(1).maybeSingle()
  if (phaseError) throw phaseError
  if (!phase) throw new ProgressionPreviewError('Vincule uma fase com resultados à etapa de origem.')
  identifier(phase.id)
  const ranking = await listarEstatisticasEquipes(championship, { faseId: phase.id })
  const rankingIds = new Set<string>()
  for (const row of ranking) {
    const id = identifier(row.campeonato_equipe_id)
    if (rankingIds.has(id)) throw new ProgressionPreviewError('A classificação da progressão contém participantes repetidos.')
    rankingIds.add(id); positiveInteger(row.colocacao)
  }
  const selected = ranking.filter(row => row.colocacao >= start && row.colocacao <= end)
  const [destinationLinks, participants, executionResponse] = await Promise.all([
    readPagedRows<any>(supabaseAdmin.from('campeonato_etapa_equipes').select('*')
      .eq('campeonato_id', championship).eq('etapa_id', destinationId).neq('status', 'retirada').order('id', { ascending: true })),
    readRowsByIds<any>(selected.map(row => row.campeonato_equipe_id), ids => supabaseAdmin.from('campeonato_equipes')
      .select('id,campeonato_id').eq('campeonato_id', championship).in('id', ids).order('id', { ascending: true })),
    supabaseAdmin.from('campeonato_progressao_execucoes').select('id,regra_id,status,created_at')
      .eq('campeonato_id', championship).eq('regra_id', ruleId).eq('status', 'aplicada')
      .order('created_at', { ascending: false }).order('id', { ascending: true }).limit(1).maybeSingle(),
  ])
  if (executionResponse.error) throw executionResponse.error
  const participantIds = new Set(participants.filter(row => row.campeonato_id === championship).map(row => row.id))
  if (selected.some(row => !participantIds.has(row.campeonato_equipe_id))) throw new ProgressionPreviewError('Participação fora deste campeonato. Atualize a classificação.')
  const linksByTeam = new Map<string, any>()
  for (const row of destinationLinks) {
    identifier(row.id); identifier(row.campeonato_equipe_id)
    if (row.campeonato_id !== championship || row.etapa_id !== destinationId || row.status === 'retirada' || linksByTeam.has(row.campeonato_equipe_id)) throw new ProgressionPreviewError('Vínculos da etapa incompatíveis. Atualize a estrutura.')
    linksByTeam.set(row.campeonato_equipe_id, row)
  }
  const available = capacity === null ? null : Math.max(0, capacity - destinationLinks.length)
  const candidates = selected.map(row => {
    const existing = linksByTeam.get(row.campeonato_equipe_id), sameRule = existing?.regra_progressao_id === ruleId
    return { ...row, alreadyApplied: Boolean(sameRule), conflict: Boolean(existing && !sameRule), existingDestination: existing || null }
  })
  const newCount = candidates.filter(row => !row.alreadyApplied && !row.conflict).length
  const conflictCount = candidates.filter(row => row.conflict).length
  return { rule: { ...rule, origem: sourceStage, destino: destinationStage }, phase, candidates,
    activeExecution: executionResponse.data || null,
    summary: { selected: candidates.length, newCount, conflictCount, alreadyApplied: candidates.filter(row => row.alreadyApplied).length,
      capacity, occupied: destinationLinks.length, available, canApply: (available === null || newCount <= available) && conflictCount === 0 },
  }
}
