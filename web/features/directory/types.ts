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
  sections: Array<{
    title: string
    items: Array<{ id: string; title: string; subtitle?: string; href?: string; image?: string }>
  }>
}
