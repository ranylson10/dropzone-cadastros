import { supabaseAdmin } from '../../shared/supabase-admin'

export type StreamTransmissionState = {
  active_jogo_id: string | null
  active_partida_id: string | null
  version: number
  updated_at: string | null
  updated_by: string | null
}

const EMPTY_STATE: StreamTransmissionState = {
  active_jogo_id: null,
  active_partida_id: null,
  version: 0,
  updated_at: null,
  updated_by: null,
}

function missingStateColumns(error: any) {
  const message = String(error?.message || '')
  return ['42703', 'PGRST204'].includes(error?.code || '')
    || message.includes('active_partida_id')
    || message.includes('live_state_version')
}

function asState(row: any): StreamTransmissionState {
  return {
    active_jogo_id: row?.active_jogo_id ? String(row.active_jogo_id) : null,
    active_partida_id: row?.active_partida_id ? String(row.active_partida_id) : null,
    version: Number(row?.live_state_version || 0),
    updated_at: row?.updated_at ? String(row.updated_at) : null,
    updated_by: row?.updated_by ? String(row.updated_by) : null,
  }
}

export async function carregarEstadoTransmissao(campeonatoId: string): Promise<StreamTransmissionState> {
  const { data, error } = await supabaseAdmin
    .from('campeonato_stream_pack')
    .select('active_jogo_id,active_partida_id,live_state_version,updated_at,updated_by')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (error) {
    if (!missingStateColumns(error)) throw error
    const { data: legacy, error: legacyError } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .select('active_jogo_id,updated_at,updated_by')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (legacyError) throw legacyError
    return { ...EMPTY_STATE, ...asState(legacy) }
  }
  return data ? asState(data) : EMPTY_STATE
}

type UpdateTransmissionState = {
  activeJogoId: string | null
  activePartidaId?: string | null
  expectedVersion?: number | null
}

export async function atualizarEstadoTransmissao(
  campeonatoId: string,
  userId: string,
  input: UpdateTransmissionState,
): Promise<StreamTransmissionState> {
  const jogoId = input.activeJogoId ? String(input.activeJogoId) : null
  const partidaId = input.activePartidaId ? String(input.activePartidaId) : null

  if (partidaId && !jogoId) throw new Error('Defina o jogo da transmissao antes da queda.')
  if (jogoId) {
    const { data: jogo, error } = await supabaseAdmin
      .from('campeonato_jogos')
      .select('id')
      .eq('id', jogoId)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (error) throw error
    if (!jogo) throw new Error('Jogo invalido para este campeonato.')
  }
  if (partidaId) {
    const { data: partida, error } = await supabaseAdmin
      .from('campeonato_partidas')
      .select('id')
      .eq('id', partidaId)
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .maybeSingle()
    if (error) throw error
    if (!partida) throw new Error('Queda invalida para o jogo da transmissao.')
  }

  const current = await carregarEstadoTransmissao(campeonatoId)
  if (input.expectedVersion != null && Number(input.expectedVersion) !== current.version) {
    const error = new Error('O estado da transmissao foi alterado em outro pontuador. Atualize antes de tentar novamente.')
    ;(error as any).code = 'STREAM_STATE_CONFLICT'
    throw error
  }

  const nextPartidaId = input.activePartidaId === undefined
    ? (current.active_jogo_id === jogoId ? current.active_partida_id : null)
    : partidaId
  if (current.active_jogo_id === jogoId && current.active_partida_id === nextPartidaId) return current
  const now = new Date().toISOString()
  const payload = {
    active_jogo_id: jogoId,
    active_partida_id: nextPartidaId,
    live_state_version: current.version + 1,
    updated_at: now,
    updated_by: userId,
  }

  if (current.updated_at) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .update(payload)
      .eq('campeonato_id', campeonatoId)
      .eq('live_state_version', current.version)
      .select('active_jogo_id,active_partida_id,live_state_version,updated_at,updated_by')
      .maybeSingle()
    if (error) {
      if (missingStateColumns(error)) throw new Error('Aplique a migration 20260829_stream_transmission_state.sql.')
      throw error
    }
    if (!data) throw new Error('O estado da transmissao mudou durante a operacao. Atualize e tente novamente.')
    return asState(data)
  }

  const { data, error } = await supabaseAdmin
    .from('campeonato_stream_pack')
    .insert({ campeonato_id: campeonatoId, ...payload })
    .select('active_jogo_id,active_partida_id,live_state_version,updated_at,updated_by')
    .single()
  if (error) {
    if (missingStateColumns(error)) throw new Error('Aplique a migration 20260829_stream_transmission_state.sql.')
    if (error.code === '23505') throw new Error('Outro pontuador criou o estado da transmissao. Atualize e tente novamente.')
    throw error
  }
  return asState(data)
}
