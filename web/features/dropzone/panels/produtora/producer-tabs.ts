export type ProducerTab =
  | 'equipes'
  | 'jogadores'
  | 'estrutura'
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
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'links', label: 'Links' },
  { id: 'regulamento', label: 'Regulamento' },
  { id: 'estatisticas', label: 'Estatísticas' },
  { id: 'stream', label: 'Transmissão' },
  { id: 'exportar', label: 'Exportação' },
]
