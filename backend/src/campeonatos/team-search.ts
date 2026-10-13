import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { readRowsByIds } from '@backend/shared/paginated-query'
import { searchDirectory, searchOptions, searchTerm } from '@backend/directory/search-page'

/** The route must validate championship write access before invoking this service. */
export async function searchChampionshipTeams(championshipId: string, params: URLSearchParams) {
  const term = searchTerm(params)
  const namespace = `championship-teams:${championshipId}`
  const lineMatch = term.match(/^LN\s*(\d+)$/i)
  let teams: any[], lines: any[]
  let hasMore = false
  let nextCursor: string | null = null
  const columns = 'id,nome,tag,logo_url,public_id,public_id_prefix'
  if (lineMatch) {
    const options = searchOptions(params, namespace, 30)
    if (options.cursor) throw new Error('Busque o ID da line novamente.')
    const publicId = Number(lineMatch[1])
    const { data, error } = await supabaseAdmin.from('equipe_lines').select('id,equipe_id,nome,tag,logo_url,public_id,public_id_prefix').eq('public_id', Number.isSafeInteger(publicId) ? publicId : -1).eq('status', 'ativo').limit(1)
    if (error) throw error
    lines = data || []
    teams = await readRowsByIds<any>(lines.map(line => line.equipe_id), ids => supabaseAdmin.from('equipes').select(columns).in('id', ids).eq('status', 'ativo').order('id'))
  } else {
    const page = await searchDirectory('team', params, { defaultLimit: term ? 15 : 30, namespace, columns, fields: ['nome','tag'] })
    teams = page.items
    hasMore = page.hasMore
    nextCursor = page.nextCursor
    lines = await readRowsByIds<any>(teams.map(team => team.id), ids => supabaseAdmin.from('equipe_lines').select('id,equipe_id,nome,tag,logo_url,public_id,public_id_prefix').in('equipe_id', ids).eq('status', 'ativo').order('nome').order('id'))
  }
  if (!teams.length) return { equipes: [], hasMore, nextCursor }
  const participations = await readRowsByIds<any>(lines.map(line => line.id), ids => supabaseAdmin.from('campeonato_equipes').select('id,line_id,slot_id,slot_numero').eq('campeonato_id', championshipId).eq('status', 'ativo').in('line_id', ids).order('id'))
  const slots = await readRowsByIds<any>(participations.map(item => item.slot_id), ids => supabaseAdmin.from('campeonato_slots').select('id,slot_numero,slot_letra').eq('campeonato_id', championshipId).in('id', ids).order('id'))
  const slotMap = new Map(slots.map(slot => [slot.id, slot]))
  const participationMap = new Map(participations.map(item => [item.line_id, item]))
  const linesByTeam = new Map<string, any[]>()
  for (const line of lines) {
    const list = linesByTeam.get(line.equipe_id) || []
    list.push(line)
    linesByTeam.set(line.equipe_id, list)
  }
  return {
    hasMore, nextCursor,
    equipes: teams.map(team => {
      const teamLines = linesByTeam.get(team.id) || []
      return {
        ...team,
        lines: teamLines.map(line => {
          const participation = participationMap.get(line.id)
          const slot = participation?.slot_id ? slotMap.get(participation.slot_id) : null
          return {
            ...line, logo_url: line.logo_url || team.logo_url || null, tag: line.tag || team.tag || null,
            ja_inscrita: Boolean(participation), vaga_numero: slot?.slot_numero ?? participation?.slot_numero ?? null,
            slot_letra: slot?.slot_letra || null, participacao_id: participation?.id || null,
          }
        }),
        lines_livres: teamLines.filter(line => !participationMap.has(line.id)).length,
      }
    }),
  }
}
