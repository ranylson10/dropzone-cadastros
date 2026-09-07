import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../../shared/supabase-admin'

type EngineResultV1 = {
  version: 1
  idempotency_key: string
  context: { campeonato_id: string; fase_id: string; jogo_id: string; partida_id: string; numero_queda?: number | null; mapa?: string | null }
  match_id?: string | null
  teams: Array<{ campeonato_equipe_id: string; placement: number; kills: number; team_id_externo?: string | null; nome?: string | null }>
  players: Array<{ campeonato_jogador_id: string; campeonato_equipe_id: string; player_id_externo?: string | null; nick?: string | null; kills: number; damage?: number | null; assists?: number | null; revives?: number | null }>
  weapons?: unknown[]
  loadouts?: unknown[]
  source: { name: 'DPZ Live Engine'; session_id: string; finalized_at: string; api_fetched_at?: string | null; player_log_last_event_at?: string | null; api_finalized: true }
}

function requireText(value: unknown, label: string) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`${label} é obrigatório.`)
  return text
}

export function validateEngineResultV1(campeonatoId: string, partidaId: string, input: unknown): EngineResultV1 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload de resultado inválido.')
  const body = input as EngineResultV1
  if (body.version !== 1) throw new Error('Versão de resultado não suportada.')
  if (body.source?.name !== 'DPZ Live Engine' || body.source?.api_finalized !== true) throw new Error('O resultado precisa vir de um fechamento oficial do DPZ Live Engine.')
  if (requireText(body.context?.campeonato_id, 'campeonato_id') !== campeonatoId || requireText(body.context?.partida_id, 'partida_id') !== partidaId) {
    throw new Error('A URL e o contexto do resultado não correspondem.')
  }
  requireText(body.context?.fase_id, 'fase_id'); requireText(body.context?.jogo_id, 'jogo_id')
  const key = requireText(body.idempotency_key, 'idempotency_key')
  if (key.length > 128) throw new Error('idempotency_key excede 128 caracteres.')
  if (!Array.isArray(body.teams) || body.teams.length === 0 || !Array.isArray(body.players)) throw new Error('Equipes/jogadores do resultado são inválidos.')
  const teams = new Set<string>()
  for (const team of body.teams) {
    const id = requireText(team?.campeonato_equipe_id, 'campeonato_equipe_id')
    if (teams.has(id)) throw new Error('campeonato_equipe_id duplicado no resultado.')
    if (!Number.isInteger(team.placement) || team.placement < 1 || !Number.isInteger(team.kills) || team.kills < 0) throw new Error('Posição/abates de equipe inválidos.')
    teams.add(id)
  }
  const players = new Set<string>()
  for (const player of body.players) {
    const id = requireText(player?.campeonato_jogador_id, 'campeonato_jogador_id')
    if (players.has(id)) throw new Error('campeonato_jogador_id duplicado no resultado.')
    if (!teams.has(requireText(player?.campeonato_equipe_id, 'campeonato_equipe_id do jogador'))) throw new Error('Jogador referencia equipe ausente.')
    if (!Number.isInteger(player.kills) || player.kills < 0) throw new Error('Abates de jogador inválidos.')
    players.add(id)
  }
  return body
}

export async function ingestEngineResultV1(campeonatoId: string, partidaId: string, userId: string, input: unknown) {
  const payload = validateEngineResultV1(campeonatoId, partidaId, input)
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const { data, error } = await supabaseAdmin.rpc('fn_ingerir_resultado_dpz_engine_v1', {
    p_payload: payload, p_payload_hash: payloadHash, p_user_id: userId,
  })
  if (error) throw error
  return data as { ok: true; already_processed: boolean; result_id: string; partida_id: string; match_id: string | null; processed_at: string }
}
