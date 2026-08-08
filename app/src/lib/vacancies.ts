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

export const money = (value?: number | string | null) => {
  const numeric = Number(value || 0)
  if (!numeric) return 'Grátis'
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  prizeLabel: item.descricao_premiacao || money(item.premiacao),
  freeSlots: Number(item.vagas_livres || 0),
  nextMatchLabel: dateLabel(item),
  hasLive: Boolean(item.tem_live),
})

