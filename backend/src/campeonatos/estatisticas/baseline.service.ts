import { supabaseAdmin } from '../../shared/supabase-admin'
import { carregarRosterPontuadorJogo } from '../pontuador/pontuador.service'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from './estatisticas.service'
import { aggregateDetailedPlayerRows, officialTeamBaseline, resolveBaselineCut } from './baseline-rules'

const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function listarDetalhesMatchStats(campeonatoId: string, partidaIds: string[]) {
  if (!partidaIds.length) return []
  const { data: imports, error: importsError } = await supabaseAdmin
    .from('garena_matchstats_importacoes')
    .select('id,partida_id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'concluida')
    .eq('consolidacao_oficial', true)
    .in('partida_id', partidaIds)
  if (importsError) throw importsError
  const importIds = (imports || []).map((row: any) => row.id)
  if (!importIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('garena_matchstats_jogadores')
    .select('campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,player_id,nick_snapshot,abates,dano,assistencias,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,revives,membros_revividos,membros_resgatados,kits_medicos,gel_destruido')
    .in('importacao_id', importIds)
    .limit(100000)
  if (error) throw error
  const aggregated = aggregateDetailedPlayerRows(data || [])
  if (aggregated.invalidRows.length) {
    throw new Error('Existem estatísticas MatchStats sem campeonato_jogador_id; o baseline não pode consolidá-las com segurança.')
  }
  return aggregated.players
}

function teamIdentity(row: any) {
  return text(row.campeonato_equipe_id)
}

function playerIdentity(row: any) {
  return text(row.campeonato_jogador_id)
}

export async function carregarBaselineAntesPartida(campeonatoId: string, jogoId: string, partidaIdAtual: string) {
  const { data: partidas, error: partidasError } = await supabaseAdmin
    .from('campeonato_partidas_com_mapa')
    .select('id,campeonato_id,fase_id,jogo_id,grupo_id,numero_partida,mapa_codigo,mapa_nome,status')
    .eq('campeonato_id', campeonatoId)
    .eq('jogo_id', jogoId)
    .order('numero_partida', { ascending: true })
  if (partidasError) throw partidasError
  const cut = resolveBaselineCut(partidas || [], partidaIdAtual)
  const partidaIds = cut.anteriores.map((partida) => text(partida.id)).filter(Boolean)

  const [roster, teamStats, playerStats, details] = await Promise.all([
    carregarRosterPontuadorJogo(campeonatoId, jogoId),
    partidaIds.length ? listarEstatisticasEquipes(campeonatoId, { partidaIds }) : Promise.resolve([]),
    partidaIds.length ? listarEstatisticasMvp(campeonatoId, { partidaIds }) : Promise.resolve([]),
    listarDetalhesMatchStats(campeonatoId, partidaIds),
  ])
  const invalidRosterPlayers = (roster.jogadores || []).filter((row: any) => !playerIdentity(row) || !text(row.campeonato_equipe_id))
  if (invalidRosterPlayers.length) {
    throw new Error('O roster do pontuador contém jogador sem campeonato_jogador_id ou campeonato_equipe_id.')
  }
  const invalidRosterTeams = (roster.slots || []).filter((row: any) => !row.slot_vazio && !teamIdentity(row))
  if (invalidRosterTeams.length) {
    throw new Error('O roster do pontuador contém equipe sem campeonato_equipe_id.')
  }
  if (teamStats.some((row: any) => !text(row.campeonato_equipe_id))) {
    throw new Error('A classificação oficial contém equipe sem campeonato_equipe_id.')
  }
  if (playerStats.some((row: any) => !text(row.campeonato_jogador_id) || !text(row.campeonato_equipe_id))) {
    throw new Error('A classificação de jogadores contém identidade competitiva incompleta.')
  }

  const teamStatsById = new Map<string, any>()
  for (const row of teamStats) teamStatsById.set(text((row as any).campeonato_equipe_id), row)
  const rosterTeamsById = new Map<string, any>()
  for (const row of roster.slots || []) {
    const id = teamIdentity(row)
    if (id) rosterTeamsById.set(id, row)
  }
  for (const row of teamStats) if (!rosterTeamsById.has(text((row as any).campeonato_equipe_id))) rosterTeamsById.set(text((row as any).campeonato_equipe_id), row)

  const detailsById = new Map<string, any>()
  for (const row of details) detailsById.set(text((row as any).campeonato_jogador_id), row)
  const playerStatsById = new Map<string, any>()
  for (const row of playerStats) playerStatsById.set(text((row as any).campeonato_jogador_id), row)
  const rosterPlayersById = new Map<string, any>()
  for (const row of roster.jogadores || []) {
    const id = playerIdentity(row)
    if (id) rosterPlayersById.set(id, row)
  }
  for (const row of playerStats) if (!rosterPlayersById.has(text((row as any).campeonato_jogador_id))) rosterPlayersById.set(text((row as any).campeonato_jogador_id), row)

  const players = [...rosterPlayersById.entries()].map(([id, rosterPlayer]: [string, any]) => {
    const official: any = playerStatsById.get(id) || {}
    const advanced: any = detailsById.get(id) || {}
    const competitionTeamId = text(rosterPlayer.campeonato_equipe_id || official.campeonato_equipe_id || advanced.campeonato_equipe_id)
    const team: any = rosterTeamsById.get(competitionTeamId) || {}
    return {
      campeonato_jogador_id: id,
      campeonato_equipe_id: competitionTeamId || null,
      jogador_id: rosterPlayer.jogador_id || official.jogador_id || advanced.jogador_id || null,
      jogador_temporario_id: rosterPlayer.jogador_temporario_id || official.jogador_temporario_id || advanced.jogador_temporario_id || null,
      player_id: rosterPlayer.player_id || rosterPlayer.id_jogo || official.id_jogo || advanced.player_id || null,
      nick: rosterPlayer.nick || official.nick || advanced.nick_snapshot || 'Jogador',
      slot_jogador: number(rosterPlayer.slot_jogador) || null,
      equipe_nome: team.equipe_nome || team.nome_exibicao || team.nome || null,
      slot_id: team.slot_id || team.campeonato_slot_id || null,
      slot_numero: number(team.slot_numero) || null,
      foto_url: rosterPlayer.foto_url || official.foto_url || null,
      drops: number(official.quedas),
      kills: number(official.abates),
      damage: number(official.dano),
      assists: number(official.assistencias),
      headshots: number(advanced.headshots),
      knockdowns: number(advanced.knockdowns),
      survival_time: number(advanced.sobrevivencia_segundos),
      distance_traveled: number(advanced.distancia_movida),
      max_kill_distance: number(advanced.distancia_max_abate),
      revives: number(official.revives),
      revived_members: number(advanced.membros_revividos),
      rescued_members: number(advanced.membros_resgatados),
      medkits_used: number(advanced.kits_medicos),
      gloo_destroyed: number(advanced.gel_destruido),
    }
  })

  const playerTotalsByTeam = new Map<string, { damage: number; assists: number }>()
  for (const player of players) {
    const key = text(player.campeonato_equipe_id)
    if (!key) continue
    const current = playerTotalsByTeam.get(key) || { damage: 0, assists: 0 }
    current.damage += player.damage
    current.assists += player.assists
    playerTotalsByTeam.set(key, current)
  }

  const teams = [...rosterTeamsById.entries()].map(([id, rosterTeam]: [string, any]) => {
    const official: any = teamStatsById.get(id) || {}
    const officialTotals = officialTeamBaseline(official)
    const playerTotals = playerTotalsByTeam.get(id) || { damage: 0, assists: 0 }
    return {
      campeonato_equipe_id: id,
      slot_id: rosterTeam.slot_id || rosterTeam.campeonato_slot_id || null,
      slot_numero: number(rosterTeam.slot_numero) || null,
      equipe_id: rosterTeam.equipe_id || official.equipe_id || null,
      team_id_externo: rosterTeam.team_id || rosterTeam.external_id || null,
      nome: rosterTeam.equipe_nome || rosterTeam.nome_exibicao || official.nome || 'Equipe',
      tag: rosterTeam.equipe_tag || rosterTeam.tag || official.tag || null,
      logo_url: rosterTeam.equipe_logo_url || rosterTeam.logo_url || official.logo_url || null,
      grupo_id: rosterTeam.grupo_id || official.grupo_id || null,
      grupo_nome: rosterTeam.grupo_nome || null,
      ...officialTotals,
      damage: playerTotals.damage,
      assists: playerTotals.assists,
    }
  })

  return {
    version: 1,
    context: {
      campeonato_id: campeonatoId,
      fase_id: cut.atual.fase_id || null,
      jogo_id: jogoId,
      partida_id_atual: partidaIdAtual,
      numero_queda_atual: number(cut.atual.numero_partida),
      baseline_ate_queda: cut.baselineAteQueda,
      partidas_incluidas: partidaIds,
      quantidade_partidas_incluidas: partidaIds.length,
    },
    teams,
    players,
  }
}
