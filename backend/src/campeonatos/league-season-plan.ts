import type { LigaPlan } from './liga-plan'
export type LeagueSeasonCandidate = { equipe_id: string; line_id: string; nome: string; tag: string | null;
  logo_url: string | null; colocacao: number; grupo_origem_nome: string }
export type LeagueSeasonSuggestion = { divisao_id: string; divisao_nome: string; tipo: 'mantida'|'promovida'|'rebaixada';
  origem_divisao_id: string; origem_divisao_nome: string; quantidade_planejada: number; candidatos: LeagueSeasonCandidate[] }
export const seasonName = (value: unknown) => String(value || '').trim().toLocaleLowerCase('pt-BR')
export function seasonQuantity(value: unknown): number {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  const result = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(result)) throw new Error('O plano da temporada possui uma quantidade inválida.')
  return result
}
export function validateSeasonPlan(plan: LigaPlan) {
  if (!plan || !Array.isArray(plan.divisoes) || !plan.divisoes.length || plan.divisoes.length > 100) throw new Error('Plano da temporada indisponível.')
  const ids = new Set<string>(), names = new Set<string>()
  for (const division of plan.divisoes) {
    if (!division || !division.id || !seasonName(division.nome) || ids.has(division.id) || names.has(seasonName(division.nome))
      || !Array.isArray(division.entradas) || division.entradas.length > 100) throw new Error('O plano da temporada possui agrupamentos ambíguos.')
    ids.add(division.id); names.add(seasonName(division.nome)); seasonQuantity(division.equipes)
    let total = 0
    for (const entry of division.entradas) {
      if (!entry || !['mantida','promovida','rebaixada','classificatoria_aberta','vaga_paga','convite_direto'].includes(entry.tipo)) throw new Error('O plano da temporada possui uma origem inválida.')
      total += seasonQuantity(entry.quantidade)
      if (!Number.isSafeInteger(total)) throw new Error('O plano da temporada possui uma quantidade inválida.')
    }
  }
}
/** Selection matches the existing movement order; counts and ambiguous identities fail closed. */
export function buildLeagueSeasonSuggestions(current: LigaPlan, previous: LigaPlan, rankings: Map<string, any[]>): LeagueSeasonSuggestion[] {
  validateSeasonPlan(current); validateSeasonPlan(previous)
  const promoted = new Map<string, number>(), relegated = new Map<string, number>()
  for (const destination of current.divisoes) for (const entry of destination.entradas) {
    if (entry.tipo !== 'promovida' && entry.tipo !== 'rebaixada') continue
    const quantity = seasonQuantity(entry.quantidade)
    if (!quantity) continue
    if (!previous.divisoes.some(row => row.id === entry.origem_agrupamento_id)) throw new Error('A origem da temporada anterior não foi encontrada.')
    const totals = entry.tipo === 'promovida' ? promoted : relegated
    const sum = (totals.get(entry.origem_agrupamento_id) || 0) + quantity
    if (!Number.isSafeInteger(sum)) throw new Error('A quantidade da temporada excede o limite.')
    totals.set(entry.origem_agrupamento_id, sum)
  }
  const promotedOffsets = new Map<string, number>(), relegatedOffsets = new Map<string, number>(), suggestions: LeagueSeasonSuggestion[] = []
  const teams = new Set<string>(), lines = new Set<string>()
  for (const destination of current.divisoes) for (const entry of destination.entradas) {
    if (!['mantida','promovida','rebaixada'].includes(entry.tipo)) continue
    const quantity = seasonQuantity(entry.quantidade)
    if (!quantity) continue
    const sourceId = entry.tipo === 'mantida' ? destination.id : entry.origem_agrupamento_id
    const source = previous.divisoes.find(row => row.id === sourceId)
    if (!source || !rankings.has(sourceId)) throw new Error('A classificação da origem da temporada anterior não foi encontrada.')
    const ranking = rankings.get(sourceId)!, ceiling = Math.max(0, ranking.length - (relegated.get(sourceId) || 0)), floor = promoted.get(sourceId) || 0
    let selected: any[]
    if (entry.tipo === 'promovida') {
      const offset = promotedOffsets.get(sourceId) || 0; selected = ranking.slice(offset, Math.min(offset + quantity, ceiling)); promotedOffsets.set(sourceId, offset + quantity)
    } else if (entry.tipo === 'rebaixada') {
      const end = Math.max(floor, ranking.length - (relegatedOffsets.get(sourceId) || 0)); selected = ranking.slice(Math.max(floor, end - quantity), end); relegatedOffsets.set(sourceId, (relegatedOffsets.get(sourceId) || 0) + quantity)
    } else selected = ranking.slice(floor, Math.max(floor, ceiling)).slice(0, quantity)
    const candidates = selected.map(row => {
      if (!row?.equipe_id || !row.line_id || !Number.isSafeInteger(row.colocacao) || row.colocacao < 1 || teams.has(row.equipe_id) || lines.has(row.line_id)) throw new Error('Uma equipe ou line aparece em mais de uma sugestão. Revise a classificação e as cotas.')
      teams.add(row.equipe_id); lines.add(row.line_id)
      return { equipe_id: String(row.equipe_id), line_id: String(row.line_id), nome: String(row.nome || 'Equipe'), tag: row.tag || null,
        logo_url: row.logo_url || null, colocacao: row.colocacao, grupo_origem_nome: source.nome }
    })
    suggestions.push({ divisao_id: destination.id, divisao_nome: destination.nome, tipo: entry.tipo as LeagueSeasonSuggestion['tipo'],
      origem_divisao_id: sourceId, origem_divisao_nome: source.nome, quantidade_planejada: quantity, candidatos: candidates })
  }
  if (teams.size > 1000) throw new Error('A temporada excede o limite de sugestões.')
  return suggestions
}
