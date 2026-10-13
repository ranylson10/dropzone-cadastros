import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../shared/paginated-query'
import { carregarPublicacoesEstatisticas, type PublicacaoEstatisticas } from '../campeonatos/estatisticas/publicacao.service'

export function publishedFallOwners(publications: Map<string, PublicacaoEstatisticas>) {
  const owners = new Map<string, string>()
  for (const [championshipId, publication] of publications) for (const id of publication.partidas_publicadas) owners.set(id, championshipId)
  return owners
}

/** Imports must belong to the same public championship as their published fall. */
export async function readPublishedGarenaImports(fallOwners: Map<string, string>) {
  const rows = await readRowsByIds<any>([...fallOwners.keys()], batch => supabaseAdmin
    .from('garena_matchstats_importacoes').select('id,campeonato_id,partida_id,concluida_em')
    .in('partida_id', batch).eq('status', 'concluida').eq('consolidacao_oficial', true)
    .order('id', { ascending: true }))
  return rows.filter(row => fallOwners.get(String(row.partida_id)) === String(row.campeonato_id))
}

/** Entity history is scoped before paging; no unrelated player's history is fetched. */
export async function readPublicCompetitiveHistory(kind: 'equipes' | 'jogadores', id: string) {
  const isPlayer = kind === 'jogadores'
  const participations = await readPagedRows<any>(supabaseAdmin
    .from(isPlayer ? 'campeonato_jogadores' : 'campeonato_equipes').select('id,campeonato_id')
    .eq(isPlayer ? 'jogador_id' : 'equipe_id', id).neq('status', 'deletado')
    .order('id', { ascending: true }))
  const publications = await carregarPublicacoesEstatisticas(participations.map(row => String(row.campeonato_id)))
  const imports = await readPublishedGarenaImports(publishedFallOwners(publications))
  const importById = new Map(imports.map(row => [String(row.id), row]))
  const rows = await readRowsByIds<any>([...importById.keys()], batch => {
    const columns = 'importacao_id,campeonato_equipe_id,jogador_id,abates,dano,assistencias,revives,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,granadas_usadas,gel_usado,kits_medicos,precisao_percentual,garena_matchstats_armas(arma,abates,dano),garena_matchstats_habilidades(tipo,personagem,habilidade,usos,pick_times,pick_rate)'
    let query = supabaseAdmin.from('garena_matchstats_jogadores')
      .select(isPlayer ? columns : `${columns},campeonato_equipes!inner(equipe_id)`)
      .in('importacao_id', batch)
    if (isPlayer) query = query.eq('jogador_id', id)
    else query = query.eq('campeonato_equipes.equipe_id', id)
    return query.order('id', { ascending: true })
  })
  const participationOwners = new Map(participations.map(row => [String(row.id), String(row.campeonato_id)]))
  return rows.filter(row => isPlayer || participationOwners.get(String(row.campeonato_equipe_id)) === String(importById.get(String(row.importacao_id))?.campeonato_id))
    .map(row => ({ ...row, garena_matchstats_importacoes: importById.get(String(row.importacao_id)) }))
}
