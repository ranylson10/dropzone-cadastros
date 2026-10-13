import { ChampionshipCard } from '@/types/dropzone'

export type VacancyApiItem = {
  id?: string
  nome?: string
  tipo?: string
  banner_url?: string | null
  logo_url?: string | null
  valor_inscricao?: number | string | null
  premiacao?: number | string | null
  descricao_premiacao?: string | null
  tem_live?: boolean
  plataforma?: string | null
  servidor?: string | null
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
  proximo_grupo?: string | null
}

export const fallbackVacancies: VacancyApiItem[] = [
  { id: 'rw', nome: 'RW KINGS III 2K26', tipo: 'copa', valor_inscricao: 30, premiacao: 1000, vagas_livres: 96, total_vagas: 96, tem_live: true },
  { id: 'centavos', nome: 'COPA CENTAVOS', tipo: 'copa', valor_inscricao: 1, premiacao: 1000, vagas_livres: 95, total_vagas: 96, tem_live: false },
]

const amount = (value?: number | string | null) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export const money = (value?: number | string | null) => {
  const numeric = amount(value)
  if (numeric == null) return 'Sob consulta'
  if (numeric === 0) return 'Grátis'
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const prizeLabel = (item: VacancyApiItem) => {
  if (item.descricao_premiacao?.trim()) return item.descricao_premiacao.trim()
  const numeric = amount(item.premiacao)
  return numeric == null || numeric === 0 ? 'Sem premiação informada' : money(numeric)
}

export const dateLabel = (item: VacancyApiItem) => {
  if (!item.proxima_data) return 'Data a confirmar'
  const today = new Date().toISOString().slice(0, 10)
  const day = item.proxima_data === today ? 'Hoje' : item.proxima_data.split('-').reverse().join('/')
  return `${day}${item.proximo_horario ? ` ${item.proximo_horario}` : ''}${item.proximo_grupo ? ` · ${item.proximo_grupo}` : ''}`
}

export const toChampionshipCard = (item: VacancyApiItem): ChampionshipCard => ({
  id: String(item.id || item.nome || 'campeonato'),
  name: item.nome || 'Campeonato',
  mode: item.tipo || 'competitivo',
  logoUrl: item.logo_url || null,
  bannerUrl: item.banner_url || null,
  priceLabel: money(item.valor_inscricao),
  prizeLabel: prizeLabel(item),
  freeSlots: Number(item.vagas_livres || 0),
  nextMatchLabel: dateLabel(item),
  hasLive: Boolean(item.tem_live),
})

