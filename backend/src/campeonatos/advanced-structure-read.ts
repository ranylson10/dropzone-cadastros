import { supabaseAdmin } from '../shared/supabase-admin'
import { readLimitedRows, readPagedRows, readRowsByIds } from '../shared/paginated-query'

type Row = Record<string, any>
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('Referência de estrutura inválida.')
  return value.toLowerCase()
}
function verifyRows(rows: Row[], column: string, allowed: string[]) {
  const scope = new Set(allowed), ids = new Set<string>()
  for (const row of rows) {
    const id = identifier(row.id)
    if (ids.has(id) || !scope.has(row[column])) throw new Error('Estrutura incompatível com o campeonato solicitado.')
    ids.add(id)
  }
  return rows
}
async function actorNames(history: Row[]) {
  const ids = [...new Set(history.map(row => row.alterado_por).filter((value): value is string => typeof value === 'string' && uuid.test(value)))]
  const names = new Map<string, string>()
  // Avoid hundreds of simultaneous Auth Admin calls for a bounded audit history.
  let next = 0
  await Promise.all(Array.from({ length: Math.min(8, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++]
      let label = ''
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
        if (!error) {
          const metadata = data.user?.user_metadata || {}
          label = String(metadata.full_name || metadata.name || metadata.user_name || '').trim()
        }
      } catch { /* History remains readable when Auth cannot resolve a display label. */ }
      names.set(id, label || `Usuário ${id.slice(0, 8)}`)
    }
  }))
  return history.map(row => ({ ...row, alterado_por_nome: row.alterado_por ? names.get(row.alterado_por) || `Usuário ${String(row.alterado_por).slice(0, 8)}` : 'Sistema' }))
}

/** Caller authorizes championship access. Separate paged reads are not a transactional snapshot. */
export async function loadAdvancedStructure(championship: string) {
  championship = identifier(championship)
  const { data: editionData, error: editionError } = await supabaseAdmin.from('campeonato_edicoes').select('*').eq('campeonato_id', championship).maybeSingle()
  if (editionError) throw editionError
  const edition = editionData as Row | null
  if (edition) verifyRows([edition], 'campeonato_id', [championship])
  const dailyQuery = () => supabaseAdmin.from('campeonato_diario_horarios').select('*').eq('campeonato_id', championship).order('horario').order('id')
  const groupsQuery = () => supabaseAdmin.from('campeonato_grupos').select('id,campeonato_id,nome,fase_id,slots,diario_horario_id,updated_at').eq('campeonato_id', championship).order('nome').order('id')
  const teamsQuery = () => supabaseAdmin.from('campeonato_equipes').select('id,campeonato_id,nome_exibicao,equipe_id,line_id,status,equipes(nome,tag,logo_url),equipe_lines(nome,tag,logo_url)').eq('campeonato_id', championship).eq('status', 'ativo').order('created_at').order('id')
  if (!edition) {
    const [dailyHours, teams, groups] = await Promise.all([readPagedRows<Row>(dailyQuery()), readPagedRows<Row>(teamsQuery()), readPagedRows<Row>(groupsQuery())])
    return { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: verifyRows(dailyHours, 'campeonato_id', [championship]), teams: verifyRows(teams, 'campeonato_id', [championship]), stageTeams: [], phases: [], groups: verifyRows(groups, 'campeonato_id', [championship]), slots: [], groupChoiceConfigs: [], groupChoiceBlocks: [], groupChoiceHistory: [], progressionExecutions: [], progressionExecutionItems: [] }
  }
  const editionId = identifier(edition.id)
  const franchiseId = edition.franquia_id == null ? null : identifier(edition.franquia_id)
  const [franchiseResult, divisions, stages, dailyHours, teams, phases, groups, slots, groupChoiceConfigs, groupChoiceBlocks, history] = await Promise.all([
    franchiseId ? supabaseAdmin.from('campeonato_franquias').select('*').eq('id', franchiseId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_divisoes').select('*').eq('edicao_id', editionId).order('ordem').order('id')),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_etapas').select('*').eq('edicao_id', editionId).order('ordem').order('id')),
    readPagedRows<Row>(dailyQuery()), readPagedRows<Row>(teamsQuery()),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_fases').select('id,campeonato_id,nome,ordem,tipo,status,etapa_id').eq('campeonato_id', championship).order('ordem').order('id')),
    readPagedRows<Row>(groupsQuery()),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_slots').select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,status,equipe_id,line_id').eq('campeonato_id', championship).order('slot_numero').order('id')),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').select('*').eq('campeonato_id', championship).order('id')),
    readPagedRows<Row>(supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').select('*').eq('campeonato_id', championship).eq('ativo', true).order('created_at', { ascending: false }).order('id')),
    readLimitedRows<Row>(supabaseAdmin.from('campeonato_grupo_escolha_historico').select('*').eq('campeonato_id', championship).order('created_at', { ascending: false }).order('id'), 500),
  ])
  if (franchiseResult.error) throw franchiseResult.error
  const franchise = franchiseResult.data as Row | null
  if (franchise && franchise.id !== franchiseId) throw new Error('Franquia incompatível com a edição solicitada.')
  verifyRows(divisions, 'edicao_id', [editionId]); verifyRows(stages, 'edicao_id', [editionId])
  for (const rows of [dailyHours, teams, phases, groups, slots, groupChoiceConfigs, groupChoiceBlocks, history]) verifyRows(rows, 'campeonato_id', [championship])
  const stageIds = stages.map(row => identifier(row.id))
  let sources: Row[] = [], progressions: Row[] = [], prizes: Row[] = [], stageTeams: Row[] = [], progressionExecutions: Row[] = [], progressionExecutionItems: Row[] = []
  if (stageIds.length) {
    [sources, progressions, prizes, stageTeams, progressionExecutions] = await Promise.all([
      readRowsByIds<Row>(stageIds, ids => supabaseAdmin.from('campeonato_etapa_fontes').select('*').in('etapa_destino_id', ids).order('created_at').order('id')),
      readRowsByIds<Row>(stageIds, ids => supabaseAdmin.from('campeonato_progressao_regras').select('*').in('etapa_origem_id', ids).order('created_at').order('id')),
      readRowsByIds<Row>(stageIds, ids => supabaseAdmin.from('campeonato_etapa_premiacoes').select('*').in('etapa_id', ids).order('posicao').order('id')),
      readRowsByIds<Row>(stageIds, ids => supabaseAdmin.from('campeonato_etapa_equipes').select('*').eq('campeonato_id', championship).in('etapa_id', ids).neq('status', 'retirada').order('created_at').order('id')),
      readLimitedRows<Row>(supabaseAdmin.from('campeonato_progressao_execucoes').select('*').eq('campeonato_id', championship).order('created_at', { ascending: false }).order('id'), 30),
    ])
    verifyRows(sources, 'etapa_destino_id', stageIds); verifyRows(progressions, 'etapa_origem_id', stageIds); verifyRows(prizes, 'etapa_id', stageIds); verifyRows(stageTeams, 'etapa_id', stageIds)
    verifyRows(stageTeams, 'campeonato_id', [championship]); verifyRows(progressionExecutions, 'campeonato_id', [championship])
    const executionIds = progressionExecutions.map(row => identifier(row.id))
    progressionExecutionItems = await readRowsByIds<Row>(executionIds, ids => supabaseAdmin.from('campeonato_progressao_execucao_itens').select('*').in('execucao_id', ids).order('posicao_origem').order('id'))
    verifyRows(progressionExecutionItems, 'execucao_id', executionIds)
  }
  // IN batches are fetched sequentially; restore the presentation order across batches.
  const sort = (rows: Row[], key: string) => rows.sort((a, b) => {
    const x = a[key], y = b[key]
    if (x == null && y != null) return 1
    if (x != null && y == null) return -1
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))
    return order || String(a.id).localeCompare(String(b.id))
  })
  return { edition, franchise, divisions, stages, sources: sort(sources, 'created_at'), progressions: sort(progressions, 'created_at'), prizes: sort(prizes, 'posicao'), dailyHours, teams, stageTeams: sort(stageTeams, 'created_at'), phases, groups, slots, groupChoiceConfigs, groupChoiceBlocks, groupChoiceHistory: await actorNames(history), progressionExecutions, progressionExecutionItems: sort(progressionExecutionItems, 'posicao_origem') }
}
