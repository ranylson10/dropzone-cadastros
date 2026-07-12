import { supabaseAdmin } from '../../shared/supabase-admin'

type Filters = {
  faseId?: string | null
  rodadaId?: string | null
  jogoId?: string | null
  partidaId?: string | null
  mapaCodigo?: string | null
  grupoId?: string | null
}

function applyFilters(query: any, filters: Filters) {
  let result = query
  if (filters.faseId) result = result.eq('fase_id', filters.faseId)
  if (filters.rodadaId) result = result.eq('rodada_id', filters.rodadaId)
  if (filters.jogoId) result = result.eq('jogo_id', filters.jogoId)
  if (filters.partidaId) result = result.eq('partida_id', filters.partidaId)
  if (filters.mapaCodigo) result = result.eq('mapa_codigo', filters.mapaCodigo)
  if (filters.grupoId) result = result.eq('grupo_id', filters.grupoId)
  return result
}

export async function listarEstatisticasEquipes(campeonatoId: string, filters: Filters) {
  const query = applyFilters(
    supabaseAdmin
      .from('campeonato_estatisticas_equipes_detalhe')
      .select('*')
      .eq('campeonato_id', campeonatoId),
    filters,
  )
  const { data, error } = await query
  if (error) throw error

  const aggregate = new Map<string, any>()
  for (const row of data || []) {
    const key = row.campeonato_equipe_id
    const current = aggregate.get(key) || {
      campeonato_equipe_id: key,
      equipe_id: row.equipe_id,
      line_id: row.line_id,
      nome: row.nome_exibicao || row.line_nome || row.equipe_nome || 'Equipe',
      tag: row.line_tag || row.equipe_tag || null,
      logo_url: row.line_logo_url || row.equipe_logo_url || null,
      quedas: 0,
      booyahs: 0,
      abates: 0,
      pontos_posicao: 0,
      pontos_abates: 0,
      pontos_total: 0,
      melhor_posicao: null as number | null,
    }
    current.quedas += 1
    current.booyahs += row.booyah ? 1 : 0
    current.abates += Number(row.abates || 0)
    current.pontos_posicao += Number(row.pontos_posicao || 0)
    current.pontos_abates += Number(row.pontos_abates || 0)
    current.pontos_total += Number(row.pontos_total || 0)
    current.melhor_posicao = current.melhor_posicao === null
      ? Number(row.posicao)
      : Math.min(current.melhor_posicao, Number(row.posicao))
    aggregate.set(key, current)
  }

  return [...aggregate.values()]
    .sort((a, b) => b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates)
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
}

export async function listarEstatisticasMvp(campeonatoId: string, filters: Filters) {
  const query = applyFilters(
    supabaseAdmin
      .from('campeonato_estatisticas_mvp_detalhe')
      .select('*')
      .eq('campeonato_id', campeonatoId),
    filters,
  )
  const { data, error } = await query
  if (error) throw error

  const aggregate = new Map<string, any>()
  for (const row of data || []) {
    const key = row.campeonato_jogador_id
    const current = aggregate.get(key) || {
      campeonato_jogador_id: key,
      jogador_id: row.jogador_id,
      jogador_temporario_id: row.jogador_temporario_id,
      campeonato_equipe_id: row.campeonato_equipe_id,
      nick: row.nick,
      id_jogo: row.id_jogo,
      foto_url: row.foto_url,
      tipo_jogador: row.tipo_jogador,
      quedas: 0,
      abates: 0,
      dano: 0,
      assistencias: 0,
      revives: 0,
    }
    current.quedas += 1
    current.abates += Number(row.abates || 0)
    current.dano += Number(row.dano || 0)
    current.assistencias += Number(row.assistencias || 0)
    current.revives += Number(row.revives || 0)
    aggregate.set(key, current)
  }

  return [...aggregate.values()]
    .sort((a, b) => b.abates - a.abates || b.dano - a.dano)
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
}

export async function carregarSumula(campeonatoId: string, partidaId?: string | null) {
  let partidasQuery = supabaseAdmin
    .from('campeonato_partidas_com_mapa')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .order('data_jogo', { ascending: true })
    .order('horario', { ascending: true })
    .order('numero_partida', { ascending: true })
  if (partidaId) partidasQuery = partidasQuery.eq('id', partidaId)

  const [{ data: partidas, error: partidasError }, { data: equipes, error: equipesError }, { data: jogadores, error: jogadoresError }] = await Promise.all([
    partidasQuery,
    supabaseAdmin.from('campeonato_equipes').select('*, equipes(id,nome,tag,logo_url), equipe_lines(id,nome,tag,logo_url)').eq('campeonato_id', campeonatoId).eq('status', 'ativo'),
    supabaseAdmin.from('campeonato_jogadores').select('*, jogadores(id,nome,avatar_url,id_jogo), jogadores_temporarios(id,nick,foto_url,id_jogo,status)').eq('campeonato_id', campeonatoId).eq('status', 'ativo'),
  ])
  if (partidasError) throw partidasError
  if (equipesError) throw equipesError
  if (jogadoresError) throw jogadoresError

  return { partidas: partidas || [], equipes: equipes || [], jogadores: jogadores || [] }
}

type ManualBody = {
  partida_id: string
  origem?: 'manual' | 'matchresult'
  equipes: Array<{
    campeonato_equipe_id: string
    posicao: number
    abates: number
    punicao_pontos?: number
    punicao_motivo?: string | null
    raw_team_name?: string | null
    importacao_equipe_id?: string | null
    jogadores?: Array<{ campeonato_jogador_id: string; abates: number; dano?: number; assistencias?: number; revives?: number }>
  }>
}

export async function salvarPontuacaoManual(campeonatoId: string, userId: string, body: ManualBody) {
  if (!body?.partida_id || !Array.isArray(body.equipes) || body.equipes.length === 0) {
    throw new Error('Informe a queda e pelo menos uma equipe.')
  }
  const { data: partida, error: partidaError } = await supabaseAdmin
    .from('campeonato_partidas')
    .select('id,campeonato_id,fase_id,jogo_id,grupo_id,status')
    .eq('id', body.partida_id)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (partidaError) throw partidaError
  if (!partida) throw new Error('Queda não encontrada.')
  if (partida.status === 'finalizada') throw new Error('A queda já foi finalizada.')

  const teamRows: any[] = []
  const playerRows: any[] = []
  for (const item of body.equipes) {
    if (!Number.isInteger(item.posicao) || item.posicao < 1 || !Number.isInteger(item.abates) || item.abates < 0) {
      throw new Error('Posição e abates da equipe são inválidos.')
    }
    const { data: ce, error: ceError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,line_id,grupo_id,slot_numero')
      .eq('id', item.campeonato_equipe_id)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (ceError) throw ceError
    if (!ce) throw new Error('Equipe da súmula não pertence ao campeonato.')

    teamRows.push({
      campeonato_id: campeonatoId,
      fase_id: partida.fase_id,
      jogo_id: partida.jogo_id,
      partida_id: partida.id,
      grupo_id: ce.grupo_id || partida.grupo_id,
      campeonato_equipe_id: ce.id,
      equipe_id: ce.equipe_id,
      line_id: ce.line_id,
      slot_numero: ce.slot_numero,
      posicao: item.posicao,
      abates: item.abates,
      punicao_pontos: Math.min(Number(item.punicao_pontos || 0), 0),
      punicao_motivo: item.punicao_motivo?.trim() || null,
      booyah: item.posicao === 1,
      origem: body.origem || 'manual',
      raw_team_name: item.raw_team_name || null,
      criado_por: userId,
      updated_at: new Date().toISOString(),
    })

    for (const player of item.jogadores || []) {
      const { data: cj, error: cjError } = await supabaseAdmin
        .from('campeonato_jogadores')
        .select('id,jogador_id,equipe_id,line_id,nick,id_jogo,campeonato_equipe_id')
        .eq('id', player.campeonato_jogador_id)
        .eq('campeonato_id', campeonatoId)
        .eq('campeonato_equipe_id', ce.id)
        .maybeSingle()
      if (cjError) throw cjError
      if (!cj) throw new Error('Jogador não pertence à equipe informada.')
      playerRows.push({
        campeonato_id: campeonatoId,
        fase_id: partida.fase_id,
        jogo_id: partida.jogo_id,
        partida_id: partida.id,
        grupo_id: ce.grupo_id || partida.grupo_id,
        campeonato_equipe_id: ce.id,
        campeonato_jogador_id: cj.id,
        jogador_id: cj.jogador_id,
        equipe_id: cj.equipe_id,
        line_id: cj.line_id,
        nick_snapshot: cj.nick,
        id_jogo_snapshot: cj.id_jogo,
        abates: Number(player.abates || 0),
        dano: Number(player.dano || 0),
        assistencias: Number(player.assistencias || 0),
        revives: Number(player.revives || 0),
        origem: body.origem || 'manual',
        criado_por: userId,
        updated_at: new Date().toISOString(),
      })
    }
  }

  const { error: teamError } = await supabaseAdmin.from('campeonato_resultados_equipes').upsert(teamRows, { onConflict: 'partida_id,campeonato_equipe_id' })
  if (teamError) throw teamError

  const presenceRows = teamRows.map(row => ({
    campeonato_id: row.campeonato_id,
    fase_id: row.fase_id,
    jogo_id: row.jogo_id,
    partida_id: row.partida_id,
    grupo_id: row.grupo_id,
    campeonato_equipe_id: row.campeonato_equipe_id,
    slot_numero: row.slot_numero,
    status: 'presente',
    origem: row.origem === 'matchresult' ? 'matchresult' : 'manual',
    matchresult_nome_raw: row.raw_team_name || null,
    importacao_equipe_id: body.equipes.find(item => item.campeonato_equipe_id === row.campeonato_equipe_id)?.importacao_equipe_id || null,
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
  const { error: presenceError } = await supabaseAdmin
    .from('campeonato_partidas_equipes_presenca')
    .upsert(presenceRows, { onConflict: 'partida_id,campeonato_equipe_id' })
  if (presenceError) throw presenceError
  if (playerRows.length) {
    const { error: playerError } = await supabaseAdmin.from('campeonato_resultados_jogadores').upsert(playerRows, { onConflict: 'partida_id,campeonato_jogador_id' })
    if (playerError) throw playerError
  }
  return { equipes: teamRows.length, jogadores: playerRows.length }
}
