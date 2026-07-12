import { supabaseAdmin } from '../../shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '../estatisticas/estatisticas.service'

type FiltrosJogos = {
  faseId?: string | null
  rodadaId?: string | null
}

export async function listarJogosPontuador(campeonatoId: string, filtros: FiltrosJogos = {}) {
  let query = supabaseAdmin
    .from('campeonato_jogos')
    .select('id,campeonato_id,fase_id,rodada_id,nome,data_jogo,horario,numero_partidas,status,created_at')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'ativo')
    .order('data_jogo', { ascending: false })
    .order('horario', { ascending: true })
    .order('created_at', { ascending: false })

  if (filtros.faseId) query = query.eq('fase_id', filtros.faseId)
  if (filtros.rodadaId) query = query.eq('rodada_id', filtros.rodadaId)

  const { data: jogos, error } = await query
  if (error) throw error

  const jogoIds = (jogos || []).map((jogo: any) => jogo.id)
  if (!jogoIds.length) return []

  const [{ data: fases, error: fasesError }, { data: rodadas, error: rodadasError }, { data: grupos, error: gruposError }] = await Promise.all([
    supabaseAdmin.from('campeonato_fases').select('id,nome,ordem').eq('campeonato_id', campeonatoId),
    supabaseAdmin.from('campeonato_rodadas').select('id,nome,numero').eq('campeonato_id', campeonatoId),
    supabaseAdmin
      .from('campeonato_jogos_grupos')
      .select('jogo_id,grupo_id,campeonato_grupos(id,nome,slots)')
      .in('jogo_id', jogoIds),
  ])
  if (fasesError) throw fasesError
  if (rodadasError) throw rodadasError
  if (gruposError) throw gruposError

  const faseMap = new Map((fases || []).map((item: any) => [item.id, item]))
  const rodadaMap = new Map((rodadas || []).map((item: any) => [item.id, item]))
  const gruposMap = new Map<string, any[]>()
  for (const item of grupos || []) {
    const atual = gruposMap.get(item.jogo_id) || []
    atual.push(item.campeonato_grupos)
    gruposMap.set(item.jogo_id, atual)
  }

  return (jogos || []).map((jogo: any) => {
    const gruposJogo = gruposMap.get(jogo.id) || []
    return {
      ...jogo,
      fase: jogo.fase_id ? faseMap.get(jogo.fase_id) || null : null,
      rodada: jogo.rodada_id ? rodadaMap.get(jogo.rodada_id) || null : null,
      grupos: gruposJogo,
      total_slots: gruposJogo.reduce((total, grupo) => total + Number(grupo?.slots || 0), 0),
    }
  })
}

export async function carregarPontuadorJogo(campeonatoId: string, jogoId: string) {
  const { data: jogo, error: jogoError } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id,campeonato_id,fase_id,rodada_id,nome,data_jogo,horario,numero_partidas,status')
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (jogoError) throw jogoError
  if (!jogo) throw new Error('Jogo não encontrado.')

  const [
    { data: campeonato, error: campeonatoError },
    { data: fase, error: faseError },
    { data: rodada, error: rodadaError },
    { data: partidas, error: partidasError },
    { data: slots, error: slotsError },
    { data: matriz, error: matrizError },
    { data: jogadores, error: jogadoresError },
    { data: resultadosJogadores, error: resultadosJogadoresError },
    { data: classificacaoJogo, error: classificacaoError },
    { data: vinculos, error: vinculosError },
  ] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,logo_url,produtora_id').eq('id', campeonatoId).single(),
    jogo.fase_id
      ? supabaseAdmin.from('campeonato_fases').select('id,nome,ordem').eq('id', jogo.fase_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    jogo.rodada_id
      ? supabaseAdmin.from('campeonato_rodadas').select('id,nome,numero').eq('id', jogo.rodada_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    supabaseAdmin
      .from('campeonato_partidas_com_mapa')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .order('numero_partida', { ascending: true }),
    supabaseAdmin
      .from('campeonato_pontuador_slots_jogo')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .order('grupo_nome', { ascending: true })
      .order('slot_numero', { ascending: true }),
    supabaseAdmin
      .from('campeonato_pontuador_equipes_matriz')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .order('grupo_nome', { ascending: true })
      .order('slot_numero', { ascending: true })
      .order('numero_partida', { ascending: true }),
    supabaseAdmin
      .from('campeonato_pontuador_jogadores_jogo')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .order('campeonato_equipe_id', { ascending: true })
      .order('slot_jogador', { ascending: true }),
    supabaseAdmin
      .from('campeonato_resultados_jogadores')
      .select('partida_id,campeonato_equipe_id,campeonato_jogador_id,abates,dano,assistencias,revives,origem')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId),
    supabaseAdmin
      .from('campeonato_classificacao_equipes_pontuador')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId),
    supabaseAdmin
      .from('matchresult_vinculos_equipes')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('jogo_id', jogoId)
      .order('nome_raw', { ascending: true }),
  ])

  if (campeonatoError) throw campeonatoError
  if (faseError) throw faseError
  if (rodadaError) throw rodadaError
  if (partidasError) throw partidasError
  if (slotsError) throw slotsError
  if (matrizError) throw matrizError
  if (jogadoresError) throw jogadoresError
  if (resultadosJogadoresError) throw resultadosJogadoresError
  if (classificacaoError) throw classificacaoError
  if (vinculosError) throw vinculosError

  const [classificacaoGeral, mvpGeral, mvpJogo] = await Promise.all([
    listarEstatisticasEquipes(campeonatoId, { faseId: jogo.fase_id || null }),
    listarEstatisticasMvp(campeonatoId, { faseId: jogo.fase_id || null }),
    listarEstatisticasMvp(campeonatoId, { jogoId }),
  ])

  const classificacaoOrdenada = [...(classificacaoJogo || [])]
    .sort((a: any, b: any) => Number(b.pontos_total || 0) - Number(a.pontos_total || 0) || Number(b.booyahs || 0) - Number(a.booyahs || 0) || Number(b.abates || 0) - Number(a.abates || 0))
    .map((item: any, index) => ({ ...item, colocacao: index + 1 }))

  return {
    campeonato,
    fase,
    rodada,
    jogo,
    partidas: partidas || [],
    slots: slots || [],
    matriz: matriz || [],
    jogadores: jogadores || [],
    resultados_jogadores: resultadosJogadores || [],
    classificacao_geral: classificacaoGeral,
    classificacao_jogo: classificacaoOrdenada,
    mvp_geral: mvpGeral,
    mvp_jogo: mvpJogo,
    vinculos_matchresult: vinculos || [],
  }
}

export async function registrarVinculosMatchResult(
  campeonatoId: string,
  jogoId: string,
  userId: string,
  body: { vinculos?: Array<{ nome_raw: string; campeonato_equipe_id: string }> },
) {
  const vinculos = body?.vinculos
  if (!Array.isArray(vinculos) || !vinculos.length) {
    throw new Error('Informe pelo menos um vínculo de equipe.')
  }

  const { data: jogo, error: jogoError } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id')
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (jogoError) throw jogoError
  if (!jogo) throw new Error('Jogo não encontrado.')

  const ids: string[] = []
  for (const vinculo of vinculos) {
    if (!vinculo?.nome_raw?.trim() || !vinculo?.campeonato_equipe_id) {
      throw new Error('Nome do MatchResult e equipe de destino são obrigatórios.')
    }
    const { data, error } = await supabaseAdmin.rpc('fn_registrar_vinculo_matchresult_equipe', {
      p_jogo_id: jogoId,
      p_nome_raw: vinculo.nome_raw,
      p_campeonato_equipe_id: vinculo.campeonato_equipe_id,
      p_criado_por: userId,
    })
    if (error) throw error
    ids.push(data as string)
  }

  const { data: atualizados, error: atualizadosError } = await supabaseAdmin
    .from('matchresult_vinculos_equipes')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .eq('jogo_id', jogoId)
    .order('nome_raw', { ascending: true })
  if (atualizadosError) throw atualizadosError

  return { ids, vinculos: atualizados || [] }
}

export async function marcarFaltaPontuador(
  campeonatoId: string,
  jogoId: string,
  quedaId: string,
  userId: string,
  body: { campeonato_equipe_id?: string; observacoes?: string | null },
) {
  if (!body?.campeonato_equipe_id) throw new Error('Informe a equipe que faltou.')

  const { data: partida, error: partidaError } = await supabaseAdmin
    .from('campeonato_partidas')
    .select('id,status')
    .eq('id', quedaId)
    .eq('campeonato_id', campeonatoId)
    .eq('jogo_id', jogoId)
    .maybeSingle()
  if (partidaError) throw partidaError
  if (!partida) throw new Error('Queda não encontrada neste jogo.')
  if (partida.status === 'finalizada') throw new Error('A queda já foi finalizada.')

  const { data, error } = await supabaseAdmin.rpc('fn_marcar_falta_equipe_queda', {
    p_partida_id: quedaId,
    p_campeonato_equipe_id: body.campeonato_equipe_id,
    p_confirmado_por: userId,
    p_observacoes: body.observacoes || null,
  })
  if (error) throw error

  return { presenca_id: data }
}
