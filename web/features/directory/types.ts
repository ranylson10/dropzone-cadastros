export type DirectoryKind = 'campeonatos' | 'equipes' | 'jogadores' | 'managers' | 'produtoras'

export type DirectoryItem = {
  id: string
  kind: DirectoryKind
  name: string
  username?: string
  image?: string
  banner?: string
  eyebrow?: string
  description?: string
  commercial?: {
    valor_inscricao?: number | null
    premiacao?: number | null
    tem_live?: boolean
    vagas_livres?: number | null
    total_vagas?: number | null
    plataforma?: string | null
    servidor?: string | null
  }
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
  stats?: Record<string, string | number | null>
}

export type ChampionshipTheme = {
  cor_principal?: string | null
  cor_secundaria?: string | null
  bg_opacidade?: number | null
  bg_image_url?: string | null
  cor_texto_clara?: string | null
  cor_texto_escura?: string | null
}

/** Dados de inscrição/venda de vaga (página pública do campeonato). */
export type ChampionshipEnrollment = {
  aceita_novas_inscricoes: boolean
  valor_inscricao: number | null
  contatos_whatsapp: Array<{
    id?: string
    nome?: string
    pais?: string
    bandeira?: string
    ddi?: string
    telefone?: string
    url?: string | null
    manager_id?: string
  }>
  vagas_livres?: number
  proximo_grupo?: string | null
}

export type DirectoryProfile = DirectoryItem & {
  details: Array<{ label: string; value: string }>
  actions?: Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>
  /** Tema visual (campeonato) */
  theme?: ChampionshipTheme | null
  /** Bio completa (quando description é resumo) */
  bio?: string | null
  /** Inscrição / compra de vaga (somente campeonatos com vagas abertas) */
  enrollment?: ChampionshipEnrollment | null
  statsFilters?: {
    phases: Array<{ id: string; label: string }>
    groups: Array<{ id: string; label: string; phaseId?: string | null }>
    games: Array<{ id: string; label: string }>
    rounds: Array<{ id: string; label: string; gameId?: string | null; mapCode?: string | null }>
    maps: Array<{ id: string; label: string }>
  }
  sections: Array<{
    title: string
    layout?: 'list' | 'table' | 'stats' | 'structure'
    items: DirectorySectionItem[]
  }>
}
