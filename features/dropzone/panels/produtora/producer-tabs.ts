export type ProducerTab = 'equipes' | 'jogadores' | 'grupos' | 'jogos' | 'links'

export const producerTabs: Array<{ id: ProducerTab; label: string }> = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'jogadores', label: 'Jogadores' },
  { id: 'grupos', label: 'Fases e grupos' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'links', label: 'Links' },
]
