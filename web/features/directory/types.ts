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

/** Item de seção do perfil (suporta árvore: fase → grupo → slot). */
export type DirectorySectionItem = {
  id: string
  title: string
  subtitle?: string
  href?: string
  image?: string
  meta?: Array<{ label: string; value: string }>
  /** Badge à esquerda (ex.: letra do slot) */
  badge?: string
  /** Estado visual do slot: livre | ocupada | reservada */
  status?: 'livre' | 'ocupada' | 'reservada' | string
  children?: DirectorySectionItem[]
}

export type ChampionshipTheme = {
  cor_principal?: string | null
  cor_secundaria?: string | null
  bg_opacidade?: number | null
  bg_image_url?: string | null
  cor_texto_clara?: string | null
  cor_texto_escura?: string | null
}

export type DirectoryProfile = DirectoryItem & {
  details: Array<{ label: string; value: string }>
  actions?: Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>
  /** Tema visual (campeonato) */
  theme?: ChampionshipTheme | null
  /** Bio completa (quando description é resumo) */
  bio?: string | null
  sections: Array<{
    title: string
    layout?: 'list' | 'table' | 'stats' | 'structure'
    items: DirectorySectionItem[]
  }>
}
