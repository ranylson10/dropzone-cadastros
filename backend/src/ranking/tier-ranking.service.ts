import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../shared/paginated-query'
import { isPublicDirectoryRow } from '../shared/public-visibility'
import { carregarPublicacoesEstatisticas } from '../campeonatos/estatisticas/publicacao.service'
import { publishedFallOwners, readPublishedGarenaImports } from './public-performance-read.service'
import { buildTierRanking } from './tier-ranking.engine'

export async function carregarRankingCompleto() {
  const championships = (await readPagedRows<any>(supabaseAdmin
    .from('campeonatos')
    .select('id,nome,logo_url,banner_url,tipo,premiacao,status,aprovacao_status,deleted_at,campeonato_configuracoes(premiacao,numero_vagas,tem_live,tem_trofeu,formato)')
    .eq('aprovacao_status', 'aprovado').is('deleted_at', null)
    .order('id', { ascending: true }))).filter(isPublicDirectoryRow)
  if (!championships.length) return buildTierRanking({ championships: [], teamDetails: [], playerDetails: [], participations: [], roster: [], matchstatsRows: [] })
  const publications = await carregarPublicacoesEstatisticas(championships.map(row => String(row.id)))
  const publicChampionships = championships.filter(row => publications.has(String(row.id)))
  const championshipIds = publicChampionships.map(row => String(row.id))
  const fallOwners = publishedFallOwners(publications)
  const [teamDetails, playerDetails, participations, roster, garenaImports] = await Promise.all([
    readRowsByIds<any>([...fallOwners.keys()], batch => supabaseAdmin
      .from('campeonato_estatisticas_equipes_detalhe').select('*').in('partida_id', batch).order('resultado_id', { ascending: true })),
    readRowsByIds<any>([...fallOwners.keys()], batch => supabaseAdmin
      .from('campeonato_estatisticas_mvp_detalhe').select('*').in('partida_id', batch).order('resultado_id', { ascending: true })),
    readRowsByIds<any>(championshipIds, batch => supabaseAdmin.from('campeonato_equipes')
      .select('id,campeonato_id,equipe_id,line_id,nome_exibicao,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
      .in('campeonato_id', batch).eq('status', 'ativo').order('id', { ascending: true })),
    readRowsByIds<any>(championshipIds, batch => supabaseAdmin.from('campeonato_jogadores')
      .select('campeonato_id,campeonato_equipe_id,jogador_id,jogador_temporario_id,id_jogo,nick,funcao,status')
      .in('campeonato_id', batch).neq('status', 'deletado').order('id', { ascending: true })),
    readPublishedGarenaImports(fallOwners),
  ])
  const matchstatsRows = await readRowsByIds<any>(garenaImports.map(row => String(row.id)), batch => supabaseAdmin
    .from('garena_matchstats_jogadores')
    .select('jogador_id,jogador_temporario_id,player_id,campeonato_equipe_id,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,granadas_usadas,gel_usado,kits_medicos,garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,personagem,habilidade,usos,pick_times,pick_rate)')
    .in('importacao_id', batch).order('id', { ascending: true }))
  const belongsToPublishedFall = (row: any) => fallOwners.get(String(row.partida_id)) === String(row.campeonato_id)
  return buildTierRanking({ championships: publicChampionships, teamDetails: teamDetails.filter(belongsToPublishedFall), playerDetails: playerDetails.filter(belongsToPublishedFall), participations, roster, matchstatsRows })
}

/** The public leaderboard retains its Top 100 contract; profiles use the full graph. */
export async function carregarRankingTiers() {
  const ranking = await carregarRankingCompleto()
  return { ...ranking, players: ranking.players.slice(0, 100), teams: ranking.teams.slice(0, 100), championships: ranking.championships.slice(0, 100) }
}
