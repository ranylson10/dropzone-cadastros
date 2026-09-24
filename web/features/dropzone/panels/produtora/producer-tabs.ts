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
  | 'operacao'
  | 'resultados'
  | 'financeiro'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'links', label: 'Inscrições' },
  { id: 'grupos', label: 'Estrutura' },
  { id: 'jogos', label: 'Jogos e quedas' },
  { id: 'regulamento', label: 'Regras' },
  { id: 'calls', label: 'Calls' },
  { id: 'estatisticas', label: 'Classificação' },
  { id: 'financeiro', label: 'Resumo financeiro' },
  { id: 'vendedores', label: 'Vendas' },
]

export const producerWorkspaceTabs: Array<{
  id: ProducerWorkspace
  label: string
  defaultTab: ProducerTab
  tabs: ProducerTab[]
}> = [
  { id: 'visao', label: 'Visão geral', defaultTab: 'visao', tabs: ['visao'] },
  { id: 'participantes', label: 'Participantes', defaultTab: 'equipes', tabs: ['equipes', 'jogadores', 'links'] },
  { id: 'operacao', label: 'Operação', defaultTab: 'grupos', tabs: ['grupos', 'jogos', 'regulamento', 'calls'] },
  { id: 'resultados', label: 'Resultados', defaultTab: 'estatisticas', tabs: ['estatisticas'] },
  { id: 'financeiro', label: 'Financeiro', defaultTab: 'financeiro', tabs: ['financeiro', 'vendedores'] },
]

export function producerWorkspaceForTab(tab: ProducerTab): ProducerWorkspace {
  return producerWorkspaceTabs.find((item) => item.tabs.includes(tab))?.id || 'visao'
}
