import { operationUuid } from '../shared/operation-json'

export type LifecycleReadContract = { lifecycle_write_mode?: 'unavailable' | 'atomic'; edition_actor_id?: string }
export type LifecycleFence = { edition_id: string; revision: number; publication_id: string | null; plan_hash: string }
export type LifecycleAction = 'publish_final' | 'reopen_final'
export type LifecycleIntent = { action: LifecycleAction; expected: LifecycleFence }
const object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: any, maximum = 9007199254740991) => Number.isSafeInteger(value) && value >= 0 && value <= maximum
const date = (value: any) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
export function lifecycleFence(value: any): LifecycleFence {
  if (!object(value) || !integer(value.revision) || typeof value.plan_hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.plan_hash)) throw new Error('Confira novamente a prévia de encerramento.')
  return { edition_id: operationUuid(value.edition_id), revision: value.revision, publication_id: value.publication_id === null ? null : operationUuid(value.publication_id), plan_hash: value.plan_hash }
}
export function lifecycleIntent(value: any): LifecycleIntent {
  if (!object(value) || !['publish_final', 'reopen_final'].includes(value.action)) throw new Error('Ação de encerramento inválida.')
  const expected = lifecycleFence(value.expected)
  if ((value.action === 'publish_final') !== (expected.publication_id === null)) throw new Error('Publicação incompatível com a confirmação.')
  return { action: value.action, expected }
}
export function assertLifecycleResponse(result: any, actor: string, champ: string, request: string, body: { action: string; expected?: LifecycleFence }) {
  const fail = () => { throw new Error('Não foi possível confirmar o resultado. Confira o histórico e repita a tentativa original.') }
  if (!object(result) || result.mode !== 'atomic' || result.actor_id !== actor || result.campeonato_id !== champ || result.request_id !== request || result.action !== body.action) fail()
  if (body.action.startsWith('preview_')) {
    const p = result.preview
    if (!object(p) || !object(p.edition) || !['ativa','planejada','encerrada'].includes(p.edition.status) || !date(p.edition.data_fim)
      || !integer(p.stages, 1000) || !integer(p.divisions, 1000) || !object(p.plan) || !integer(p.plan.falls, 5000) || !p.plan.falls
      || !integer(p.plan.total_equipes, 1000000) || !p.plan.total_equipes || typeof p.plan.gold_reached !== 'boolean' || !Array.isArray(p.plan.groups) || p.plan.groups.length > 1000 || !Array.isArray(p.plan.ranking) || p.plan.ranking.length > 1000) fail()
    const fence = lifecycleFence(p.fence)
    if (p.edition.id !== fence.edition_id || (body.action === 'preview_publish_final') !== (fence.publication_id === null)) fail()
    if (p.plan.champion_id !== null) operationUuid(p.plan.champion_id)
    for (const name of ['phase_id','decisive_game_id','winner_fall_id']) if (p.plan[name] !== null) operationUuid(p.plan[name])
    if (!(p.plan.champion_name === null || (typeof p.plan.champion_name === 'string' && p.plan.champion_name.length <= 1000))) fail()
    for (const group of p.plan.groups) {
      if (!object(group) || typeof group.nome !== 'string' || group.nome.length > 1000 || !integer(group.total_equipes, 1000) || !group.total_equipes || !Array.isArray(group.ranking) || group.ranking.length !== group.total_equipes) fail()
      operationUuid(group.id)
    }
    const all = [p.plan.ranking, ...p.plan.groups.map((g: any) => g.ranking)]
    for (const rows of all) {
      const ids = new Set<string>()
      for (let n = 0; n < rows.length; n++) {
        const row = rows[n]
        if (!object(row) || ids.has(row.campeonato_equipe_id) || row.colocacao !== n + 1 || !integer(row.quedas, 50000) || !integer(row.booyahs, 50000) || !integer(row.abates)
          || typeof row.pontos_total !== 'number' || !Number.isFinite(row.pontos_total) || !integer(row.melhor_posicao, 2147483647)) fail()
        ids.add(operationUuid(row.campeonato_equipe_id))
      }
    }
    if (p.plan.groups.length ? p.plan.champion_id !== null || p.plan.groups.reduce((sum: number, g: any) => sum + g.total_equipes, 0) !== p.plan.total_equipes
      : !p.plan.ranking.some((row: any) => row.campeonato_equipe_id === p.plan.champion_id)) fail()
    return
  }
  if (result.operation_confirmed !== true || typeof result.repetida !== 'boolean' || result.registrations_open !== false || !integer(result.revision)
    || !object(result.edition) || result.edition.id !== body.expected?.edition_id || result.edition.campeonato_id !== champ || !date(result.edition.data_fim)
    || result.edition.status !== (body.action === 'publish_final' ? 'encerrada' : 'ativa') || !integer(result.total_equipes, 1000000) || !result.total_equipes) fail()
  operationUuid(result.publication_id)
  if (body.action === 'reopen_final' && (result.publication_id !== body.expected?.publication_id || result.edition.data_fim !== null || result.champion_id !== null)) fail()
  if (body.action === 'publish_final') {
    if (result.edition.data_fim === null) fail()
    if (result.champion_id !== null) operationUuid(result.champion_id)
  }
}
