import { supabaseAdmin } from '../../shared/supabase-admin'
import { readPagedRows } from '../../shared/paginated-query'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from './statistics-read.service'
import { readStatsRows } from './statistics-query'
export { listarEstatisticasEquipes, listarEstatisticasMvp } from './statistics-read.service'
export { listarEstatisticasEquipesPublicadas, listarEstatisticasMvpPublicadas, listarEstatisticasPublicadas } from './published-statistics.service'

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

  const [jogos, partidas, { data: configuracao, error: configError }] = await Promise.all([
    readPagedRows<any>(supabaseAdmin
      .from('campeonato_jogos')
      .select('id,nome,dia_final,define_campeao,papel_na_fase,data_jogo,horario,numero_partidas,status')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id)
      .order('dia_final', { ascending: true })
      .order('data_jogo', { ascending: true })
      .order('id', { ascending: true })),
    readPagedRows<any>(supabaseAdmin
      .from('campeonato_partidas')
      .select('id,jogo_id,numero_partida,status')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id)
      .order('id', { ascending: true })),
    supabaseAdmin
      .from('campeonato_fases_configuracoes')
      .select('modo_decisao,modo_acumulacao,booyah_ouro_pontos_limite,jogo_decisivo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseFinal.id)
      .maybeSingle(),
  ])
  if (configError) throw configError

  const finalConcluida = Boolean(partidas?.length) && (partidas || []).every((row: any) => String(row.status || '') === 'finalizada')
  const modoAcumulacao = String(configuracao?.modo_acumulacao || 'acumulado')
  const jogoDecisivoId = String(configuracao?.jogo_decisivo_id || '')
  const pointRush = modoAcumulacao === 'bonus_por_ranking' && Boolean(jogoDecisivoId)

  const [bonusEquipes, rankingBase, mvp] = await Promise.all([
    pointRush
      ? readPagedRows<any>(supabaseAdmin
          .from('campeonato_fases_bonus_equipes')
          .select('campeonato_equipe_id,posicao_origem,pontos_bonus')
          .eq('campeonato_id', campeonatoId)
          .eq('fase_id', faseFinal.id)
          .order('campeonato_equipe_id', { ascending: true }))
      : Promise.resolve([]),
    listarEstatisticasEquipes(campeonatoId, pointRush ? { jogoId: jogoDecisivoId } : { faseId: faseFinal.id }),
    listarEstatisticasMvp(campeonatoId, pointRush ? { jogoId: jogoDecisivoId } : { faseId: faseFinal.id }),
  ])

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
      const detalhes = await readStatsRows(() => supabaseAdmin
        .from('campeonato_estatisticas_equipes_detalhe')
        .select('campeonato_equipe_id,partida_id,jogo_id,pontos_total,booyah')
        .eq('campeonato_id', campeonatoId), { faseId: faseFinal.id })
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

export async function carregarResumoCampeaoPublicado(campeonatoId: string) {
  const { carregarPublicacaoEstatisticas } = await import('./publicacao.service')
  const publicacao = await carregarPublicacaoEstatisticas(campeonatoId)
  const resumo = await carregarResumoCampeao(campeonatoId)
  if (!resumo.final_concluida || !resumo.fase?.id) return { ...resumo, publicacao }

  const partidas = await readPagedRows<any>(supabaseAdmin
    .from('campeonato_partidas')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('fase_id', resumo.fase.id)
    .order('id', { ascending: true }))
  const publishedIds = new Set(publicacao.partidas_publicadas)
  const todasPublicadas = Boolean(partidas?.length)
    && (partidas || []).every((partida: any) => publishedIds.has(String(partida.id)))
  if (todasPublicadas) return { ...resumo, publicacao }
  return {
    ...resumo,
    final_concluida: false,
    campeao: null,
    jogadores: [],
    mvp_final: null,
    champion_point: null,
    publicacao,
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
    .order('id', { ascending: true })
  if (partidaId) partidasQuery = partidasQuery.eq('id', partidaId)

  const [partidas, equipes, jogadores] = await Promise.all([
    readPagedRows<any>(partidasQuery),
    readPagedRows<any>(supabaseAdmin.from('campeonato_equipes').select('*, equipes(id,nome,tag,logo_url), equipe_lines(id,nome,tag,logo_url)').eq('campeonato_id', campeonatoId).eq('status', 'ativo').order('id')),
    readPagedRows<any>(supabaseAdmin.from('campeonato_jogadores').select('*, jogadores(id,nome,avatar_url,id_jogo), jogadores_temporarios(id,nick,foto_url,id_jogo,status)').eq('campeonato_id', campeonatoId).eq('status', 'ativo').order('id')),
  ])

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

  const teamIds = [...new Set(body.equipes.map((item) => item.campeonato_equipe_id).filter(Boolean))]
  const playerIds = [...new Set(body.equipes.flatMap((item) => (item.jogadores || []).map((player) => player.campeonato_jogador_id)).filter(Boolean))]
  const [{ data: registeredTeams, error: teamsError }, { data: registeredPlayers, error: playersError }] = await Promise.all([
    supabaseAdmin.from('campeonato_equipes').select('id,equipe_id,line_id,grupo_id,slot_numero').eq('campeonato_id', campeonatoId).in('id', teamIds),
    playerIds.length
      ? supabaseAdmin.from('campeonato_jogadores').select('id,jogador_id,equipe_id,line_id,nick,id_jogo,campeonato_equipe_id').eq('campeonato_id', campeonatoId).in('id', playerIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])
  if (teamsError) throw teamsError
  if (playersError) throw playersError
  const teamsById = new Map((registeredTeams || []).map((row: any) => [String(row.id), row]))
  const playersById = new Map((registeredPlayers || []).map((row: any) => [String(row.id), row]))

  const teamRows: any[] = []
  const playerRows: any[] = []
  for (const item of body.equipes) {
    if (!Number.isInteger(item.posicao) || item.posicao < 1 || !Number.isInteger(item.abates) || item.abates < 0) {
      throw new Error('Posição e abates da equipe são inválidos.')
    }
    const ce: any = teamsById.get(String(item.campeonato_equipe_id))
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
      const cj: any = playersById.get(String(player.campeonato_jogador_id))
      if (!cj || String(cj.campeonato_equipe_id) !== String(ce.id)) throw new Error('Jogador não pertence à equipe informada.')
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
