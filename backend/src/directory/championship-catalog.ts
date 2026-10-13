import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { readRowsByIds } from '@backend/shared/paginated-query'
import { filterLiteral, readSearchPage, searchOptions } from './search-page'

const fields = 'id,nome,tipo,logo_url,banner_url,produtora_id,created_at'
const configFields = 'id,campeonato_id,numero_vagas,valor_inscricao,premiacao,descricao_premiacao,tipo_premiacao,tem_live,plataforma,servidor,data_limite_inscricao,aceita_novas_inscricoes_equipes'

export async function publicChampionshipCatalog(params: URLSearchParams) {
  const paginated = params.has('limit') || params.has('cursor') || Boolean(params.get('q'))
  const options = searchOptions(params, 'public-championships', 30)
  const pattern = filterLiteral(`%${options.term.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')}%`)
  let query = supabaseAdmin.from('campeonatos')
    .select(fields + (options.term ? ',matching_config:campeonato_configuracoes()' : ''))
    .eq('status', 'ativo').eq('aprovacao_status', 'aprovado').is('deleted_at', null)
  let searchFilter = ''
  if (options.term) {
    // An empty embed filters parent rows without exposing configuration columns.
    query = query.or(`plataforma.ilike.${pattern},servidor.ilike.${pattern}`, { referencedTable: 'matching_config' })
    searchFilter = `nome.ilike.${pattern},tipo.ilike.${pattern},matching_config.not.is.null`
  }
  let page: { items: any[]; nextCursor: string | null; hasMore: boolean }
  if (paginated) page = await readSearchPage(query, options, searchFilter)
  else {
    // Installed clients retain their latest-500 ordering and response contract.
    const items: any[] = []
    query = query.order('created_at', { ascending: false }).order('id', { ascending: true })
    while (items.length < 500) {
      const { data, error } = await query.range(items.length, 499)
      if (error) throw error
      if (!data?.length) break
      items.push(...data)
    }
    page = { items, nextCursor: null, hasMore: false }
  }
  const ids = page.items.map(champ => String(champ.id))
  const producerIds = page.items.map(champ => String(champ.produtora_id || '')).filter(Boolean)
  const [configs, participations, purchases, games, producers] = await Promise.all([
    readRowsByIds<any>(ids, batch => supabaseAdmin.from('campeonato_configuracoes').select(configFields).in('campeonato_id', batch).order('id')),
    readRowsByIds<any>(ids, batch => supabaseAdmin.from('campeonato_equipes').select('id,campeonato_id').eq('status', 'ativo').in('campeonato_id', batch).order('id')),
    readRowsByIds<any>(ids, batch => supabaseAdmin.from('sistema_compras_vaga').select('id,campeonato_id,status,expira_em').in('status', ['pendente', 'pago', 'liberado']).in('campeonato_id', batch).order('id')),
    readRowsByIds<any>(ids, batch => supabaseAdmin.from('campeonato_jogos').select('id,campeonato_id,data_jogo,horario').eq('status', 'ativo').in('campeonato_id', batch).order('id')),
    readRowsByIds<any>(producerIds, batch => supabaseAdmin.from('produtoras').select('id,nome,username,logo_url').in('id', batch).order('id')),
  ])
  const configByChamp = new Map(configs.map(row => [String(row.campeonato_id), row]))
  const producerById = new Map(producers.map(row => [String(row.id), row]))
  const occupied = new Map<string, number>(), reserved = new Map<string, number>()
  for (const row of participations) occupied.set(row.campeonato_id, (occupied.get(row.campeonato_id) || 0) + 1)
  const now = Date.now(), today = new Date().toISOString().slice(0, 10)
  for (const row of purchases) {
    if (row.status === 'pendente' && row.expira_em && new Date(row.expira_em).getTime() <= now) continue
    reserved.set(row.campeonato_id, (reserved.get(row.campeonato_id) || 0) + 1)
  }
  const nextGame = new Map<string, any>()
  for (const row of games) {
    if (row.data_jogo && row.data_jogo < today) continue
    const previous = nextGame.get(row.campeonato_id)
    const key = (game: any) => `${game.data_jogo || '9999'} ${game.horario || ''}`
    if (!previous || key(row).localeCompare(key(previous)) < 0) nextGame.set(row.campeonato_id, row)
  }
  const announcements = page.items.map(champ => {
    const config = configByChamp.get(String(champ.id)) || {}, producer = producerById.get(String(champ.produtora_id || '')) || {}
    const total = Math.max(0, Number(config.numero_vagas || 0)), next = nextGame.get(champ.id)
    return {
      id: champ.id, nome: champ.nome, tipo: champ.tipo, logo_url: champ.logo_url, banner_url: champ.banner_url,
      produtora_id: champ.produtora_id || null, produtora_nome: producer.nome || producer.username || null, produtora_logo_url: producer.logo_url || null,
      valor_inscricao: config.valor_inscricao ?? null, premiacao: config.premiacao ?? null, descricao_premiacao: config.descricao_premiacao ?? null,
      tipo_premiacao: config.tipo_premiacao ?? null, tem_live: Boolean(config.tem_live), plataforma: config.plataforma ?? null, servidor: config.servidor ?? null,
      data_limite_inscricao: config.data_limite_inscricao ?? null, aceita_novas_inscricoes_equipes: config.aceita_novas_inscricoes_equipes !== false,
      total_vagas: total, vagas_livres: total ? Math.max(0, total - (occupied.get(champ.id) || 0) - (reserved.get(champ.id) || 0)) : 0,
      proxima_data: next?.data_jogo || null, proximo_horario: next?.horario || null,
    }
  })
  return { announcements, authenticated: false, hasTeam: false, directory: true, ...(paginated ? { nextCursor: page.nextCursor, hasMore: page.hasMore } : {}) }
}
