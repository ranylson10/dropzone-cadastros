import { supabaseAdmin } from '../../shared/supabase-admin'

const MATCHSTATS_API_URL = 'https://matchstats.us.ffesports.com/api/match_stats/match_data'
const REQUEST_TIMEOUT_MS = 12_000

type JsonRecord = Record<string, unknown>

export type MatchStatsContext = {
  campeonatoId: string
  jogoId: string
  partidaId: string
  produtoraId: string
  matchresultImportacaoId: string
  nomeArquivo?: string | null
  userId: string
}

type ImportedPlayer = {
  player: JsonRecord
  equipe: JsonRecord
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : []
}

function text(value: unknown): string | null {
  const result = String(value ?? '').trim()
  return result || null
}

function integer(value: unknown): number {
  const result = Number.parseInt(String(value ?? 0).replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(result) ? result : 0
}

function decimal(value: unknown): number {
  const normalized = String(value ?? 0).trim().replace('%', '').replace(',', '.')
  const result = Number.parseFloat(normalized)
  return Number.isFinite(result) ? result : 0
}

function idKey(value: unknown) {
  return String(value ?? '').trim()
}

function normalizedName(value: unknown) {
  return String(value ?? '').normalize('NFKC').replace(/[\u00A0\u3164\uFFA0]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function requireSuccess(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/** Extracts only an official MatchResult filename, never arbitrary numbers from log content. */
export function extractGarenaMatchId(nomeArquivo?: string | null): string | null {
  const value = String(nomeArquivo || '').trim()
  const match = value.match(/(?:^|[\\/])MatchResult_(\d{16,24})(?=[_\-.]|$)/i)
  return match?.[1] || null
}

function extractPlayers(payload: JsonRecord): ImportedPlayer[] {
  const data = record(payload.data)
  const players: ImportedPlayer[] = []
  for (const group of list(data.team_stats)) {
    for (const equipe of list(group.team_stats)) {
      for (const player of list(equipe.player_data)) players.push({ player, equipe })
    }
  }
  return players.filter(({ player }) => Boolean(text(player.player_id)))
}

async function fetchMatchStats(matchId: string): Promise<JsonRecord> {
  let response: Response
  try {
    response = await fetch(MATCHSTATS_API_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_ids: [matchId], single_match_id: [] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new Error('Não foi possível consultar as estatísticas detalhadas desta queda.')
  }
  if (!response.ok) throw new Error(`A consulta de estatísticas detalhadas foi recusada (HTTP ${response.status}).`)
  let payload: JsonRecord
  try {
    payload = record(await response.json())
  } catch {
    throw new Error('A consulta de estatísticas detalhadas retornou um formato inválido.')
  }
  if (integer(payload.code) !== 0) throw new Error(text(payload.msg) || 'A partida não possui estatísticas detalhadas disponíveis.')
  return payload
}

async function findPlayerLinks(importacaoId: string, campeonatoId: string) {
  const [{ data: jogadores, error: jogadoresError }, { data: equipes, error: equipesError }, { data: participacoes, error: participacoesError }] = await Promise.all([
    supabaseAdmin
    .from('matchresult_importacoes_jogadores')
    .select('id_jogo,campeonato_jogador_id,jogador_id,jogador_temporario_id,importacao_equipe_id')
    .eq('importacao_id', importacaoId),
    supabaseAdmin
    .from('matchresult_importacoes_equipes')
    .select('id,campeonato_equipe_id,nome_normalizado')
    .eq('importacao_id', importacaoId),
    supabaseAdmin
    .from('campeonato_jogadores')
    .select('id,id_jogo,campeonato_equipe_id,jogador_id,jogador_temporario_id,status')
    .eq('campeonato_id', campeonatoId)
    .neq('status', 'deletado')
    .not('id_jogo', 'is', null),
  ])
  requireSuccess(jogadoresError)
  requireSuccess(equipesError)
  requireSuccess(participacoesError)
  const teamsByImportId = new Map((equipes || []).map((item: any) => [item.id, item.campeonato_equipe_id]))
  const teamsByName = new Map((equipes || []).map((item: any) => [normalizedName(item.nome_normalizado), item.campeonato_equipe_id]))
  const links = new Map((participacoes || []).map((item: any) => [idKey(item.id_jogo), {
    campeonato_jogador_id: item.id,
    jogador_id: item.jogador_id,
    jogador_temporario_id: item.jogador_temporario_id,
    campeonato_equipe_id: item.campeonato_equipe_id,
  }]))
  // The import-specific link is the strongest source; existing championship
  // participation repairs older MatchResults that were interrupted midway.
  for (const item of jogadores || []) links.set(idKey(item.id_jogo), {
    campeonato_jogador_id: item.campeonato_jogador_id,
    jogador_id: item.jogador_id,
    jogador_temporario_id: item.jogador_temporario_id,
    campeonato_equipe_id: teamsByImportId.get(item.importacao_equipe_id) || null,
  })
  return { links, teamsByName }
}


async function persistirResultadosJogadoresOficiais(context: MatchStatsContext, rows: any[]) {
  const linkedRows = rows.filter((row) => row.campeonato_jogador_id && row.campeonato_equipe_id)
  if (!linkedRows.length) return 0

  const campeonatoJogadorIds = [...new Set(linkedRows.map((row) => String(row.campeonato_jogador_id)))]
  const campeonatoEquipeIds = [...new Set(linkedRows.map((row) => String(row.campeonato_equipe_id)))]

  const [
    { data: partida, error: partidaError },
    { data: participacoes, error: participacoesError },
    { data: equipes, error: equipesError },
  ] = await Promise.all([
    supabaseAdmin
      .from('campeonato_partidas')
      .select('id,fase_id,jogo_id,grupo_id')
      .eq('id', context.partidaId)
      .eq('campeonato_id', context.campeonatoId)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,jogador_id,jogador_temporario_id,equipe_id,line_id,nick,id_jogo')
      .in('id', campeonatoJogadorIds),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,line_id,grupo_id')
      .in('id', campeonatoEquipeIds),
  ])
  requireSuccess(partidaError)
  requireSuccess(participacoesError)
  requireSuccess(equipesError)
  if (!partida) throw new Error('Não foi possível localizar a queda para consolidar as estatísticas dos jogadores.')

  const participacaoById = new Map((participacoes || []).map((row: any) => [String(row.id), row]))
  const equipeById = new Map((equipes || []).map((row: any) => [String(row.id), row]))
  const officialRows = linkedRows.flatMap((row) => {
    const participacao: any = participacaoById.get(String(row.campeonato_jogador_id))
    const equipe: any = equipeById.get(String(row.campeonato_equipe_id))
    if (!participacao || !equipe) return []
    return [{
      campeonato_id: context.campeonatoId,
      fase_id: partida.fase_id,
      jogo_id: partida.jogo_id || context.jogoId,
      partida_id: partida.id,
      grupo_id: equipe.grupo_id || partida.grupo_id,
      campeonato_equipe_id: row.campeonato_equipe_id,
      campeonato_jogador_id: row.campeonato_jogador_id,
      jogador_id: participacao.jogador_id || row.jogador_id || null,
      jogador_temporario_id: participacao.jogador_temporario_id || row.jogador_temporario_id || null,
      equipe_id: participacao.equipe_id || equipe.equipe_id,
      line_id: participacao.line_id || equipe.line_id,
      nick_snapshot: participacao.nick || row.nick_snapshot,
      id_jogo_snapshot: participacao.id_jogo || row.player_id,
      abates: Number(row.abates || 0),
      dano: Number(row.dano || 0),
      assistencias: Number(row.assistencias || 0),
      revives: Number(row.revives || 0),
      origem: 'matchresult',
      criado_por: context.userId,
      updated_at: new Date().toISOString(),
    }]
  })

  if (!officialRows.length) return 0
  const { error } = await supabaseAdmin
    .from('campeonato_resultados_jogadores')
    .upsert(officialRows, { onConflict: 'partida_id,campeonato_jogador_id' })
  requireSuccess(error)
  return officialRows.length
}

async function markImportFailure(importacaoId: string, error: unknown) {
  await supabaseAdmin.from('garena_matchstats_importacoes').update({
    status: 'falhou',
    erro: error instanceof Error ? error.message.slice(0, 800) : 'Falha desconhecida ao consultar estatísticas detalhadas.',
    updated_at: new Date().toISOString(),
  }).eq('id', importacaoId)
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível consultar as estatísticas detalhadas.'
}

/**
 * Server-only enrichment triggered after the official MatchResult was confirmed.
 * Errors are deliberately isolated so the official scoring is never affected.
 */
export async function sincronizarEstatisticasGarena(context: MatchStatsContext) {
  const matchId = extractGarenaMatchId(context.nomeArquivo)
  if (!matchId) return { status: 'ignorado' as const }

  const { data: importacao, error: importError } = await supabaseAdmin
    .from('garena_matchstats_importacoes')
    .upsert({
      match_id: matchId,
      matchresult_importacao_id: context.matchresultImportacaoId,
      produtora_id: context.produtoraId,
      campeonato_id: context.campeonatoId,
      jogo_id: context.jogoId,
      partida_id: context.partidaId,
      nome_arquivo: context.nomeArquivo,
      status: 'processando',
      erro: null,
      consulta_em: new Date().toISOString(),
      criado_por: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'match_id' })
    .select('id')
    .single()
  requireSuccess(importError)
  if (!importacao) throw new Error('Não foi possível preparar a importação de estatísticas detalhadas.')

  try {
    const [payload, linkedData] = await Promise.all([fetchMatchStats(matchId), findPlayerLinks(context.matchresultImportacaoId, context.campeonatoId)])
    const importedPlayers = extractPlayers(payload)
    if (!importedPlayers.length) throw new Error('A partida foi encontrada, mas ainda não possui jogadores disponíveis.')

    const { error: deleteWeaponsError } = await supabaseAdmin.from('garena_matchstats_armas').delete().eq('importacao_id', importacao.id)
    requireSuccess(deleteWeaponsError)
    const { error: deleteSkillsError } = await supabaseAdmin.from('garena_matchstats_habilidades').delete().eq('importacao_id', importacao.id)
    requireSuccess(deleteSkillsError)
    const { error: deletePlayersError } = await supabaseAdmin.from('garena_matchstats_jogadores').delete().eq('importacao_id', importacao.id)
    requireSuccess(deletePlayersError)

    const rows = importedPlayers.map(({ player, equipe }) => {
      const playerId = idKey(player.player_id)
      const link = linkedData.links.get(playerId)
      const teamFromName = linkedData.teamsByName.get(normalizedName(player.team_name || equipe.team_name)) || null
      return {
        importacao_id: importacao.id,
        player_id: playerId,
        campeonato_jogador_id: link?.campeonato_jogador_id || null,
        jogador_id: link?.jogador_id || null,
        jogador_temporario_id: link?.jogador_temporario_id || null,
        campeonato_equipe_id: link?.campeonato_equipe_id || teamFromName,
        nick_snapshot: text(player.player_name) || playerId,
        equipe_snapshot: text(player.team_name) || text(equipe.team_name),
        posicao_equipe: integer(player.match_rank || equipe.match_rank),
        abates: integer(player.kills), assistencias: integer(player.assists), dano: integer(player.damage),
        headshots: integer(player.headshots), knockdowns: integer(player.knock_down), sobrevivencia_segundos: integer(player.survival_time),
        distancia_movida: integer(player.moving_distance), distancia_max_abate: integer(player.max_kill_distance),
        precisao_percentual: decimal(player.on_target), taxa_headshot_kill_percentual: decimal(player.headshot_kill_rate),
        precisao_headshot_percentual: decimal(player.headshot_accuracy_rate), revives: integer(player.revival),
        membros_revividos: integer(player.revival_members), membros_resgatados: integer(player.rescue_members),
        granadas_usadas: integer(player.grenade_use), abates_granada: integer(player.grenade_kills), dano_granada: integer(player.grenade_damage),
        gel_usado: integer(player.icewall_use), gel_destruido: integer(player.icewall_destroyed_times), kits_medicos: integer(player.medkit_use),
        abates_veiculo: integer(player.vehicle_kill), abates_oleo: integer(player.oil_kill), mudanca_posicao: integer(player.pos_change),
        dados_brutos: player,
      }
    })
    const { data: savedPlayers, error: playersError } = await supabaseAdmin.from('garena_matchstats_jogadores').insert(rows).select('id,player_id')
    requireSuccess(playersError)
    const playerIds = new Map((savedPlayers || []).map((player: any) => [player.player_id, player.id]))
    const resultadosJogadores = await persistirResultadosJogadoresOficiais(context, rows)
    const weapons: JsonRecord[] = []
    const skills: JsonRecord[] = []
    for (const { player } of importedPlayers) {
      const playerId = idKey(player.player_id)
      const savedPlayerId = playerIds.get(playerId)
      if (!savedPlayerId) continue
      list(player.weapon).forEach((weapon, index) => weapons.push({
        importacao_id: importacao.id, jogador_matchstats_id: savedPlayerId, player_id: playerId, ordem: index + 1,
        weapon_id: text(weapon.weapon_id), arma: text(weapon.weapon), abates: integer(weapon.kills), dano: integer(weapon.damage),
        headshots: integer(weapon.headshots), precisao_percentual: decimal(weapon.on_target),
        precisao_headshot_percentual: decimal(weapon.headshot_accuracy_rate), dados_brutos: weapon,
      }))
      ;[['ativa', 'active_skills'], ['passiva', 'passive_skills'], ['pet', 'pet_skills'], ['loadout', 'loadout_skills']].forEach(([tipo, property]) => {
        list(player[property]).forEach((skill, index) => skills.push({
          importacao_id: importacao.id, jogador_matchstats_id: savedPlayerId, player_id: playerId, tipo, ordem: index + 1,
          skill_id: text(skill.skill_id), personagem: text(skill.name), habilidade: text(skill.skill), usos: integer(skill.time),
          informacao: text(skill.info), pick_times: integer(skill.pick_times), pick_rate: decimal(skill.pick_rate), dados_brutos: skill,
        }))
      })
    }
    if (weapons.length) {
      const { error } = await supabaseAdmin.from('garena_matchstats_armas').insert(weapons)
      requireSuccess(error)
    }
    if (skills.length) {
      const { error } = await supabaseAdmin.from('garena_matchstats_habilidades').insert(skills)
      requireSuccess(error)
    }
    const { error: completedError } = await supabaseAdmin.from('garena_matchstats_importacoes').update({
      status: 'concluida', total_jogadores: rows.length, dados_brutos: payload, concluida_em: new Date().toISOString(), erro: null, updated_at: new Date().toISOString(),
    }).eq('id', importacao.id)
    requireSuccess(completedError)
    return { status: 'concluida' as const, jogadores: rows.length, resultados_jogadores: resultadosJogadores }
  } catch (error) {
    await markImportFailure(importacao.id, error)
    return { status: 'falhou' as const, erro: failureMessage(error) }
  }
}

/**
 * Allows a score manager to retry the private Garena enrichment for a MatchResult
 * that was already confirmed. It never alters the official score or the roster.
 */
export async function sincronizarEstatisticasGarenaDaImportacao(importacaoId: string, userId: string) {
  const { data: importacao, error } = await supabaseAdmin
    .from('matchresult_importacoes')
    .select('id,campeonato_id,jogo_id,partida_id,produtora_id,nome_arquivo,status')
    .eq('id', importacaoId)
    .maybeSingle()
  requireSuccess(error)
  if (!importacao) throw new Error('MatchResult não encontrado.')
  if (importacao.status !== 'confirmada') throw new Error('Confirme o MatchResult antes de sincronizar os dados detalhados.')

  return sincronizarEstatisticasGarena({
    campeonatoId: importacao.campeonato_id,
    jogoId: importacao.jogo_id,
    partidaId: importacao.partida_id,
    produtoraId: importacao.produtora_id,
    matchresultImportacaoId: importacao.id,
    nomeArquivo: importacao.nome_arquivo,
    userId,
  })
}
