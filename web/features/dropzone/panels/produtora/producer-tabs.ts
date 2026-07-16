export type ProducerTab =
  | 'equipes'
  | 'jogadores'
  | 'grupos'
  | 'jogos'
  | 'vendedores'
  | 'links'
  | 'estatisticas'
  | 'exportar'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'grupos', label: 'Fases e grupos' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'links', label: 'Links' },
  { id: 'estatisticas', label: 'Estatísticas' },
  { id: 'exportar', label: 'Exportar' },
]
