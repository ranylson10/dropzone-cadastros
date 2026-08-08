export type LineupSummary = {
  campeonato_equipe_id?: string
  campeonato_nome?: string
  equipe_nome?: string
  line_nome?: string
  fase_nome?: string
  grupo_nome?: string
  data_jogo?: string | null
  horario?: string | null
  jogadores_confirmados?: number
  limite_jogadores?: number
  vagas_disponiveis?: number
  link_token?: string | null
  link_ativo?: boolean
  link_expira_em?: string | null
  jogadores?: unknown[]
}

export const fallbackLineups: LineupSummary[] = [
  {
    campeonato_equipe_id: 'demo-rw',
    campeonato_nome: 'RW KINGS III 2K26',
    equipe_nome: 'Minha equipe',
    line_nome: 'Line principal',
    fase_nome: 'Fase 1',
    grupo_nome: 'Grupo B',
    data_jogo: null,
    horario: null,
    jogadores_confirmados: 3,
    limite_jogadores: 5,
    vagas_disponiveis: 2,
    link_token: null,
    link_ativo: false,
    jogadores: [],
  },
]

export const lineupDateLabel = (lineup: LineupSummary) => {
  if (!lineup.data_jogo) return 'Data a confirmar'
  const date = lineup.data_jogo.split('-').reverse().join('/')
  return `${date}${lineup.horario ? ` · ${String(lineup.horario).slice(0, 5)}` : ''}`
}

export const lineupSubtitle = (lineup: LineupSummary) =>
  [lineup.line_nome, lineup.fase_nome, lineup.grupo_nome].filter(Boolean).join(' · ') || 'Line ainda não definida'

