import {operationJson,operationUuid} from '../shared/operation-json'
export type ProgressionReadContract = { progression_write_mode?: unknown; progression_actor_id?: unknown }
export type ProgressionIntent = { action: 'apply_progression' | 'reverse_progression'; rule_id?: string;
  replace_conflicts?: boolean; expected?: Record<string, any>; execution_id?: string; reason?: string | null }
const pattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
export function progressionUuid(value:unknown):string{try{return operationUuid(value)}catch{throw new Error('Atualize o acompanhamento da progressão.')}}
export function progressionMode(value:ProgressionReadContract):'legacy'|'atomic'{if(value.progression_write_mode==null||value.progression_write_mode==='legacy')return'legacy';if(value.progression_write_mode==='atomic')return'atomic';throw new Error('Progressão temporariamente indisponível.')}
export const progressionJson=operationJson
export function progressionIntent(value: Record<string, any>): ProgressionIntent {
  if (value.action === 'reverse_progression') {
    if (value.reason != null && typeof value.reason !== 'string') throw new Error('Motivo de reversão inválido.')
    return { action: value.action, execution_id: progressionUuid(value.execution_id), reason: value.reason?.trim().slice(0, 500) || null }
  }
  if (value.action !== 'apply_progression' || typeof value.replace_conflicts !== 'boolean' || !object(value.expected)
    || !['rule', 'source', 'destination', 'phase'].every(key => object(value.expected[key]))
    || !['ranking', 'source_links', 'destination_links', 'participants'].every(key => Array.isArray(value.expected[key]))) {
    throw new Error('Gere uma prévia atual antes de aplicar a progressão.')
  }
  const rule = progressionUuid(value.rule_id)
  if (value.expected.rule.id !== rule) throw new Error('A regra da prévia mudou. Gere outra prévia.')
  return { action: value.action, rule_id: rule, replace_conflicts: value.replace_conflicts, expected: JSON.parse(progressionJson(value.expected)) }
}
export function assertProgressionResponse(result: any, actor: string, championship: string, body: Record<string, any>, request?: string) {
  const action = body.action === 'preview_progression' ? 'preview' : body.action === 'apply_progression' ? 'apply' : 'reverse'
  const failure = () => { throw new Error('Não foi possível confirmar o resultado da progressão. Confira o acompanhamento e repita a tentativa original.') }
  if (!object(result) || result.ok !== true || result.actor_id !== actor || result.campeonato_id !== championship || result.progression_action !== action) failure()
  if (request && (result.operation_confirmed !== true || result.request_id !== request)) failure()
  if (action !== 'reverse') {
    const preview = result.preview
    if (!object(preview) || preview.rule?.id !== body.rule_id || !object(preview.fence) || preview.fence.rule?.id !== body.rule_id
      || !Array.isArray(preview.candidates) || preview.candidates.length > 1000 || preview.summary?.selected !== preview.candidates.length
      || !preview.candidates.every((row: any) => object(row) && pattern.test(row.campeonato_equipe_id || '') && Number.isSafeInteger(row.colocacao) && row.colocacao > 0)
      || new Set(preview.candidates.map((row: any) => row.campeonato_equipe_id)).size !== preview.candidates.length) failure()
    progressionIntent({ action: 'apply_progression', rule_id: body.rule_id, replace_conflicts: false, expected: preview.fence })
  }
  if (action === 'apply' && (!Number.isSafeInteger(result.applied) || result.applied < 0 || result.applied > 1000
    || (result.execution_id !== null && !pattern.test(result.execution_id || '')) || (result.applied > 0 && !result.execution_id))) failure()
  if (action === 'reverse' && (result.execution_id !== body.execution_id || !Number.isSafeInteger(result.reversed) || result.reversed < 0 || result.reversed > 1000)) failure()
}
