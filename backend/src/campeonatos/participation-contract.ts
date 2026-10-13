/** Pure wire contract shared by web and mobile. Contains no server credentials or database client. */
export type ParticipationMode = 'legacy' | 'atomic'
export type ParticipationExpected = {
  equipe_id: string; line_id: string; slot_id: string | null;
  status: 'ativo' | 'pendente' | 'rejeitado'; updated_at: string;
}
export type ParticipationIntent = {
  method: 'POST' | 'PATCH' | 'DELETE'; participationId: string | null; body: Record<string, unknown>;
}
export type ParticipationReadContract = { participation_write_mode?: ParticipationMode; participation_actor_id?: string | null }
const pattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
export function participationUuid(value: unknown): string {
  if (typeof value !== 'string' || !pattern.test(value.trim())) throw new Error('Atualize o acompanhamento antes de confirmar a inscrição.')
  return value.trim().toLowerCase()
}
export function participationExpected(value: unknown): ParticipationExpected {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Atualize o acompanhamento antes de alterar a participação.')
  const row = value as Record<string, unknown>
  if (!Object.hasOwn(row, 'slot_id') || !['ativo', 'pendente', 'rejeitado'].includes(String(row.status))
    || typeof row.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(row.updated_at)
    || !Number.isFinite(Date.parse(row.updated_at))) throw new Error('Atualize o acompanhamento antes de alterar a participação.')
  return { equipe_id: participationUuid(row.equipe_id), line_id: participationUuid(row.line_id),
    slot_id: row.slot_id === null ? null : participationUuid(row.slot_id),
    status: row.status as ParticipationExpected['status'], updated_at: row.updated_at }
}
function bounded(value: unknown, max: number) {
  if (value == null) return null
  if (typeof value !== 'string' || value.length > max) throw new Error('Texto de inscrição inválido.')
  return value.trim() || null
}
export function participationIntent(method: ParticipationIntent['method'], value: Record<string, unknown>, removalId?: unknown): ParticipationIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inscrição inválida.')
  let body: Record<string, unknown>, participationId: string | null = null
  if (method === 'POST') {
    if (value.mode != null && value.mode !== '' && value.mode !== 'request') throw new Error('Operação de inscrição ainda indisponível neste fluxo.')
    const line = value.line_id == null || value.line_id === '' ? null : participationUuid(value.line_id)
    body = { equipe_id: participationUuid(value.equipe_id), line_id: line }
    if (value.mode === 'request') {
      if (!line) throw new Error('Selecione a line da inscrição.')
      body.mode = 'request'
    } else {
      body.slot_id = participationUuid(value.slot_id || value.vaga_id)
      body.nome_line = bounded(value.nome_line, 120)
      body.origem_entrada = bounded(value.origem_entrada, 40)
      if (!line && !body.nome_line) throw new Error('Selecione uma line ou informe seu nome.')
    }
  } else {
    const expected = participationExpected(value.expected)
    if (method === 'DELETE') {
      if (expected.status !== 'ativo') throw new Error('Atualize o acompanhamento antes de remover a participação.')
      participationId = participationUuid(removalId)
      body = { expected }
    } else if (method === 'PATCH' && value.mode === 'review_request' && ['approve', 'reject'].includes(String(value.action))) {
      if (expected.status === 'ativo' || expected.slot_id !== null) throw new Error('Atualize o acompanhamento antes de revisar a inscrição.')
      body = { mode: 'review_request', action: value.action, participacao_id: participationUuid(value.participacao_id || value.request_id), expected }
      if (value.action === 'approve') { body.slot_id = participationUuid(value.slot_id); body.origem_entrada = bounded(value.origem_entrada, 40) }
      else body.motivo = bounded(value.motivo, 500)
    } else throw new Error('Inscrição inválida.')
  }
  return { method, participationId, body }
}
export function participationMode(contract: ParticipationReadContract): ParticipationMode {
  const mode = contract?.participation_write_mode ?? 'legacy'
  if (mode !== 'legacy' && mode !== 'atomic') throw new Error('Inscrições temporariamente indisponíveis.')
  return mode
}
export function assertParticipationConfirmed(result: any, championship: string, intent: ParticipationIntent) {
  const action = intent.method === 'DELETE' ? 'remove' : intent.method === 'PATCH' ? intent.body.action : intent.body.mode === 'request' ? 'request' : 'add'
  const part = result?.participacao, expected = intent.body.expected as ParticipationExpected | undefined
  const state = action === 'remove' ? 'removido' : action === 'reject' ? 'rejeitado' : action === 'request' ? 'pendente' : 'ativo'
  if (result?.ok !== true || result.operation_confirmed !== true || result.campeonato_id !== championship || result.action !== action
    || !part || part.campeonato_id !== championship || part.status !== state
    || (intent.participationId && part.id !== intent.participationId) || (intent.body.participacao_id && part.id !== intent.body.participacao_id)
    || part.equipe_id !== (expected?.equipe_id || intent.body.equipe_id)
    || ((expected?.line_id || intent.body.line_id) && part.line_id !== (expected?.line_id || intent.body.line_id))
    || (['add', 'approve'].includes(String(action)) ? part.slot_id !== intent.body.slot_id || !pattern.test(part.grupo_id || '')
      || !Number.isInteger(part.slot_numero) || part.slot_numero < 1 : part.slot_id !== null || part.grupo_id !== null || part.slot_numero !== null)
    || (action === 'reject' && part.motivo_rejeicao !== intent.body.motivo)
    || (['add', 'approve', 'request'].includes(String(action)) && (result.line?.id !== part.line_id
      || typeof result.line?.nome !== 'string' || typeof result.line?.criada_agora !== 'boolean'))) {
    throw new Error('Não foi possível confirmar o resultado. Confira o acompanhamento e confirme a tentativa anterior.')
  }
  try { participationUuid(part.id); participationUuid(part.line_id); participationExpected({ ...part, status: 'ativo' }) }
  catch { throw new Error('Não foi possível confirmar o resultado. Confira o acompanhamento e confirme a tentativa anterior.') }
}
