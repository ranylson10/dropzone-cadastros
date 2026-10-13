/** Shared read-only plan contract. This module must not import server code. */
export type LigaEntradaTipo = 'mantida' | 'promovida' | 'rebaixada' | 'classificatoria_aberta' | 'vaga_paga' | 'convite_direto'
export type LigaEntradaPlano = { id: string; tipo: LigaEntradaTipo; quantidade: string; origem_agrupamento_id: string }
export type LigaDivisaoOperacional = { id: string; nome: string; codigo: string; equipes: string; entradas: LigaEntradaPlano[] }
export type LigaPlan = { nome_agrupamento: string; divisoes: LigaDivisaoOperacional[] }
export const ligaOriginLabels: Record<LigaEntradaTipo, string> = {
  mantida: 'Mantida', promovida: 'Promovida', rebaixada: 'Rebaixada',
  classificatoria_aberta: 'Classificatória aberta', vaga_paga: 'Vaga paga', convite_direto: 'Convite direto',
}
type Occupancy = { grupo_id?: string | null; equipe_id?: string | null; line_id?: string | null; origem_entrada?: string | null }
export type LigaOriginChoice = { tipo: LigaEntradaTipo; label: string; quota: number; used: number; remaining: number }
export function ligaOriginChoices(plan: LigaPlan, groupName: string, groupId: string, slots: Occupancy[], pending: Occupancy[] = []): LigaOriginChoice[] {
  const name = groupName.trim().toLocaleLowerCase('pt-BR')
  const divisions = Array.isArray(plan.divisoes) ? plan.divisoes.filter(d => String(d?.nome || '').trim().toLocaleLowerCase('pt-BR') === name) : []
  if (!name || !groupId || divisions.length !== 1) throw new Error('Este grupo não corresponde a um agrupamento único do plano da Liga.')
  const entries = divisions[0].entradas
  if (!Array.isArray(entries) || !entries.length) throw new Error('Este agrupamento não possui origens planejadas. Revise o plano da Liga.')
  const quotas = new Map<LigaEntradaTipo, number>()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.tipo !== 'string'
      || (typeof entry.quantidade !== 'string' && typeof entry.quantidade !== 'number')) throw new Error('O plano da Liga possui uma origem ou quantidade inválida. Revise o plano antes de adicionar equipes.')
    const type = entry?.tipo
    const raw = String(entry?.quantidade ?? '').trim()
    const quota = Number(raw)
    if (!Object.hasOwn(ligaOriginLabels, type) || !/^\d+$/.test(raw) || !Number.isSafeInteger(quota)) throw new Error('O plano da Liga possui uma origem ou quantidade inválida. Revise o plano antes de adicionar equipes.')
    const total = (quotas.get(type) || 0) + quota
    if (!Number.isSafeInteger(total)) throw new Error('A quantidade planejada da Liga é inválida.')
    quotas.set(type, total)
  }
  return [...quotas].map(([tipo, quota]) => {
    const used = slots.filter(s => s.grupo_id === groupId && (s.equipe_id || s.line_id) && s.origem_entrada === `liga_${tipo}`).length
      + pending.filter(s => s.grupo_id === groupId && s.origem_entrada === tipo).length
    return { tipo, label: ligaOriginLabels[tipo], quota, used, remaining: Math.max(0, quota - used) }
  })
}
/** Client preflight only: the server remains responsible for concurrent quota enforcement. */
export function validateLigaOrigin(plan: LigaPlan | null, groupName: string, groupId: string, origin: string, slots: Occupancy[], pending: Occupancy[] = []): string | undefined {
  if (!plan) return undefined
  const options = ligaOriginChoices(plan, groupName, groupId, slots, pending)
  const selected = options.find(o => o.tipo === origin)
  if (!selected) throw new Error('Escolha a origem da equipe neste agrupamento da Liga.')
  if (!selected.remaining) throw new Error(`A cota de ${selected.label} já foi preenchida (${selected.used}/${selected.quota}).`)
  return selected.tipo
}
