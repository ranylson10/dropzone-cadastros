/** Tipos do Rulebook Builder Inteligente */

export type RulebookPerfil =
  | 'comunitario'
  | 'semiprofissional'
  | 'profissional'
  | 'personalizado'

export type RulebookStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'publicado'
  | 'bloqueado_alertas'

export type RulebookEtapa = 0 | 1 | 2 | 3 | 4

export type QuestionType =
  | 'boolean'
  | 'single'
  | 'multi'
  | 'number'
  | 'text'
  | 'long_text'
  | 'select'

export type AnswerValue = boolean | string | number | string[] | null

export type AnswersMap = Record<string, AnswerValue>

export type RulebookChapterId =
  | 'disposicoes_gerais'
  | 'organizacao'
  | 'participacao'
  | 'elegibilidade'
  | 'equipes'
  | 'jogadores'
  | 'manager'
  | 'coach'
  | 'cadastro'
  | 'check_in'
  | 'partidas'
  | 'pontuacao'
  | 'desconexoes'
  | 'remakes'
  | 'infracoes'
  | 'penalidades'
  | 'recursos'
  | 'premiacao'
  | 'direitos_imagem'
  | 'disposicoes_finais'

export type RulebookModuleId =
  | 'online'
  | 'presencial'
  | 'hibrido'
  | 'transmissao'
  | 'premiacao'
  | 'manager'
  | 'coach'
  | 'reservas'
  | 'taxa_inscricao'
  | 'classificatoria'
  | 'eliminatoria'
  | 'final_presencial'
  | 'idade'
  | 'check_in'
  | 'desconexoes'
  | 'remakes'
  | 'lobby'
  | 'discord'
  | 'ping'
  | 'delay_transmissao'
  | 'reembolso'
  | 'emulador_proibido'
  | 'ghosting'
  | 'hack'
  | 'bug_abuse'
  | 'atrasos'
  | 'direitos_imagem'
  | 'recursos_disciplinares'

export interface QuestionOption {
  value: string
  label: string
}

export interface QuestionDependency {
  /** ID da pergunta que controla esta */
  questionId: string
  /** Valores que habilitam esta pergunta (equals any) */
  equalsAny?: AnswerValue[]
  /** Se true, a pergunta controladora precisa ser true */
  isTrue?: boolean
  /** Se true, a pergunta controladora precisa ser false */
  isFalse?: boolean
}

export interface RulebookQuestion {
  id: string
  etapa: 1 | 2 | 3
  module?: RulebookModuleId
  chapter: RulebookChapterId
  label: string
  help?: string
  type: QuestionType
  options?: QuestionOption[]
  required?: boolean
  /** Perfis em que a pergunta aparece (omitido = todos) */
  profiles?: RulebookPerfil[]
  /** Dependências: todas devem ser satisfeitas */
  dependsOn?: QuestionDependency[]
  /** Módulo ativado quando resposta é true / valor específico */
  enablesModules?: RulebookModuleId[]
  /** Valor que ativa enablesModules (default: true) */
  enableWhen?: AnswerValue
  defaultByProfile?: Partial<Record<RulebookPerfil, AnswerValue>>
  min?: number
  max?: number
  placeholder?: string
  unit?: string
}

export interface RuleTemplateContext {
  answers: AnswersMap
  campeonatoNome: string
  perfil: RulebookPerfil
  modules: RulebookModuleId[]
}

export interface GeneratedArticle {
  id: string
  number: string
  title: string
  body: string
  observations?: string
  penalty?: string
  notes?: string
  chapterId: RulebookChapterId
}

export interface GeneratedChapter {
  id: RulebookChapterId
  order: number
  title: string
  articles: GeneratedArticle[]
  /** false se módulo desabilitado — capítulo omitido do documento final */
  included: boolean
}

export interface RulebookHighlight {
  label: string
  value: string
}

export interface GeneratedDocument {
  title: string
  subtitle: string
  campeonatoNome: string
  /** Logo do campeonato (URL pública) — usada na prévia e no PDF */
  logoUrl?: string | null
  perfil: RulebookPerfil
  generatedAt: string
  catalogVersion: string
  /** Dados principais destacados na capa / PDF */
  dadosPrincipais?: RulebookHighlight[]
  chapters: GeneratedChapter[]
  summary: Array<{ chapterId: RulebookChapterId; title: string; order: number }>
  articleCount: number
}

export interface RulebookAlert {
  id: string
  severity: 'blocking' | 'warning'
  code: string
  message: string
  field?: string
}

export type InfracaoCampoObrigatorio =
  | 'definicao'
  | 'condicoes'
  | 'provas_aceitas'
  | 'competencia'
  | 'penalidade_inicial'
  | 'penalidade_reincidencia'
  | 'direito_defesa'
  | 'direito_recurso'
  | 'prazo'
  | 'observacoes'

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

export interface InfracaoTemplate {
  codigo: string
  titulo: string
  gravidade: InfracaoConfig['gravidade']
  defaults: Omit<InfracaoConfig, 'codigo' | 'enabled' | 'titulo' | 'gravidade'>
  /** Só aparece se módulo ativo (ou sempre se omitido) */
  requiresModules?: RulebookModuleId[]
}

export interface RulebookRow {
  id: string
  campeonato_id: string
  perfil: RulebookPerfil
  etapa_atual: number
  respostas: AnswersMap
  modules_ativos: string[]
  infracoes: InfracaoConfig[]
  alertas: RulebookAlert[]
  confirmacoes_alertas: Record<string, boolean>
  documento: GeneratedDocument | Record<string, unknown>
  status: RulebookStatus
  catalog_version: string
  versao: number
  publicado_em: string | null
  criado_por: string | null
  atualizado_por: string | null
  created_at: string
  updated_at: string
}

export interface RulebookSaveInput {
  perfil?: RulebookPerfil
  etapa_atual?: number
  respostas?: AnswersMap
  infracoes?: InfracaoConfig[]
  confirmacoes_alertas?: Record<string, boolean>
  regenerate?: boolean
}

export interface RulebookEngineState {
  perfil: RulebookPerfil
  respostas: AnswersMap
  modules: RulebookModuleId[]
  visibleQuestions: RulebookQuestion[]
  infracoes: InfracaoConfig[]
  alerts: RulebookAlert[]
  canPublish: boolean
  documento: GeneratedDocument
}
