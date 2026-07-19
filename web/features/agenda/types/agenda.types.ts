export type AgendaScope = 'me' | 'campeonato' | 'equipe'

export type AgendaItemSource = 'jogo' | 'livre'

export type AgendaItem = {
  id: string
  source: AgendaItemSource
  titulo: string
  descricao?: string | null
  data: string
  horario_inicio: string
  horario_fim: string | null
  cor: string
  tipo: string
  visibilidade?: string
  editable: boolean
  meta: {
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

export type AgendaEventForm = {
  id?: string
  titulo: string
  descricao: string
  data_evento: string
  horario_inicio: string
  horario_fim: string
  cor: string
  tipo: string
  visibilidade: string
  campeonato_id: string
  equipe_id: string
}

export type AgendaCalendarProps = {
  title?: string
  scope: AgendaScope
  scopeId?: string | null
  /** Permite criar/editar agenda livre */
  canCreate?: boolean
  /** Compacto (embutido em abas de perfil) */
  compact?: boolean
  /** Ano/mês iniciais */
  initialYear?: number
  initialMonth?: number
  className?: string
}

export const AGENDA_TIME_SLOTS = ['13:00', '15:00', '16:00', '18:00', '19:00', '20:00', '21:00', '22:00'] as const

export const AGENDA_COLORS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#16a34a', label: 'Verde' },
  { value: '#f59e0b', label: 'Laranja' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#0ea5e9', label: 'Ciano' },
  { value: '#a855f7', label: 'Violeta' },
] as const

export const AGENDA_TIPOS = [
  { value: 'livre', label: 'Livre' },
  { value: 'treino', label: 'Treino' },
  { value: 'scrim', label: 'Scrim' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'outro', label: 'Outro' },
] as const

export const MONTH_NAMES_PT = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const

export const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Quar', 'Quin', 'Sex', 'Sáb'] as const
