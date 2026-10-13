import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { readPagedRows } from '@backend/shared/paginated-query'
import { filterLiteral } from './search-page'
import { isPublicDirectoryRow } from '../shared/public-visibility'
export { isPublicDirectoryRow } from '../shared/public-visibility'

export type PublicProfileKind = 'campeonatos' | 'equipes' | 'jogadores' | 'managers' | 'produtoras'
type Row = Record<string, any>
export type PublicProfileBaseData = {
  row: Row
  configs?: Row[]; phases?: Row[]; slots?: Row[]; games?: Row[]; producers?: Row[]
  lines?: Row[]; participations?: Row[]; registrations?: Row[]; links?: Row[]; championships?: Row[]
}
const columns: Record<PublicProfileKind, string> = {
  campeonatos: 'id,nome,tipo,logo_url,banner_url,status,created_at,aprovacao_status,deleted_at,produtora_id',
  equipes: 'id,nome,username,logo_url,tag,bio,localidade,cidade,estado,pais,status,created_at',
  jogadores: 'id,nome,username,avatar_url,funcao,localidade,cidade,estado,pais,bio,id_jogo,status,created_at',
  managers: 'id,nome,username,avatar_url,localidade,cidade,estado,pais,bio,status,created_at',
  // The ownership ID is used only by the server to count historical championships.
  produtoras: 'id,auth_user_id,nome,username,logo_url,bio,localidade,cidade,estado,pais,status,created_at',
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function related(table: string, projection: string, column: string, value: string) {
  const rows = await readPagedRows<Row>(supabaseAdmin.from(table).select(projection).eq(column, value).order('id'))
  return rows.filter(isPublicDirectoryRow)
}

/** A public profile reads one parent first; invisible parents never trigger related reads. */
export async function readPublicProfileBase(kind: PublicProfileKind, id: string): Promise<PublicProfileBaseData | null> {
  if (!Object.hasOwn(columns, kind) || !uuid.test(id)) return null
  id = id.toLowerCase()
  const { data: row, error } = await supabaseAdmin.from(kind).select(columns[kind]).eq('id', id).maybeSingle<Row>()
  if (error) throw error
  if (!row || !isPublicDirectoryRow(row)) return null

  if (kind === 'campeonatos') {
    const [configs, phases, slots, games, producers] = await Promise.all([
      related('campeonato_configuracoes', 'id,campeonato_id,formato,numero_vagas,valor_inscricao,premiacao,tem_live,plataforma,servidor,data_limite_inscricao', 'campeonato_id', id),
      related('campeonato_fases', 'id,campeonato_id,ordem,status', 'campeonato_id', id),
      related('campeonato_slots', 'id,campeonato_id,fase_id,status,equipe_id,line_id', 'campeonato_id', id),
      related('campeonato_jogos', 'id,campeonato_id,status,data_jogo,horario', 'campeonato_id', id),
      row.produtora_id ? related('produtoras', 'id,nome,username,logo_url,status', 'id', String(row.produtora_id)) : Promise.resolve([]),
    ])
    return { row, configs, phases, slots, games, producers }
  }
  if (kind === 'equipes') {
    const [lines, participations] = await Promise.all([
      related('equipe_lines', 'id,equipe_id,nome,status', 'equipe_id', id),
      related('campeonato_equipes', 'id,equipe_id,status', 'equipe_id', id),
    ])
    return { row, lines, participations }
  }
  if (kind === 'jogadores') return { row, registrations: await related('campeonato_jogadores', 'id,jogador_id,status', 'jogador_id', id) }
  if (kind === 'managers') {
    const rows = await Promise.all(['manager_equipe', 'manager_produtora', 'manager_jogador'].map(table => related(table, 'id,manager_id,status', 'manager_id', id)))
    return { row, links: rows.flat() }
  }
  let query = supabaseAdmin.from('campeonatos').select('id,criado_por,produtora_id,status,aprovacao_status,deleted_at')
  query = row.auth_user_id
    ? query.or(`produtora_id.eq.${filterLiteral(id)},criado_por.eq.${filterLiteral(String(row.auth_user_id))}`)
    : query.eq('produtora_id', id)
  const championships = (await readPagedRows<Row>(query.order('id'))).filter(isPublicDirectoryRow)
  return { row, championships }
}
