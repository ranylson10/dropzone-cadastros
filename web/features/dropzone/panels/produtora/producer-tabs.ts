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

export type ProducerWorkspace =
  | 'visao'
  | 'participantes'
  | 'estrutura'
  | 'jogos'
  | 'resultados'
  | 'mais'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'links', label: 'Inscrições e links' },
  { id: 'grupos', label: 'Grupos e slots' },
  { id: 'regulamento', label: 'Regulamento' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'calls', label: 'Calls' },
  { id: 'estatisticas', label: 'Resultados' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'vendedores', label: 'Vendedores' },
]

export const producerWorkspaceTabs: Array<{
  id: ProducerWorkspace
  label: string
  defaultTab: ProducerTab
  tabs: ProducerTab[]
}> = [
  { id: 'visao', label: 'Início', defaultTab: 'visao', tabs: ['visao'] },
  { id: 'participantes', label: 'Participantes', defaultTab: 'equipes', tabs: ['equipes', 'jogadores', 'links'] },
  { id: 'estrutura', label: 'Estrutura', defaultTab: 'grupos', tabs: ['grupos', 'regulamento'] },
  { id: 'jogos', label: 'Jogos', defaultTab: 'jogos', tabs: ['jogos', 'calls'] },
  { id: 'resultados', label: 'Resultados', defaultTab: 'estatisticas', tabs: ['estatisticas'] },
  { id: 'mais', label: 'Mais', defaultTab: 'financeiro', tabs: ['financeiro', 'vendedores'] },
]

export function producerWorkspaceForTab(tab: ProducerTab): ProducerWorkspace {
  return producerWorkspaceTabs.find((item) => item.tabs.includes(tab))?.id || 'visao'
}
