import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows } from '../shared/paginated-query'
import { getCampeonatoPermission } from './campeonato-permissions'
import { loadLigaConfig } from './liga-config'
import { listarEstatisticasEquipes } from './estatisticas/estatisticas.service'
import { buildLeagueSeasonSuggestions, seasonName, seasonQuantity, validateSeasonPlan } from './league-season-plan'
import type { LigaPlan } from './liga-plan'
/** Private previous-season data is read only after authorizing management of both resources. */
async function readLeagueSeasonSuggestions(championship: string, current: LigaPlan | null, actor: string | null) {
  if (!actor || !current?.divisoes.length) return null
  validateSeasonPlan(current)
  const { data: edition, error: editionError } = await supabaseAdmin.from('campeonato_edicoes')
    .select('id,franquia_id,numero_edicao,temporada').eq('campeonato_id', championship).maybeSingle()
  if (editionError) throw editionError
  if (!edition?.franquia_id || Number(edition.numero_edicao) <= 1) return null
  const { data: previous, error: previousError } = await supabaseAdmin.from('campeonato_edicoes')
    .select('id,campeonato_id,numero_edicao,temporada,titulo_publico').eq('franquia_id', edition.franquia_id)
    .lt('numero_edicao', Number(edition.numero_edicao)).order('numero_edicao', { ascending: false }).order('id', { ascending: true }).limit(1).maybeSingle()
  if (previousError) throw previousError
  if (!previous?.campeonato_id) return null
  const permission = await getCampeonatoPermission(actor, String(previous.campeonato_id))
  if (!permission.canView || !permission.canManage || permission.role === 'none') return null
  const prior = await loadLigaConfig(previous.campeonato_id, true)
  if (!prior) throw new Error('O plano da temporada anterior não está disponível.')
  validateSeasonPlan(prior)
  const groups = await readPagedRows<any>(supabaseAdmin.from('campeonato_grupos').select('id,campeonato_id,nome')
    .eq('campeonato_id', previous.campeonato_id).order('id', { ascending: true }))
  const needed = new Set<string>()
  for (const division of current.divisoes) for (const entry of division.entradas) if (seasonQuantity(entry.quantidade) && ['mantida','promovida','rebaixada'].includes(entry.tipo)) needed.add(entry.tipo === 'mantida' ? division.id : entry.origem_agrupamento_id)
  const rankings = new Map<string, any[]>()
  for (const sourceId of needed) {
    const division = prior.divisoes.find(row => row.id === sourceId), matches = groups.filter(row => division && seasonName(row.nome) === seasonName(division.nome))
    if (!division || matches.length !== 1 || matches[0].campeonato_id !== previous.campeonato_id) throw new Error('O agrupamento de origem da temporada anterior é ausente ou ambíguo.')
    rankings.set(sourceId, await listarEstatisticasEquipes(previous.campeonato_id, { grupoId: matches[0].id }))
  }
  return { previous_championship_id: String(previous.campeonato_id), previous_edition_number: Number(previous.numero_edicao),
    previous_season: previous.temporada || null, previous_title: previous.titulo_publico || null,
    current_edition_number: Number(edition.numero_edicao), current_season: edition.temporada || null,
    suggestions: buildLeagueSeasonSuggestions(current, prior, rankings) }
}
export async function loadLeagueSeasonSuggestions(championship:string,current:LigaPlan|null,actor:string|null){
  try{return await readLeagueSeasonSuggestions(championship,current,actor)}
  catch(error){const message=error instanceof Error?error.message:''
    const safe=new Set(['O plano da temporada possui uma quantidade inválida.','Plano da temporada indisponível.','O plano da temporada possui agrupamentos ambíguos.',
      'O plano da temporada possui uma origem inválida.','A origem da temporada anterior não foi encontrada.','A quantidade da temporada excede o limite.',
      'A classificação da origem da temporada anterior não foi encontrada.','Uma equipe ou line aparece em mais de uma sugestão. Revise a classificação e as cotas.',
      'A temporada excede o limite de sugestões.','O plano da temporada anterior não está disponível.','O agrupamento de origem da temporada anterior é ausente ou ambíguo.'])
    throw new Error(safe.has(message)?message:'Não foi possível carregar as sugestões da temporada. Atualize o acompanhamento.')}
}
