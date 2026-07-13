export type DirectoryKind = 'campeonatos' | 'equipes' | 'jogadores' | 'managers' | 'produtoras'

export type DirectoryItem = {
  id: string
  kind: DirectoryKind
  name: string
  username?: string
  image?: string
  eyebrow?: string
  description?: string
  meta: Array<{ label: string; value: string }>
  searchText: string
}

export type DirectoryProfile = DirectoryItem & {
  details: Array<{ label: string; value: string }>
  actions?: Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>
  sections: Array<{
    title: string
    layout?: 'list' | 'table' | 'stats'
    items: Array<{
      id: string
      title: string
      subtitle?: string
      href?: string
      image?: string
      meta?: Array<{ label: string; value: string }>
    }>
  }>
}
