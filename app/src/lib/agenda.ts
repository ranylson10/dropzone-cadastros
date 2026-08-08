export type AgendaItem = {
  id?: string
  title?: string
  titulo?: string
  nome?: string
  date?: string
  data?: string
  data_jogo?: string
  horario?: string | null
  source?: string
  campeonato_nome?: string | null
  grupo_nome?: string | null
  equipe_nome?: string | null
  status?: string | null
}

export const fallbackAgenda: AgendaItem[] = [
  {
    id: 'demo-agenda',
    title: 'Próximo jogo',
    data_jogo: undefined,
    horario: null,
    campeonato_nome: 'RW KINGS III 2K26',
    grupo_nome: 'Grupo B',
    source: 'jogo',
  },
]

export const agendaTitle = (item: AgendaItem) =>
  item.title || item.titulo || item.nome || item.campeonato_nome || 'Compromisso'

export const agendaDateLabel = (item: AgendaItem) => {
  const raw = item.data_jogo || item.data || item.date
  if (!raw) return 'Data a confirmar'
  const day = String(raw).slice(0, 10).split('-').reverse().join('/')
  return `${day}${item.horario ? ` · ${String(item.horario).slice(0, 5)}` : ''}`
}

export const agendaDescription = (item: AgendaItem) =>
  [item.campeonato_nome, item.equipe_nome, item.grupo_nome, item.status].filter(Boolean).join(' · ') || String(item.source || 'Evento')
