export type ProducerTab =
  | 'equipes'
  | 'jogadores'
  | 'grupos'
  | 'jogos'
  | 'calls'
  | 'vendedores'
  | 'links'
  | 'regulamento'
  | 'estatisticas'
  | 'stream'
  | 'exportar'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'grupos', label: 'Grupos e fases' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'calls', label: 'Calls' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'links', label: 'Links' },
  { id: 'regulamento', label: 'Regulamento' },
  { id: 'estatisticas', label: 'Estatísticas' },
  { id: 'stream', label: 'Transmissão' },
  { id: 'exportar', label: 'Exportação' },
]
