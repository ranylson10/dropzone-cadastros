export type ProducerTab =
  | 'visao'
  | 'equipes'
  | 'jogadores'
  | 'grupos'
  | 'jogos'
  | 'calls'
  | 'vendedores'
  | 'links'
  | 'regulamento'
  | 'estatisticas'
  | 'financeiro'
  | 'stream'
  | 'exportar'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'grupos', label: 'Grupos e fases' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'calls', label: 'Calls' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'links', label: 'Links' },
  { id: 'regulamento', label: 'Regulamento' },
  { id: 'estatisticas', label: 'Pontuação' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'stream', label: 'Transmissão' },
  { id: 'exportar', label: 'Exportação' },
]
