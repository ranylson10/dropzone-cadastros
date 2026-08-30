import { supabaseAdmin } from '../../shared/supabase-admin'

export type StreamJogoOption = {
  id: string
  nome: string
  status: string
  data_jogo: string | null
  horario: string | null
  numero_partidas: number
}

export type StreamContext = {
  /** Jogo que alimenta mapas do dia / partida atual / stats por jogo. */
  activeJogoId: string | null
  /** Queda explicitamente publicada, independente de status ou tela aberta. */
  activePartidaId: string | null
  /** true depois que um operador usa o novo controle versionado. */
  explicitState: boolean
  /** Origem: pack (manual) | partida_em_andamento | data_hoje | ultimo_jogo | none */
  source: 'pack' | 'partida_em_andamento' | 'data_hoje' | 'ultimo_jogo' | 'none'
  activeJogo: StreamJogoOption | null
  jogos: StreamJogoOption[]
}

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function asJogo(row: any): StreamJogoOption {
  return {
    id: String(row.id),
    nome: String(row.nome || 'Jogo'),
    status: String(row.status || ''),
    data_jogo: row.data_jogo ? String(row.data_jogo).slice(0, 10) : null,
    horario: row.horario != null ? String(row.horario) : null,
    numero_partidas: Number(row.numero_partidas || 0),
  }
}

/**
 * Resolve o jogo ativo da live.
 * Prioridade:
 * 1. active_jogo_id salvo no pack (manual)
 * 2. jogo com partida status = em_andamento
 * 3. jogo com data_jogo = hoje
 * 4. jogo em_andamento
 * 5. último jogo cadastrado com partidas
 */
export async function resolveStreamContext(campeonatoId: string): Promise<StreamContext> {
  const empty: StreamContext = {
    activeJogoId: null,
    activePartidaId: null,
    explicitState: false,
    source: 'none',
    activeJogo: null,
    jogos: [],
  }

  const { data: jogosRaw, error: jogosErr } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id, nome, status, data_jogo, horario, numero_partidas')
    .eq('campeonato_id', campeonatoId)
    .order('data_jogo', { ascending: true, nullsFirst: false })
    .order('horario', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (jogosErr || !jogosRaw?.length) return empty

  const jogos = jogosRaw.map(asJogo)
  const byId = new Map(jogos.map((j) => [j.id, j]))

  // 1) estado manual da transmissao
  try {
    let { data: pack, error: packError } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .select('active_jogo_id,active_partida_id,live_state_version')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (packError && ['42703', 'PGRST204'].includes(packError.code || '')) {
      const legacy = await supabaseAdmin
        .from('campeonato_stream_pack')
        .select('active_jogo_id')
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()
      pack = legacy.data as any
      packError = legacy.error
    }
    if (packError) throw packError
    const packJogoId = pack?.active_jogo_id ? String(pack.active_jogo_id) : ''
    const explicitState = Number((pack as any)?.live_state_version || 0) > 0
    if (packJogoId && byId.has(packJogoId)) {
      const requestedPartidaId = (pack as any)?.active_partida_id ? String((pack as any).active_partida_id) : ''
      let activePartidaId: string | null = null
      if (requestedPartidaId) {
        const { data: partida } = await supabaseAdmin
          .from('campeonato_partidas')
          .select('id')
          .eq('id', requestedPartidaId)
          .eq('campeonato_id', campeonatoId)
          .eq('jogo_id', packJogoId)
          .maybeSingle()
        activePartidaId = partida?.id ? String(partida.id) : null
      }
      return {
        activeJogoId: packJogoId,
        activePartidaId,
        explicitState,
        source: 'pack',
        activeJogo: byId.get(packJogoId) || null,
        jogos,
      }
    }
    if (explicitState) {
      return { ...empty, source: 'pack', explicitState: true, jogos }
    }
  } catch {
    // coluna pode não existir ainda
  }

  // 2) partida em_andamento
  try {
    const { data: livePartida } = await supabaseAdmin
      .from('campeonato_partidas')
      .select('id,jogo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('status', 'em_andamento')
      .order('numero_partida', { ascending: true })
      .limit(1)
      .maybeSingle()
    const jid = livePartida?.jogo_id ? String(livePartida.jogo_id) : ''
    if (jid && byId.has(jid)) {
      return {
        activeJogoId: jid,
        activePartidaId: livePartida?.id ? String(livePartida.id) : null,
        explicitState: false,
        source: 'partida_em_andamento',
        activeJogo: byId.get(jid) || null,
        jogos,
      }
    }
  } catch {
    // ignore
  }

  // 3) data de hoje
  const today = todayIsoDate()
  const hoje = jogos.find((j) => j.data_jogo === today)
  if (hoje) {
    return {
      activeJogoId: hoje.id,
      activePartidaId: null,
      explicitState: false,
      source: 'data_hoje',
      activeJogo: hoje,
      jogos,
    }
  }

  // 4) status do jogo em_andamento
  const jogoLive = jogos.find((j) => /em_andamento|andamento|live/i.test(j.status))
  if (jogoLive) {
    return {
      activeJogoId: jogoLive.id,
      activePartidaId: null,
      explicitState: false,
      source: 'partida_em_andamento',
      activeJogo: jogoLive,
      jogos,
    }
  }

  // 5) último jogo com partidas (ou último da lista)
  try {
    const { data: lastPartida } = await supabaseAdmin
      .from('campeonato_partidas')
      .select('jogo_id')
      .eq('campeonato_id', campeonatoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const jid = lastPartida?.jogo_id ? String(lastPartida.jogo_id) : ''
    if (jid && byId.has(jid)) {
      return {
        activeJogoId: jid,
        activePartidaId: null,
        explicitState: false,
        source: 'ultimo_jogo',
        activeJogo: byId.get(jid) || null,
        jogos,
      }
    }
  } catch {
    // ignore
  }

  const last = jogos[jogos.length - 1]
  return {
    activeJogoId: last?.id || null,
    activePartidaId: null,
    explicitState: false,
    source: last ? 'ultimo_jogo' : 'none',
    activeJogo: last || null,
    jogos,
  }
}

/** Carrega partidas do campeonato, opcionalmente só do jogo ativo. */
export async function loadPartidasForStream(campeonatoId: string, jogoId?: string | null) {
  let partidas: any[] = []

  const q1 = await supabaseAdmin
    .from('campeonato_partidas_com_mapa')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .order('numero_partida', { ascending: true })

  if (!q1.error && q1.data) {
    partidas = q1.data
  } else {
    const q2 = await supabaseAdmin
      .from('campeonato_partidas')
      .select('id, campeonato_id, jogo_id, fase_id, grupo_id, numero_partida, mapa_codigo, status, horario')
      .eq('campeonato_id', campeonatoId)
      .order('numero_partida', { ascending: true })
    partidas = q2.data || []
  }

  if (jogoId) {
    partidas = partidas.filter((p) => String(p.jogo_id || '') === String(jogoId))
  }

  partidas = partidas.slice().sort((a, b) => {
    const ja = String(a.jogo_id || '')
    const jb = String(b.jogo_id || '')
    if (ja !== jb) return ja.localeCompare(jb)
    return Number(a.numero_partida || 0) - Number(b.numero_partida || 0)
  })

  return partidas
}
