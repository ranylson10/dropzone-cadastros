export type AgendaItem = {
  id?: string
  source?: 'jogo' | 'livre' | string
  titulo?: string
  title?: string
  nome?: string
  descricao?: string | null
  data?: string
  date?: string
  data_jogo?: string
  horario?: string | null
  horario_inicio?: string | null
  horario_fim?: string | null
  cor?: string | null
  tipo?: string | null
  visibilidade?: string | null
  editable?: boolean
  campeonato_nome?: string | null
  grupo_nome?: string | null
  equipe_nome?: string | null
  status?: string | null
  meta?: {
    campeonato_id?: string | null
    campeonato_nome?: string | null
    equipe_id?: string | null
    equipe_nome?: string | null
    jogo_id?: string | null
    status?: string | null
    numero_partidas?: number | null
    href?: string | null
  }
}

export const fallbackAgenda: AgendaItem[] = []

export const agendaTitle = (item: AgendaItem) =>
  item.titulo || item.title || item.nome || item.meta?.campeonato_nome || item.campeonato_nome || 'Compromisso'

export const agendaDateLabel = (item: AgendaItem) => {
  const raw = item.data || item.data_jogo || item.date
  if (!raw) return 'Data a confirmar'
  const day = String(raw).slice(0, 10).split('-').reverse().join('/')
  const start = item.horario_inicio || item.horario
  const end = item.horario_fim
  return `${day}${start ? ` · ${String(start).slice(0, 5)}` : ''}${end ? `–${String(end).slice(0, 5)}` : ''}`
}

export const agendaDescription = (item: AgendaItem) =>
  [
    item.descricao,
    item.meta?.campeonato_nome || item.campeonato_nome,
    item.meta?.equipe_nome || item.equipe_nome,
    item.grupo_nome,
    item.meta?.status || item.status,
  ].filter(Boolean).join(' · ') || String(item.tipo || item.source || 'Evento')

export const agendaContextIds = (item:AgendaItem) => ({
  campeonatoId: item.meta?.campeonato_id || null,
  equipeId: item.meta?.equipe_id || null,
  jogoId: item.meta?.jogo_id || null,
})
