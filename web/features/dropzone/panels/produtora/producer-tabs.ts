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
  | 'pontuador'
  | 'avancado'
  | 'financeiro'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Elencos' },
  { id: 'links', label: 'Inscrições' },
  { id: 'grupos', label: 'Fases e grupos' },
  { id: 'jogos', label: 'Jogos e quedas' },
  { id: 'regulamento', label: 'Regras' },
  { id: 'calls', label: 'Calls' },
  { id: 'estatisticas', label: 'Tabelas' },
  { id: 'pontuador', label: 'Pontuador' },
  { id: 'avancado', label: 'Regras avançadas' },
  { id: 'financeiro', label: 'Resumo financeiro' },
  { id: 'vendedores', label: 'Vendas' },
]
