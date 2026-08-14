import { supabaseAdmin } from '../shared/supabase-admin'

type ScoreNode = {
  key: string
  base: number
  score: number
  equipeScores: number[]
  campeonatoScores: number[]
  jogadorScores: number[]
}

type TeamNode = ScoreNode & {
  equipe_id: string | null
  line_id: string | null
  nome: string
  tag: string | null
  logo_url: string | null
  campeonatos: Set<string>
  jogadores: Set<string>
  quedas: Set<string>
  pontos: number
  abates: number
  booyahs: number
  dano: number
  assistencias: number
  revives: number
  headshots: number
  knockdowns: number
  sobrevivencia_segundos: number
  distancia_movida: number
  distancia_max_abate: number
  granadas_usadas: number
  gel_usado: number
  kits_medicos: number
}

type AbilityUsage = {
  tipo: string
  personagem: string | null
  habilidade: string
  usos: number
  pick_times: number
  pick_rate: number
}

type PlayerNode = ScoreNode & {
  jogador_id: string | null
  id_jogo: string | null
  nick: string
  foto_url: string | null
  equipes: Set<string>
  campeonatos: Set<string>
  quedas: Set<string>
  abates: number
  dano: number
  assistencias: number
  revives: number
  armas: Map<string, { nome: string; abates: number; dano: number }>
  habilidades: Map<string, AbilityUsage>
  funcao: string | null
  headshots: number
  knockdowns: number
  sobrevivencia_segundos: number
  distancia_movida: number
  distancia_max_abate: number
  granadas_usadas: number
  gel_usado: number
  kits_medicos: number
}

type ChampionshipNode = ScoreNode & {
  nome: string
  logo_url: string | null
  tipo: string | null
  premiacao: number
  participantes: Set<string>
  jogadores: Set<string>
  quedas: Set<string>
  tem_live: boolean
  tem_trofeu: boolean
  vagas: number
}

const ITERACOES = 8

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown) {
  return String(value || '').trim()
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function average(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function weighted(base: number, values: Array<{ value: number | null; weight: number }>) {
  const valid = [{ value: base, weight: values[0]?.weight || 1 }, ...values.slice(1)].filter((item): item is { value: number; weight: number } => item.value !== null)
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0)
  return totalWeight ? clamp(valid.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight) : base
}

function percentile(values: Array<{ key: string; value: number }>) {
  const result = new Map<string, number>()
  const sorted = [...values].sort((a, b) => a.value - b.value || a.key.localeCompare(b.key))
  if (sorted.length === 1) {
    result.set(sorted[0].key, .5)
    return result
  }
  let index = 0
  while (index < sorted.length) {
    let end = index
    while (end + 1 < sorted.length && sorted[end + 1].value === sorted[index].value) end += 1
    const rank = ((index + end) / 2) / (sorted.length - 1)
    for (let position = index; position <= end; position += 1) result.set(sorted[position].key, rank)
    index = end + 1
  }
  return result
}

function tier(score: number) {
  if (score >= 82) return 'SS'
  if (score >= 72) return 'S'
  if (score >= 62) return 'A'
  if (score >= 50) return 'B'
  if (score >= 38) return 'C'
  if (score >= 25) return 'D'
  return 'E'
}

function node(key: string): ScoreNode {
  return { key, base: 0, score: 0, equipeScores: [], campeonatoScores: [], jogadorScores: [] }
}

function playerKey(row: any) {
  return text(row.jogador_id) || text(row.id_jogo) || text(row.campeonato_jogador_id) || text(row.jogador_temporario_id)
}

function teamKey(row: any) {
  return text(row.line_id) || text(row.equipe_id) || text(row.campeonato_equipe_id)
}

function createTeam(key: string, row: any): TeamNode {
  return {
    ...node(key), equipe_id: text(row.equipe_id) || null, line_id: text(row.line_id) || null,
    nome: text(row.nome_exibicao || row.line_nome || row.equipe_nome) || 'Equipe', tag: text(row.line_tag || row.equipe_tag) || null,
    logo_url: text(row.line_logo_url || row.equipe_logo_url) || null, campeonatos: new Set(), jogadores: new Set(), quedas: new Set(), pontos: 0, abates: 0, booyahs: 0,
    dano: 0, assistencias: 0, revives: 0, headshots: 0, knockdowns: 0, sobrevivencia_segundos: 0, distancia_movida: 0, distancia_max_abate: 0, granadas_usadas: 0, gel_usado: 0, kits_medicos: 0,
  }
}

function createPlayer(key: string, row: any): PlayerNode {
  return {
    ...node(key), jogador_id: text(row.jogador_id) || null, id_jogo: text(row.id_jogo || row.id_jogo_snapshot) || null,
    nick: text(row.nick || row.nick_snapshot) || 'Jogador', foto_url: text(row.foto_url || row.avatar_url) || null,
    equipes: new Set(), campeonatos: new Set(), quedas: new Set(), abates: 0, dano: 0, assistencias: 0, revives: 0, armas: new Map(), habilidades: new Map(), funcao: text(row.funcao) || null,
    headshots: 0, knockdowns: 0, sobrevivencia_segundos: 0, distancia_movida: 0, distancia_max_abate: 0, granadas_usadas: 0, gel_usado: 0, kits_medicos: 0,
  }
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

function armaMaisUsada(armas: PlayerNode['armas']) {
  return [...armas.values()]
    .sort((a, b) => b.abates - a.abates || b.dano - a.dano || a.nome.localeCompare(b.nome))[0]?.nome || null
}

function habilidadesMaisUsadas(habilidades: PlayerNode['habilidades'], tipo: string, limite: number) {
  return [...habilidades.values()]
    .filter(habilidade => habilidade.tipo === tipo)
    .sort((a, b) => b.usos - a.usos || b.pick_times - a.pick_times || b.pick_rate - a.pick_rate || a.habilidade.localeCompare(b.habilidade))
    .slice(0, limite)
}

function somarDetalhesGarena(target: any, row: any, incluirBase = true) {
  const fields = incluirBase
    ? ['dano', 'assistencias', 'revives', 'headshots', 'knockdowns', 'sobrevivencia_segundos', 'distancia_movida', 'distancia_max_abate', 'granadas_usadas', 'gel_usado', 'kits_medicos']
    : ['headshots', 'knockdowns', 'sobrevivencia_segundos', 'distancia_movida', 'distancia_max_abate', 'granadas_usadas', 'gel_usado', 'kits_medicos']
  for (const field of fields) {
    target[field] = number(target[field]) + number(row[field])
  }
}

function createChampionship(row: any): ChampionshipNode {
  const config = Array.isArray(row.campeonato_configuracoes) ? row.campeonato_configuracoes[0] : row.campeonato_configuracoes || {}
  return {
    ...node(text(row.id)), nome: text(row.nome) || 'Campeonato', logo_url: text(row.logo_url || row.banner_url) || null, tipo: text(row.tipo) || null,
    premiacao: number(config.premiacao || row.premiacao), participantes: new Set(), jogadores: new Set(), quedas: new Set(),
    tem_live: Boolean(config.tem_live), tem_trofeu: Boolean(config.tem_trofeu), vagas: number(config.numero_vagas),
  }
}

function rankRows<T extends { key: string; score: number }>(rows: T[], tieBreaker: (a: T, b: T) => number) {
  return [...rows]
    .sort((a, b) => b.score - a.score || tieBreaker(a, b) || a.key.localeCompare(b.key))
    .slice(0, 100)
    .map((row, index) => ({ ...row, rank: index + 1, score: round(row.score), tier: tier(row.score) }))
}

/**
 * Tier graph with bounded feedback. Base performance is always dominant; the
 * quality of teammates and championships enriches it but cannot self-inflate.
 */
export async function carregarRankingTiers() {
  const { data: championships, error: championshipsError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,banner_url,tipo,premiacao,status,campeonato_configuracoes(premiacao,numero_vagas,tem_live,tem_trofeu,formato)')
    .eq('aprovacao_status', 'aprovado')
    .is('deleted_at', null)
    .neq('status', 'excluido')
    .limit(5000)
  if (championshipsError) throw championshipsError

  const championshipMap = new Map((championships || []).map((row: any) => [text(row.id), createChampionship(row)]))
  const championshipIds = [...championshipMap.keys()]
  if (!championshipIds.length) return emptyRanking()

  const [teamsResult, playersResult, participationsResult, rosterResult, garenaImportsResult] = await Promise.all([
    supabaseAdmin.from('campeonato_estatisticas_equipes_detalhe').select('*').in('campeonato_id', championshipIds).limit(50000),
    supabaseAdmin.from('campeonato_estatisticas_mvp_detalhe').select('*').in('campeonato_id', championshipIds).limit(100000),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,line_id,nome_exibicao,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
      .in('campeonato_id', championshipIds)
      .eq('status', 'ativo')
      .limit(50000),
    supabaseAdmin
      .from('campeonato_jogadores')
      .select('campeonato_id,campeonato_equipe_id,jogador_id,jogador_temporario_id,id_jogo,nick,funcao,status')
      .in('campeonato_id', championshipIds)
      .neq('status', 'deletado')
      .limit(100000),
    supabaseAdmin
      .from('garena_matchstats_importacoes')
      .select('id')
      .in('campeonato_id', championshipIds)
      .eq('status', 'concluida')
      .limit(50000),
  ])
  for (const result of [teamsResult, playersResult, participationsResult, rosterResult, garenaImportsResult]) if (result.error) throw result.error

  const teams = new Map<string, TeamNode>()
  const players = new Map<string, PlayerNode>()
  const teamByParticipation = new Map<string, string>()

  for (const row of participationsResult.data || []) {
    const championship = championshipMap.get(text(row.campeonato_id))
    const key = teamKey(row)
    if (!championship || !key) continue
    const line = Array.isArray((row as any).equipe_lines) ? (row as any).equipe_lines[0] : (row as any).equipe_lines
    const equipe = Array.isArray((row as any).equipes) ? (row as any).equipes[0] : (row as any).equipes
    const current = teams.get(key) || createTeam(key, { ...row, line_nome: line?.nome, line_tag: line?.tag, line_logo_url: line?.logo_url, equipe_nome: equipe?.nome, equipe_tag: equipe?.tag, equipe_logo_url: equipe?.logo_url })
    teams.set(key, current)
    teamByParticipation.set(text(row.id), key)
    current.campeonatos.add(championship.key)
    championship.participantes.add(key)
  }

  for (const row of teamsResult.data || []) {
    const championship = championshipMap.get(text(row.campeonato_id))
    const key = teamByParticipation.get(text(row.campeonato_equipe_id)) || teamKey(row)
    if (!championship || !key) continue
    const current = teams.get(key) || createTeam(key, row)
    teams.set(key, current)
    current.campeonatos.add(championship.key)
    championship.participantes.add(key)
    const dropId = text(row.partida_id)
    if (dropId) { current.quedas.add(dropId); championship.quedas.add(dropId) }
    current.pontos += number(row.pontos_total)
    current.abates += number(row.abates)
    current.booyahs += row.booyah ? 1 : 0
  }

  for (const row of playersResult.data || []) {
    const championship = championshipMap.get(text(row.campeonato_id))
    const key = playerKey(row)
    if (!championship || !key) continue
    const current = players.get(key) || createPlayer(key, row)
    players.set(key, current)
    current.campeonatos.add(championship.key)
    championship.jogadores.add(key)
    const team = teamByParticipation.get(text(row.campeonato_equipe_id)) || teamKey(row)
    if (team) { current.equipes.add(team); const teamNode = teams.get(team) || createTeam(team, row); teamNode.jogadores.add(key); teams.set(team, teamNode) }
    const dropId = text(row.partida_id)
    if (dropId) { current.quedas.add(dropId); championship.quedas.add(dropId) }
    current.abates += number(row.abates)
    current.dano += number(row.dano)
    current.assistencias += number(row.assistencias)
    current.revives += number(row.revives)
  }

  // Roster links matter before a player has a scored fall: the team quality
  // still reflects the strength of the active lineup.
  for (const row of rosterResult.data || []) {
    const championship = championshipMap.get(text(row.campeonato_id))
    const playerId = playerKey(row)
    const team = teamByParticipation.get(text(row.campeonato_equipe_id))
    if (!championship || !playerId || !team || !players.has(playerId)) continue
    const player = players.get(playerId)!
    player.equipes.add(team)
    if (!player.funcao) player.funcao = text(row.funcao) || null
    teams.get(team)?.jogadores.add(playerId)
    championship.jogadores.add(playerId)
  }

  const garenaImportIds = (garenaImportsResult.data || []).map((row: any) => text(row.id)).filter(Boolean)
  for (const importIds of chunks(garenaImportIds, 100)) {
    const { data: matchstatsRows, error: matchstatsError } = await supabaseAdmin
      .from('garena_matchstats_jogadores')
      .select('jogador_id,jogador_temporario_id,player_id,campeonato_equipe_id,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,granadas_usadas,gel_usado,kits_medicos,garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,personagem,habilidade,usos,pick_times,pick_rate)')
      .in('importacao_id', importIds)
      .limit(100000)
    if (matchstatsError) throw matchstatsError
    for (const row of matchstatsRows || []) {
      const player = players.get(text(row.jogador_id)) || players.get(text(row.jogador_temporario_id)) || players.get(text(row.player_id))
      const teamKeyFromMatchstats = teamByParticipation.get(text(row.campeonato_equipe_id))
      const team = teamKeyFromMatchstats ? teams.get(teamKeyFromMatchstats) : null
      if (team) somarDetalhesGarena(team, row)
      if (!player) continue
      somarDetalhesGarena(player, row, false)
      for (const weapon of ((row as any).garena_matchstats_armas || [])) {
        const nome = text(weapon.arma)
        if (!nome) continue
        const current = player.armas.get(nome) || { nome, abates: 0, dano: 0 }
        current.abates += number(weapon.abates)
        current.dano += number(weapon.dano)
        player.armas.set(nome, current)
      }
      for (const skill of ((row as any).garena_matchstats_habilidades || [])) {
        const tipo = text(skill.tipo)
        const habilidade = text(skill.habilidade)
        if (!tipo || !habilidade) continue
        const key = `${tipo}:${habilidade}`
        const current = player.habilidades.get(key) || { tipo, personagem: text(skill.personagem) || null, habilidade, usos: 0, pick_times: 0, pick_rate: 0 }
        current.usos += number(skill.usos)
        current.pick_times += number(skill.pick_times)
        current.pick_rate += number(skill.pick_rate)
        player.habilidades.set(key, current)
      }
    }
  }

  const playerQuality = percentile([...players.values()].map(player => {
    const falls = Math.max(1, player.quedas.size)
    return { key: player.key, value: player.abates / falls * 12 + player.dano / falls / 250 + player.assistencias / falls * 4 + player.revives / falls * 3 }
  }))
  for (const player of players.values()) {
    const sample = Math.min(1, player.quedas.size / 12)
    player.base = clamp(10 + 64 * Number(playerQuality.get(player.key) || 0) * (.4 + .6 * sample) + 16 * sample)
    player.score = player.base
  }

  const teamQuality = percentile([...teams.values()].map(team => {
    const falls = Math.max(1, team.quedas.size)
    return { key: team.key, value: team.pontos / falls * 1.5 + team.abates / falls * 4 + team.booyahs / falls * 18 }
  }))
  for (const team of teams.values()) {
    const sample = Math.min(1, team.quedas.size / 12)
    team.base = clamp(8 + 66 * Number(teamQuality.get(team.key) || 0) * (.45 + .55 * sample) + 14 * sample)
    team.score = team.base
  }

  for (const championship of championshipMap.values()) {
    const prize = Math.min(16, Math.log10(Math.max(0, championship.premiacao) + 1) / Math.log10(10001) * 16)
    const structure = Math.min(12, championship.participantes.size * 1.2) + Math.min(16, championship.quedas.size * 1.35)
    championship.base = clamp(6 + prize + structure + (championship.tem_live ? 3 : 0) + (championship.tem_trofeu ? 2 : 0) + Math.min(5, championship.vagas / 12))
    championship.score = championship.base
  }

  for (let iteration = 0; iteration < ITERACOES; iteration += 1) {
    const nextPlayers = new Map<string, number>()
    const nextTeams = new Map<string, number>()
    const nextChampionships = new Map<string, number>()
    for (const player of players.values()) {
      const teamAverage = average([...player.equipes].map(key => teams.get(key)?.score ?? Number.NaN))
      const championshipAverage = average([...player.campeonatos].map(key => championshipMap.get(key)?.score ?? Number.NaN))
      player.equipeScores = teamAverage === null ? [] : [teamAverage]
      player.campeonatoScores = championshipAverage === null ? [] : [championshipAverage]
      nextPlayers.set(player.key, weighted(player.base, [{ value: player.base, weight: .72 }, { value: teamAverage, weight: .20 }, { value: championshipAverage, weight: .08 }]))
    }
    for (const team of teams.values()) {
      const playerAverage = average([...team.jogadores].map(key => players.get(key)?.score ?? Number.NaN))
      const championshipAverage = average([...team.campeonatos].map(key => championshipMap.get(key)?.score ?? Number.NaN))
      team.jogadorScores = playerAverage === null ? [] : [playerAverage]
      team.campeonatoScores = championshipAverage === null ? [] : [championshipAverage]
      nextTeams.set(team.key, weighted(team.base, [{ value: team.base, weight: .66 }, { value: playerAverage, weight: .26 }, { value: championshipAverage, weight: .08 }]))
    }
    for (const championship of championshipMap.values()) {
      const teamAverage = average([...championship.participantes].map(key => teams.get(key)?.score ?? Number.NaN))
      const playerAverage = average([...championship.jogadores].map(key => players.get(key)?.score ?? Number.NaN))
      championship.equipeScores = teamAverage === null ? [] : [teamAverage]
      championship.jogadorScores = playerAverage === null ? [] : [playerAverage]
      nextChampionships.set(championship.key, weighted(championship.base, [{ value: championship.base, weight: .32 }, { value: teamAverage, weight: .36 }, { value: playerAverage, weight: .32 }]))
    }
    for (const [key, score] of nextPlayers) players.get(key)!.score = score
    for (const [key, score] of nextTeams) teams.get(key)!.score = score
    for (const [key, score] of nextChampionships) championshipMap.get(key)!.score = score
  }

  return {
    updated_at: new Date().toISOString(),
    metodologia: { iteracoes: ITERACOES, base: 'desempenho oficial', influencia: 'qualidade cruzada com limites', premiacao_maxima: 16 },
    players: rankRows([...players.values()], (a, b) => b.abates - a.abates || b.dano - a.dano).map(player => ({
      key: player.key, rank: player.rank, score: player.score, tier: player.tier, jogador_id: player.jogador_id, nick: player.nick, id_jogo: player.id_jogo, foto_url: player.foto_url, avatar_url: player.foto_url,
      funcao: player.funcao,
      equipes: [...player.equipes].map(key => teams.get(key)).filter((team): team is TeamNode => Boolean(team)).map(team => ({ id: team.key, nome: team.nome, tag: team.tag, line_id: team.line_id })),
      quedas: player.quedas.size, abates: player.abates, dano: player.dano, assistencias: player.assistencias, revives: player.revives,
      headshots: player.headshots, knockdowns: player.knockdowns, sobrevivencia_segundos: player.sobrevivencia_segundos, distancia_movida: player.distancia_movida, distancia_max_abate: player.distancia_max_abate, granadas_usadas: player.granadas_usadas, gel_usado: player.gel_usado, kits_medicos: player.kits_medicos,
      arma_mais_usada: armaMaisUsada(player.armas), habilidade_ativa: habilidadesMaisUsadas(player.habilidades, 'ativa', 1)[0] || null, habilidades_passivas: habilidadesMaisUsadas(player.habilidades, 'passiva', 3),
      score_base: round(player.base), influencia_equipes: round(average(player.equipeScores) || 0), influencia_campeonatos: round(average(player.campeonatoScores) || 0),
    })),
    teams: rankRows([...teams.values()].filter(team => team.quedas.size || team.jogadores.size), (a, b) => b.pontos - a.pontos || b.abates - a.abates).map(team => ({
      key: team.key, rank: team.rank, score: team.score, tier: team.tier, equipe_id: team.equipe_id, line_id: team.line_id, nome: team.nome, tag: team.tag, logo_url: team.logo_url,
      quedas: team.quedas.size, booyahs: team.booyahs, abates: team.abates, pontos: round(team.pontos), jogadores: team.jogadores.size,
      dano: team.dano, assistencias: team.assistencias, revives: team.revives, headshots: team.headshots, knockdowns: team.knockdowns, sobrevivencia_segundos: team.sobrevivencia_segundos, distancia_movida: team.distancia_movida, distancia_max_abate: team.distancia_max_abate, granadas_usadas: team.granadas_usadas, gel_usado: team.gel_usado, kits_medicos: team.kits_medicos,
      score_base: round(team.base), influencia_jogadores: round(average(team.jogadorScores) || 0), influencia_campeonatos: round(average(team.campeonatoScores) || 0),
    })),
    championships: rankRows([...championshipMap.values()].filter(championship => championship.participantes.size || championship.quedas.size), (a, b) => b.participantes.size - a.participantes.size || b.quedas.size - a.quedas.size).map(championship => ({
      key: championship.key, rank: championship.rank, score: championship.score, tier: championship.tier, campeonato_id: championship.key, nome: championship.nome, logo_url: championship.logo_url, tipo: championship.tipo,
      participantes: championship.participantes.size, jogadores: championship.jogadores.size, quedas: championship.quedas.size, premiacao: championship.premiacao,
      score_base: round(championship.base), influencia_equipes: round(average(championship.equipeScores) || 0), influencia_jogadores: round(average(championship.jogadorScores) || 0),
    })),
  }
}

function emptyRanking() {
  return { updated_at: new Date().toISOString(), metodologia: { iteracoes: ITERACOES, base: 'desempenho oficial', influencia: 'qualidade cruzada com limites', premiacao_maxima: 16 }, players: [], teams: [], championships: [] }
}
