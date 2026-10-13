import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

type Kind = 'team' | 'player'
type Cursor = { v: number; scope: string; id: string; nome: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const teamColumns = 'id,nome,username,logo_url,tag,public_id,public_id_prefix,status,localidade,cidade,estado,pais'
const playerColumns = 'id,nome,username,avatar_url,id_jogo,funcao,status,localidade,cidade,estado,pais,bio,disponivel_recrutamento'

/** Values embedded in a PostgREST boolean filter must be quoted, not interpolated as grammar. */
export function filterLiteral(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function searchTerm(params: URLSearchParams) {
  const term = (params.get('q') || '').trim().replace(/^@/, '')
  if (term.length > 120 || /[\u0000-\u001f]/.test(term)) throw new Error('Busca inválida. Use até 120 caracteres.')
  return term
}

export function searchOptions(params: URLSearchParams, namespace: string, defaultLimit: number) {
  const term = searchTerm(params)
  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? defaultLimit : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || (rawLimit !== null && limit > 100)) throw new Error('Limite inválido. Use de 1 a 100 resultados.')
  const scope = createHash('sha256').update(JSON.stringify([namespace, term])).digest('hex')
  let cursor: Cursor | null = null
  const encoded = params.get('cursor')
  if (encoded) {
    try {
      if (encoded.length > 5000 || !/^[\w-]+$/.test(encoded)) throw new Error()
      cursor = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
      if (!cursor || cursor.v !== 1 || cursor.scope !== scope || !uuid.test(cursor.id) || (cursor.nome !== null && (typeof cursor.nome !== 'string' || cursor.nome.length > 2000))) throw new Error()
    } catch { throw new Error('A continuação da busca é inválida. Faça a busca novamente.') }
  }
  return { term, limit, scope, cursor }
}

export async function readSearchPage(query: any, options: ReturnType<typeof searchOptions>, searchFilter = '') {
  const { cursor, limit, scope } = options
  let cursorFilter = ''
  if (cursor) {
    if (cursor.nome === null) query = query.is('nome', null).gt('id', cursor.id)
    else cursorFilter = `nome.gt.${filterLiteral(cursor.nome)},and(nome.eq.${filterLiteral(cursor.nome)},id.gt.${cursor.id}),nome.is.null`
  }
  if (searchFilter && cursorFilter) query = query.or(`and(or(${searchFilter}),or(${cursorFilter}))`)
  else if (searchFilter || cursorFilter) query = query.or(searchFilter || cursorFilter)
  query = query.order('nome', { ascending: true, nullsFirst: false }).order('id', { ascending: true })
  const rows: any[] = []
  // Fetch one lookahead row. A smaller Data API cap must not end the page early.
  while (rows.length <= limit) {
    const { data, error } = await query.range(rows.length, limit)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
  }
  const items = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const last = items.at(-1)
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ v: 1, scope, id: last.id, nome: last.nome ?? null })).toString('base64url') : null
  return { items, hasMore, nextCursor }
}

export async function searchDirectory(kind: Kind, params: URLSearchParams, options: { defaultLimit?: number; namespace?: string; columns?: string; fields?: string[] } = {}) {
  const term = searchTerm(params)
  // Keep the old no-limit contract for installed mobile versions. New clients request small pages explicitly.
  const page = searchOptions(params, options.namespace || kind, options.defaultLimit ?? (term ? 200 : 1000))
  let query = supabaseAdmin.from(kind === 'team' ? 'equipes' : 'jogadores').select(options.columns || (kind === 'team' ? teamColumns : playerColumns)).eq('status', 'ativo')
  const numericMatch = term.match(kind === 'team' ? /^(?:EQ\s*)?(\d+)$/i : /^\d+$/)
  let searchFilter = ''
  if (numericMatch) {
    const numberText = kind === 'team' ? numericMatch[1] : numericMatch[0]
    const publicId = Number(numberText)
    if (kind === 'team') query = query.eq('public_id', Number.isSafeInteger(publicId) ? publicId : -1)
    else searchFilter = `id_jogo.eq.${filterLiteral(numberText)}`
  } else if (term) {
    const fields = options.fields || (kind === 'team' ? ['nome','username','tag','localidade','cidade','estado','pais'] : ['nome','username','funcao','localidade','cidade','estado','pais'])
    const pattern = `%${term.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')}%`
    searchFilter = fields.map(field => `${field}.ilike.${filterLiteral(pattern)}`).join(',')
  }
  const result = await readSearchPage(query, page, searchFilter)
  return kind === 'player' ? { ...result, items: result.items.map(item => ({ ...item, nick: item.nome, foto_url: item.avatar_url || null })) } : result
}
