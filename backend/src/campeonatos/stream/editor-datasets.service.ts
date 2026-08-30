import { listarEstatisticasEquipes, listarEstatisticasMvp } from '../estatisticas/estatisticas.service'
import { resolveStreamContext } from './stream-context'
import { supabaseAdmin } from '../../shared/supabase-admin'

type ScopeFilters = {
  jogoId?: string
  partidaId?: string
}

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown) {
  return value == null ? '' : String(value)
}

function playerTotalsByTeam(players: any[]) {
  const totals = new Map<string, Record<string, number>>()
  for (const player of players) {
    const teamId = text(player.campeonato_equipe_id)
    if (!teamId) continue
    const current = totals.get(teamId) || {}
    for (const field of ADVANCED_SUM_FIELDS) current[field] = number(current[field]) + number(player[field])
    totals.set(teamId, current)
  }
  return totals
}

function teamRows(teams: any[], players: any[]) {
  const playerTotals = playerTotalsByTeam(players)
  return teams.map((team, index) => {
    const teamId = text(team.campeonato_equipe_id)
    const totals = playerTotals.get(teamId) || {}
    const drops = number(team.quedas)
    const kills = number(team.abates)
    const points = number(team.pontos_total)
    return {
      posicao: number(team.colocacao) || index + 1,
      equipe_id: teamId,
      line_id: text(team.line_id),
      line_public_id: team.line_public_id ?? '',
      equipe: text(team.nome || team.line_nome || 'Equipe'),
      tag: text(team.tag),
      logo: text(team.logo_url),
      grupo_id: text(team.grupo_id),
      quedas: drops,
      booyahs: number(team.booyahs),
      abates: kills,
      dano: number(totals.dano),
      assistencias: number(totals.assistencias),
      revives: number(totals.revives),
      headshots: number(totals.headshots),
      knockdowns: number(totals.knockdowns),
      sobrevivencia_segundos: number(totals.sobrevivencia_segundos),
      distancia_movida: number(totals.distancia_movida),
      distancia_max_abate: number(totals.distancia_max_abate),
      membros_revividos: number(totals.membros_revividos),
      membros_resgatados: number(totals.membros_resgatados),
      granadas_usadas: number(totals.granadas_usadas),
      abates_granada: number(totals.abates_granada),
      dano_granada: number(totals.dano_granada),
      gel_usado: number(totals.gel_usado),
      gel_destruido: number(totals.gel_destruido),
      kits_medicos: number(totals.kits_medicos),
      abates_veiculo: number(totals.abates_veiculo),
      abates_oleo: number(totals.abates_oleo),
      pontos_posicao: number(team.pontos_posicao),
      pontos_abates: number(team.pontos_abates),
      pontos: points,
      melhor_posicao: team.melhor_posicao ?? '',
      media_abates: drops ? Number((kills / drops).toFixed(2)) : 0,
      media_dano: drops ? Number((totals.dano / drops).toFixed(2)) : 0,
      media_pontos: drops ? Number((points / drops).toFixed(2)) : 0,
    }
  })
}

function playerRows(players: any[], teams: any[]) {
  const teamsById = new Map(teams.map((team: any) => [text(team.campeonato_equipe_id), team]))
  return players.map((player, index) => {
    const team = teamsById.get(text(player.campeonato_equipe_id)) as any
    const drops = number(player.quedas)
    const kills = number(player.abates)
    const damage = number(player.dano)
    return {
      posicao: number(player.colocacao) || index + 1,
      jogador_id: text(player.campeonato_jogador_id),
      perfil_id: text(player.jogador_id),
      line_public_id: player.line_public_id ?? '',
      nick: text(player.nick || 'Jogador'),
      id_jogo: text(player.id_jogo),
      foto: text(player.foto_url),
      tipo_jogador: text(player.tipo_jogador),
      equipe_id: text(player.campeonato_equipe_id),
      equipe: text(team?.nome || team?.line_nome || ''),
      tag: text(team?.tag),
      logo: text(team?.logo_url),
      grupo_id: text(team?.grupo_id),
      quedas: drops,
      abates: kills,
      dano: damage,
      assistencias: number(player.assistencias),
      revives: number(player.revives),
      kd: drops ? Number((kills / drops).toFixed(2)) : kills,
      media_dano: drops ? Number((damage / drops).toFixed(2)) : damage,
      media_assistencias: drops ? Number((number(player.assistencias) / drops).toFixed(2)) : number(player.assistencias),
      headshots: number(player.headshots),
      knockdowns: number(player.knockdowns),
      sobrevivencia_segundos: number(player.sobrevivencia_segundos),
      distancia_movida: number(player.distancia_movida),
      distancia_max_abate: number(player.distancia_max_abate),
      precisao_percentual: number(player.precisao_percentual),
      taxa_headshot_kill_percentual: number(player.taxa_headshot_kill_percentual),
      precisao_headshot_percentual: number(player.precisao_headshot_percentual),
      membros_revividos: number(player.membros_revividos),
      membros_resgatados: number(player.membros_resgatados),
      granadas_usadas: number(player.granadas_usadas),
      abates_granada: number(player.abates_granada),
      dano_granada: number(player.dano_granada),
      gel_usado: number(player.gel_usado),
      gel_destruido: number(player.gel_destruido),
      kits_medicos: number(player.kits_medicos),
      abates_veiculo: number(player.abates_veiculo),
      abates_oleo: number(player.abates_oleo),
      mudanca_posicao: number(player.mudanca_posicao),
      arma_principal: text(player.arma_principal),
      habilidade_ativa: text(player.habilidade_ativa),
      pet: text(player.pet),
    }
  })
}

const ADVANCED_SUM_FIELDS = [
  'dano', 'assistencias', 'revives', 'headshots', 'knockdowns', 'sobrevivencia_segundos',
  'distancia_movida', 'distancia_max_abate', 'membros_revividos', 'membros_resgatados',
  'granadas_usadas', 'abates_granada', 'dano_granada', 'gel_usado', 'gel_destruido',
  'kits_medicos', 'abates_veiculo', 'abates_oleo', 'mudanca_posicao',
]
const ADVANCED_AVERAGE_FIELDS = ['precisao_percentual', 'taxa_headshot_kill_percentual', 'precisao_headshot_percentual']

async function loadAdvancedPlayerStats(campeonatoId: string, filters: ScopeFilters) {
  let importsQuery = supabaseAdmin
    .from('garena_matchstats_importacoes')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'concluida')
  if (filters.jogoId) importsQuery = importsQuery.eq('jogo_id', filters.jogoId)
  if (filters.partidaId) importsQuery = importsQuery.eq('partida_id', filters.partidaId)
  const { data: imports, error: importsError } = await importsQuery
  if (importsError) throw importsError
  const importIds = (imports || []).map((row: any) => row.id)
  if (!importIds.length) return new Map<string, any>()

  const { data, error } = await supabaseAdmin
    .from('garena_matchstats_jogadores')
    .select('campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,player_id,nick_snapshot,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,precisao_percentual,taxa_headshot_kill_percentual,precisao_headshot_percentual,membros_revividos,membros_resgatados,granadas_usadas,abates_granada,dano_granada,gel_usado,gel_destruido,kits_medicos,abates_veiculo,abates_oleo,mudanca_posicao,garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,habilidade,usos,pick_times)')
    .in('importacao_id', importIds)
    .limit(100000)
  if (error) throw error

  const aggregate = new Map<string, any>()
  for (const rawRow of data || []) {
    const row: any = rawRow
    const key = text(row.campeonato_jogador_id || row.jogador_id || row.jogador_temporario_id || row.player_id)
    if (!key) continue
    const current = aggregate.get(key) || {
      campeonato_jogador_id:row.campeonato_jogador_id,
      jogador_id:row.jogador_id,
      jogador_temporario_id:row.jogador_temporario_id,
      campeonato_equipe_id:row.campeonato_equipe_id,
      player_id:row.player_id,
      nick_snapshot:row.nick_snapshot,
      partidas_detalhadas:0,
      armas:new Map<string, any>(),
      habilidades:new Map<string, any>(),
    }
    current.partidas_detalhadas += 1
    for (const field of ADVANCED_SUM_FIELDS) current[field] = number(current[field]) + number(row[field])
    for (const field of ADVANCED_AVERAGE_FIELDS) current[`${field}_soma`] = number(current[`${field}_soma`]) + number(row[field])
    for (const weapon of row.garena_matchstats_armas || []) {
      const name = text(weapon.arma)
      if (!name) continue
      const item = current.armas.get(name) || { name, abates: 0, dano: 0 }
      item.abates += number(weapon.abates); item.dano += number(weapon.dano); current.armas.set(name, item)
    }
    for (const skill of row.garena_matchstats_habilidades || []) {
      const id = `${text(skill.tipo)}:${text(skill.habilidade)}`
      if (id === ':') continue
      const item = current.habilidades.get(id) || { tipo:text(skill.tipo), name:text(skill.habilidade), usos:0, picks:0 }
      item.usos += number(skill.usos); item.picks += number(skill.pick_times); current.habilidades.set(id, item)
    }
    aggregate.set(key, current)
  }
  for (const current of aggregate.values()) {
    for (const field of ADVANCED_AVERAGE_FIELDS) current[field] = current.partidas_detalhadas ? Number((number(current[`${field}_soma`]) / current.partidas_detalhadas).toFixed(3)) : 0
    current.arma_principal = [...current.armas.values()].sort((a: any, b: any) => b.abates - a.abates || b.dano - a.dano)[0]?.name || ''
    const skills = [...current.habilidades.values()]
    current.habilidade_ativa = skills.filter((item: any) => item.tipo === 'ativa').sort((a: any, b: any) => b.usos - a.usos || b.picks - a.picks)[0]?.name || ''
    current.pet = skills.filter((item: any) => item.tipo === 'pet').sort((a: any, b: any) => b.usos - a.usos || b.picks - a.picks)[0]?.name || ''
  }
  return aggregate
}

async function scopedDatasets(campeonatoId: string, filters: ScopeFilters) {
  const [teams, players, advanced] = await Promise.all([
    listarEstatisticasEquipes(campeonatoId, filters),
    listarEstatisticasMvp(campeonatoId, filters),
    loadAdvancedPlayerStats(campeonatoId, filters),
  ])
  const completePlayers = players.map((player: any) => ({
    ...player,
    ...(advanced.get(text(player.campeonato_jogador_id || player.jogador_id || player.jogador_temporario_id || player.id_jogo)) || {}),
  }))
  return {
    teams: teamRows(teams, completePlayers),
    players: playerRows(completePlayers, teams),
  }
}

const TEAM_COLUMNS = [
  'posicao', 'equipe_id', 'line_id', 'line_public_id', 'equipe', 'tag', 'logo', 'grupo_id',
  'quedas', 'booyahs', 'abates', 'dano', 'assistencias', 'revives', 'headshots', 'knockdowns',
  'sobrevivencia_segundos', 'distancia_movida', 'distancia_max_abate', 'membros_revividos',
  'membros_resgatados', 'granadas_usadas', 'abates_granada', 'dano_granada', 'gel_usado',
  'gel_destruido', 'kits_medicos', 'abates_veiculo', 'abates_oleo', 'pontos_posicao',
  'pontos_abates', 'pontos', 'melhor_posicao', 'media_abates', 'media_dano', 'media_pontos',
]
const PLAYER_COLUMNS = [
  'posicao', 'jogador_id', 'perfil_id', 'line_public_id', 'nick', 'id_jogo', 'foto',
  'tipo_jogador', 'equipe_id', 'equipe', 'tag', 'logo', 'grupo_id', 'quedas', 'abates',
  'dano', 'assistencias', 'revives', 'kd', 'media_dano', 'media_assistencias', 'headshots',
  'knockdowns', 'sobrevivencia_segundos', 'distancia_movida', 'distancia_max_abate',
  'precisao_percentual', 'taxa_headshot_kill_percentual', 'precisao_headshot_percentual',
  'membros_revividos', 'membros_resgatados', 'granadas_usadas', 'abates_granada',
  'dano_granada', 'gel_usado', 'gel_destruido', 'kits_medicos', 'abates_veiculo',
  'abates_oleo', 'mudanca_posicao', 'arma_principal', 'habilidade_ativa', 'pet',
]

function dataset(id: string, name: string, scope: string, entity: 'equipes' | 'jogadores', rows: Record<string, unknown>[]) {
  return {
    id,
    name,
    scope,
    entity,
    columns: entity === 'equipes' ? TEAM_COLUMNS : PLAYER_COLUMNS,
    rows,
  }
}

export async function loadEditorDatasets(campeonatoId: string) {
  const context = await resolveStreamContext(campeonatoId)
  const empty = { teams: [] as Record<string, unknown>[], players: [] as Record<string, unknown>[] }
  const [overall, game, drop] = await Promise.all([
    scopedDatasets(campeonatoId, {}),
    context.activeJogoId ? scopedDatasets(campeonatoId, { jogoId: context.activeJogoId }) : Promise.resolve(empty),
    context.activePartidaId ? scopedDatasets(campeonatoId, { partidaId: context.activePartidaId }) : Promise.resolve(empty),
  ])

  return {
    version: 1,
    provider: 'dropzone',
    syncedAt: new Date().toISOString(),
    context: {
      active_jogo_id: context.activeJogoId,
      active_partida_id: context.activePartidaId,
      active_jogo: context.activeJogo,
      source: context.source,
    },
    datasets: [
      dataset('equipes-geral', 'Equipes - Geral', 'geral', 'equipes', overall.teams),
      dataset('equipes-jogo', 'Equipes - Jogo no ar', 'jogo', 'equipes', game.teams),
      dataset('equipes-queda', 'Equipes - Queda no ar', 'queda', 'equipes', drop.teams),
      dataset('jogadores-geral', 'Jogadores (MVP) - Geral', 'geral', 'jogadores', overall.players),
      dataset('jogadores-jogo', 'Jogadores (MVP) - Jogo no ar', 'jogo', 'jogadores', game.players),
      dataset('jogadores-queda', 'Jogadores (MVP) - Queda no ar', 'queda', 'jogadores', drop.players),
    ],
  }
}
