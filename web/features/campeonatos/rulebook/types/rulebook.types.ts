export type RulebookPerfil =
  | 'comunitario'
  | 'semiprofissional'
  | 'profissional'
  | 'personalizado'

export type AnswerValue = boolean | string | number | string[] | null

export interface RulebookQuestion {
  id: string
  etapa: 1 | 2 | 3
  module?: string
  chapter: string
  label: string
  help?: string
  type: 'boolean' | 'single' | 'multi' | 'number' | 'text' | 'long_text' | 'select'
  options?: Array<{ value: string; label: string }>
  required?: boolean
  min?: number
  max?: number
  placeholder?: string
  unit?: string
}

export interface RulebookAlert {
  id: string
  severity: 'blocking' | 'warning'
  code: string
  message: string
  field?: string
}

export interface InfracaoConfig {
  codigo: string
  enabled: boolean
  titulo: string
  definicao: string
  condicoes: string
  provas_aceitas: string
  competencia: string
  penalidade_inicial: string
  penalidade_reincidencia: string
  direito_defesa: boolean
  direito_recurso: boolean
  prazo: string
  observacoes: string
  gravidade: 'leve' | 'media' | 'grave' | 'gravissima'
}

export interface GeneratedArticle {
  id: string
  number: string
  title: string
  body: string
  observations?: string
  penalty?: string
  notes?: string
  chapterId: string
}

export interface GeneratedChapter {
  id: string
  order: number
  title: string
  articles: GeneratedArticle[]
  included: boolean
}

export interface GeneratedDocument {
  title: string
  subtitle: string
  campeonatoNome: string
  /** Logo do campeonato (URL pública) — prévia e PDF */
  logoUrl?: string | null
  perfil: RulebookPerfil
  generatedAt: string
  catalogVersion: string
  chapters: GeneratedChapter[]
  summary: Array<{ chapterId: string; title: string; order: number }>
  articleCount: number
}

export interface RulebookRow {
  id: string
  campeonato_id: string
  perfil: RulebookPerfil
  etapa_atual: number
  respostas: Record<string, AnswerValue>
  modules_ativos: string[]
  infracoes: InfracaoConfig[]
  alertas: RulebookAlert[]
  confirmacoes_alertas: Record<string, boolean>
  documento: GeneratedDocument | Record<string, unknown>
  status: string
  catalog_version: string
  versao: number
  publicado_em: string | null
}

export interface RulebookApiResponse {
  ok?: boolean
  rulebook: RulebookRow
  engine: {
    canPublish: boolean
    modules: string[]
    alerts: RulebookAlert[]
    progress?: {
      answeredRequired: number
      totalRequired: number
      percent: number
    }
  }
  questions: {
    catalogVersion: string
    etapa1: RulebookQuestion[]
    etapa2: RulebookQuestion[]
    etapa3: RulebookQuestion[]
    allVisible: RulebookQuestion[]
  }
  catalog: {
    version: string
    perfis: Array<{ id: RulebookPerfil; label: string; description: string }>
    chapterGroups?: Record<string, string>
  }
  meta?: {
    seedAplicado?: boolean
    seedCampos?: string[]
    linkedFromCampeonato?: boolean
    linkedFields?: string[]
  }
  error?: string
}
