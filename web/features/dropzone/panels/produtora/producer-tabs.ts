export type ProducerTab =
  | 'equipes'
  | 'jogadores'
  | 'grupos'
  | 'jogos'
  | 'vendedores'
  | 'links'
  | 'regulamento'
  | 'estatisticas'
  | 'stream'
  | 'exportar'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'grupos', label: 'Fases e grupos' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'links', label: 'Links' },
  { id: 'regulamento', label: 'Regulamento' },
  { id: 'estatisticas', label: 'Estatísticas' },
  { id: 'stream', label: 'Stream' },
  { id: 'exportar', label: 'Exportar' },
]
