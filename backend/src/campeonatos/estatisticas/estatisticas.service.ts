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
      grupo_id: row.grupo_id || null,
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
    .sort((a, b) => b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates || Number(a.melhor_posicao ?? 999) - Number(b.melhor_posicao ?? 999))
    .map((row, index) => ({ ...row, colocacao: index + 1 }))
}


async function listarMvpGarenaFallback(campeonatoId: string, filters: Filters) {
  let importsQuery: any = supabaseAdmin
    .from('garena_matchstats_importacoes')
    .select('id,jogo_id,partida_id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'concluida')
  if (filters.jogoId) importsQuery = importsQuery.eq('jogo_id', filters.jogoId)
  if (filters.partidaId) importsQuery = importsQuery.eq('partida_id', filters.partidaId)

  const { data: imports, error: importsError } = await importsQuery
  if (importsError) throw importsError
  const importIds = (imports || []).map((row: any) => row.id)
  if (!importIds.length) return []

  const { data: rows, error } = await supabaseAdmin
    .from('garena_matchstats_jogadores')
    .select('campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,nick_snapshot,player_id,abates,dano,assistencias,revives')
    .in('importacao_id', importIds)
    .not('campeonato_jogador_id', 'is', null)
  if (error) throw error

  const aggregate = new Map<string, any>()
  for (const row of rows || []) {
    const key = String(row.campeonato_jogador_id || '')
    if (!key) continue
    const current = aggregate.get(key) || {
      campeonato_jogador_id: key,
      jogador_id: row.jogador_id,
      jogador_temporario_id: row.jogador_temporario_id,
      campeonato_equipe_id: row.campeonato_equipe_id,
      nick: row.nick_snapshot || 'Jogador',
      id_jogo: row.player_id || null,
      foto_url: null,
      tipo_jogador: row.jogador_id ? 'oficial' : 'temporario',
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
  if (!(data || []).length && !filters.faseId && !filters.rodadaId && !filters.mapaCodigo && !filters.grupoId) {
    return listarMvpGarenaFallback(campeonatoId, filters)
  }

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


export async function carregarResumoCampeao(campeonatoId: string) {
  const { data: faseFinal, error: faseError } = await supabaseAdmin
    .from('campeonato_fases')
    .select('id,nome,tipo')
    .eq('campeonato_id', campeonatoId)
    .eq('tipo', 'grande_final')
    .maybeSingle()
  if (faseError) throw faseError
  if (!faseFinal) {
    return { final_concluida: false, fase: null, configuracao: null, campeao: null, jogadores: [], mvp_final: null, resumo: null }
  }

  const [{ data: jogos, error: jogosError }, { data: partidas, error: partidasError }, { data: configuracao, error: configError }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_jogos')
      .select('id,nome,dia_final,define_campeao,papel_na_fase,data_jogo,horario,numero_partidas,status')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id)
      .order('dia_final', { ascending: true })
      .order('data_jogo', { ascending: true }),
    supabaseAdmin
      .from('campeonato_partidas')
      .select('id,jogo_id,numero_partida,status')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id),
    supabaseAdmin
      .from('campeonato_fases_configuracoes')
      .select('modo_decisao,modo_acumulacao,booyah_ouro_pontos_limite,jogo_decisivo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id)
      .maybeSingle(),
  ])
  if (jogosError) throw jogosError
  if (partidasError) throw partidasError
  if (configError) throw configError

  const finalConcluida = Boolean(partidas?.length) && (partidas || []).every((row: any) => String(row.status || '') === 'finalizada')
  const modoAcumulacao = String(configuracao?.modo_acumulacao || 'acumulado')
  const jogoDecisivoId = String(configuracao?.jogo_decisivo_id || '')
  const pointRush = modoAcumulacao === 'bonus_por_ranking' && Boolean(jogoDecisivoId)

  const [{ data: bonusEquipes, error: bonusError }, rankingBase, mvp] = await Promise.all([
    pointRush
      ? supabaseAdmin
          .from('campeonato_fases_bonus_equipes')
          .select('campeonato_equipe_id,posicao_origem,pontos_bonus')
          .eq('campeonato_id', campeonatoId)
          .eq('fase_id', faseFinal.id)
      : Promise.resolve({ data: [], error: null }),
    listarEstatisticasEquipes(campeonatoId, pointRush ? { jogoId: jogoDecisivoId } : { faseId: faseFinal.id }),
    listarEstatisticasMvp(campeonatoId, pointRush ? { jogoId: jogoDecisivoId } : { faseId: faseFinal.id }),
  ])
  if (bonusError) throw bonusError

  const bonusPorEquipe = new Map<string, number>()
  for (const item of bonusEquipes || []) {
    bonusPorEquipe.set(String(item.campeonato_equipe_id || ''), Number(item.pontos_bonus || 0))
  }

  const ranking = rankingBase
    .map((row: any) => {
      const pontosBonus = Number(bonusPorEquipe.get(String(row.campeonato_equipe_id || '')) || 0)
      return { ...row, pontos_bonus_final: pontosBonus, pontos_total: Number(row.pontos_total || 0) + pontosBonus }
    })
    .sort((a: any, b: any) => b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates || Number(a.melhor_posicao ?? 999) - Number(b.melhor_posicao ?? 999))
    .map((row: any, index: number) => ({ ...row, colocacao: index + 1 }))

  const modoDecisao = String(configuracao?.modo_decisao || 'pontuacao_normal')
  let campeao: any = finalConcluida ? ranking[0] || null : null
  let championPoint: { atingido: boolean; partida_id?: string; queda_global?: number } | null = null

  if (finalConcluida && modoDecisao === 'booyah_ouro') {
    const limite = Number(configuracao?.booyah_ouro_pontos_limite || 0)
    if (limite > 0) {
      const jogosValidos = pointRush ? (jogos || []).filter((game: any) => String(game.id) === jogoDecisivoId) : (jogos || [])
      const idsJogosValidos = new Set(jogosValidos.map((game: any) => String(game.id)))
      const gameOrder = new Map<string, number>()
      jogosValidos.forEach((game: any, index: number) => gameOrder.set(String(game.id), index))
      const orderedPartidas = (partidas || [])
        .filter((partida: any) => idsJogosValidos.has(String(partida.jogo_id)))
        .sort((a: any, b: any) => {
          const gameDiff = (gameOrder.get(String(a.jogo_id)) ?? 9999) - (gameOrder.get(String(b.jogo_id)) ?? 9999)
          return gameDiff || Number(a.numero_partida || 0) - Number(b.numero_partida || 0)
        })
      const { data: detalhes, error: detalhesError } = await supabaseAdmin
        .from('campeonato_estatisticas_equipes_detalhe')
        .select('campeonato_equipe_id,partida_id,jogo_id,pontos_total,booyah')
        .eq('campeonato_id', campeonatoId)
        .eq('fase_id', faseFinal.id)
      if (detalhesError) throw detalhesError
      const porPartida = new Map<string, any[]>()
      for (const row of detalhes || []) {
        if (!idsJogosValidos.has(String(row.jogo_id || ''))) continue
        const key = String(row.partida_id || '')
        porPartida.set(key, [...(porPartida.get(key) || []), row])
      }

      const acumulado = new Map<string, number>(pointRush ? bonusPorEquipe : [])
      let vencedorId = ''
      let winnerPartidaId = ''
      let winnerFall = 0
      for (let index = 0; index < orderedPartidas.length && !vencedorId; index += 1) {
        const partida = orderedPartidas[index]
        const rows = porPartida.get(String(partida.id)) || []
        const winner = rows.find((row: any) => Boolean(row.booyah) && Number(acumulado.get(String(row.campeonato_equipe_id)) || 0) >= limite)
        if (winner) {
          vencedorId = String(winner.campeonato_equipe_id || '')
          winnerPartidaId = String(partida.id)
          winnerFall = index + 1
        }
        for (const row of rows) {
          const teamId = String(row.campeonato_equipe_id || '')
          acumulado.set(teamId, Number(acumulado.get(teamId) || 0) + Number(row.pontos_total || 0))
        }
      }
      if (vencedorId) {
        campeao = ranking.find((row: any) => String(row.campeonato_equipe_id) === vencedorId) || null
        championPoint = { atingido: true, partida_id: winnerPartidaId, queda_global: winnerFall }
      } else {
        championPoint = { atingido: false }
        campeao = ranking[0] || null
      }
    }
  }

  const jogadores = campeao
    ? mvp.filter((row: any) => String(row.campeonato_equipe_id || '') === String(campeao.campeonato_equipe_id || ''))
    : []
  const dias = Array.from(new Set<number>((jogos || []).map((row: any) => Number(row.dia_final || 1)).filter((value: number) => value > 0))).sort((a, b) => a - b)

  return {
    final_concluida: finalConcluida,
    fase: faseFinal,
    configuracao: configuracao || null,
    campeao,
    jogadores,
    mvp_final: finalConcluida ? mvp[0] || null : null,
    champion_point: championPoint,
    aguardando_desempate: false,
    resumo: {
      dias: dias.length || ((jogos || []).length ? 1 : 0),
      jogos: (jogos || []).length,
      quedas: (partidas || []).length,
      quedas_finalizadas: (partidas || []).filter((row: any) => String(row.status || '') === 'finalizada').length,
      modo_final: pointRush ? 'point_rush' : 'acumulado',
      jogo_decisivo: pointRush ? (jogos || []).find((row: any) => String(row.id) === jogoDecisivoId) || null : null,
    },
  }
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
