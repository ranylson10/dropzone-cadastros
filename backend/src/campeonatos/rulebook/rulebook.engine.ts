import { RULEBOOK_QUESTIONS } from './rulebook.catalog'
import { CATALOG_VERSION } from './rulebook.chapters'
import {
  buildDefaultInfracoes,
  isInfracaoCompleta,
} from './rulebook.infracoes'
import { generateDocument } from './rulebook.generator'
import type {
  AnswerValue,
  AnswersMap,
  InfracaoConfig,
  RulebookAlert,
  RulebookEngineState,
  RulebookModuleId,
  RulebookPerfil,
  RulebookQuestion,
} from './rulebook.types'

function answerEquals(actual: AnswerValue | undefined, expected: AnswerValue): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false
    return expected.every((e) => actual.includes(String(e)))
  }
  if (Array.isArray(actual)) {
    return actual.includes(String(expected))
  }
  return actual === expected
}

export function dependencySatisfied(
  dep: NonNullable<RulebookQuestion['dependsOn']>[number],
  answers: AnswersMap,
): boolean {
  const value = answers[dep.questionId]
  if (dep.isTrue === true) return value === true
  if (dep.isFalse === true) return value === false
  if (dep.equalsAny?.length) {
    return dep.equalsAny.some((expected) => answerEquals(value, expected))
  }
  return value !== undefined && value !== null && value !== ''
}

export function isQuestionVisible(
  question: RulebookQuestion,
  perfil: RulebookPerfil,
  answers: AnswersMap,
): boolean {
  if (question.profiles?.length && !question.profiles.includes(perfil)) {
    return false
  }
  if (!question.dependsOn?.length) return true
  return question.dependsOn.every((d) => dependencySatisfied(d, answers))
}

export function applyProfileDefaults(
  perfil: RulebookPerfil,
  current: AnswersMap = {},
): AnswersMap {
  if (perfil === 'personalizado') {
    return { ...current }
  }
  const next: AnswersMap = { ...current }
  for (const q of RULEBOOK_QUESTIONS) {
    if (next[q.id] !== undefined) continue
    const def = q.defaultByProfile?.[perfil]
    if (def !== undefined) {
      next[q.id] = def
    }
  }
  return next
}

export function resolveModules(answers: AnswersMap): RulebookModuleId[] {
  const modules = new Set<RulebookModuleId>()

  const formato = answers.formato_evento
  if (formato === 'online') {
    modules.add('online')
    modules.add('lobby')
    modules.add('ping')
  } else if (formato === 'presencial') {
    modules.add('presencial')
  } else if (formato === 'hibrido') {
    modules.add('hibrido')
    modules.add('online')
    modules.add('presencial')
    modules.add('lobby')
    modules.add('ping')
  }

  for (const q of RULEBOOK_QUESTIONS) {
    if (!q.enablesModules?.length) continue
    const value = answers[q.id]
    const when = q.enableWhen !== undefined ? q.enableWhen : true
    if (answerEquals(value, when) || value === when) {
      for (const m of q.enablesModules) modules.add(m)
    }
  }

  // Se formato online/híbrido e usa discord
  if (answers.usa_discord === true) modules.add('discord')

  return Array.from(modules)
}

export function getVisibleQuestions(
  perfil: RulebookPerfil,
  answers: AnswersMap,
  etapa?: 1 | 2 | 3,
): RulebookQuestion[] {
  return RULEBOOK_QUESTIONS.filter((q) => {
    if (etapa && q.etapa !== etapa) return false
    return isQuestionVisible(q, perfil, answers)
  })
}

export function mergeInfracoes(
  modules: RulebookModuleId[],
  existing: InfracaoConfig[] | undefined,
): InfracaoConfig[] {
  const defaults = buildDefaultInfracoes(modules)
  if (!existing?.length) return defaults

  const byCode = new Map(existing.map((i) => [i.codigo, i]))
  const result: InfracaoConfig[] = defaults.map((d) => {
    const prev = byCode.get(d.codigo)
    if (!prev) return d
    return { ...d, ...prev, codigo: d.codigo, titulo: prev.titulo || d.titulo }
  })

  // Mantém infrações customizadas não catalogadas
  for (const prev of existing) {
    if (!result.some((r) => r.codigo === prev.codigo)) {
      result.push(prev)
    }
  }
  return result
}

export function computeAlerts(input: {
  answers: AnswersMap
  modules: RulebookModuleId[]
  infracoes: InfracaoConfig[]
  confirmacoes?: Record<string, boolean>
}): RulebookAlert[] {
  const { answers, modules, infracoes, confirmacoes = {} } = input
  const alerts: RulebookAlert[] = []

  const push = (alert: RulebookAlert) => {
    if (confirmacoes[alert.id] && alert.severity === 'warning') return
    alerts.push(alert)
  }

  if (!answers.competencia_julgamento) {
    push({
      id: 'sem_competencia',
      severity: 'blocking',
      code: 'NO_JUDGE',
      message: 'Não foi definido quem julga as infrações.',
      field: 'competencia_julgamento',
    })
  }

  if (answers.direito_defesa_geral === false) {
    push({
      id: 'sem_defesa',
      severity: 'warning',
      code: 'NO_DEFENSE',
      message: 'Não existe direito de defesa geral configurado para punições graves.',
      field: 'direito_defesa_geral',
    })
  }

  if (modules.includes('recursos_disciplinares') && !String(answers.prazo_recurso || '').trim()) {
    push({
      id: 'sem_prazo_recurso',
      severity: 'blocking',
      code: 'NO_APPEAL_DEADLINE',
      message: 'Não existe prazo para recurso.',
      field: 'prazo_recurso',
    })
  }

  if (modules.includes('taxa_inscricao') && !String(answers.politica_reembolso || '').trim()) {
    push({
      id: 'sem_reembolso',
      severity: 'blocking',
      code: 'NO_REFUND_POLICY',
      message: 'Não foi definida política de reembolso.',
      field: 'politica_reembolso',
    })
  }

  if (modules.includes('desconexoes') && answers.politica_desconexao !== true) {
    push({
      id: 'sem_desconexao',
      severity: 'warning',
      code: 'NO_DISCONNECT_POLICY',
      message: 'Não foi definida política para desconexões.',
      field: 'politica_desconexao',
    })
  }

  const enabledInfracoes = infracoes.filter((i) => i.enabled)
  if (enabledInfracoes.length === 0) {
    push({
      id: 'sem_infracoes',
      severity: 'blocking',
      code: 'NO_INFRACTIONS',
      message: 'Nenhuma infração habilitada no regulamento.',
    })
  }

  for (const inf of enabledInfracoes) {
    if (!isInfracaoCompleta(inf)) {
      push({
        id: `infracao_incompleta_${inf.codigo}`,
        severity: 'blocking',
        code: 'INCOMPLETE_INFRACTION',
        message: `A infração "${inf.titulo}" possui campos obrigatórios vazios.`,
        field: inf.codigo,
      })
    }
    if (!String(inf.penalidade_inicial || '').trim()) {
      push({
        id: `sem_punicao_${inf.codigo}`,
        severity: 'blocking',
        code: 'NO_PENALTY',
        message: `Nenhuma punição definida para: ${inf.titulo}.`,
        field: inf.codigo,
      })
    }
    if (inf.direito_defesa === false && inf.gravidade !== 'leve') {
      push({
        id: `defesa_off_${inf.codigo}`,
        severity: 'warning',
        code: 'NO_DEFENSE_INF',
        message: `Infrações de gravidade ${inf.gravidade} sem direito de defesa: ${inf.titulo}.`,
        field: inf.codigo,
      })
    }
  }

  // Perguntas obrigatórias visíveis sem resposta
  for (const q of getVisibleQuestions('profissional', answers)) {
    // use all visible for current answers regardless of profile filter already applied externally
    if (!q.required) continue
    const v = answers[q.id]
    const empty =
      v === undefined
      || v === null
      || v === ''
      || (Array.isArray(v) && v.length === 0)
    if (empty) {
      // only etapa 1-3 questions that are currently relevant — engine caller filters by visibility with perfil
    }
  }

  return alerts
}

export function computeAlertsForState(
  perfil: RulebookPerfil,
  answers: AnswersMap,
  modules: RulebookModuleId[],
  infracoes: InfracaoConfig[],
  confirmacoes: Record<string, boolean> = {},
): RulebookAlert[] {
  const alerts = computeAlerts({ answers, modules, infracoes, confirmacoes })

  for (const q of getVisibleQuestions(perfil, answers)) {
    if (!q.required) continue
    const v = answers[q.id]
    const empty =
      v === undefined
      || v === null
      || v === ''
      || (Array.isArray(v) && v.length === 0)
    if (empty) {
      alerts.push({
        id: `pergunta_${q.id}`,
        severity: 'blocking',
        code: 'MISSING_ANSWER',
        message: `Pergunta obrigatória sem resposta: ${q.label}`,
        field: q.id,
      })
    }
  }

  return alerts
}

export function buildEngineState(input: {
  perfil: RulebookPerfil
  respostas: AnswersMap
  infracoes?: InfracaoConfig[]
  confirmacoes_alertas?: Record<string, boolean>
  campeonatoNome: string
  logoUrl?: string | null
}): RulebookEngineState {
  const respostas = applyProfileDefaults(input.perfil, input.respostas || {})
  const modules = resolveModules(respostas)
  let infracoes = mergeInfracoes(modules, input.infracoes)

  // Espelha respostas de bugs nas tipificações (etapa Infrações / documento)
  if (modules.includes('bug_abuse') && respostas.proibe_bug_abuse === true) {
    infracoes = infracoes.map((inf) => {
      if (inf.codigo !== 'bug_abuse') return inf
      const pen1 = String(respostas.bug_penalidade_primeira || '').trim()
      const pen2 = String(respostas.bug_penalidade_reincidencia || '').trim()
      return {
        ...inf,
        penalidade_inicial: pen1 || inf.penalidade_inicial,
        penalidade_reincidencia: pen2 || inf.penalidade_reincidencia,
      }
    })
  }
  const alerts = computeAlertsForState(
    input.perfil,
    respostas,
    modules,
    infracoes,
    input.confirmacoes_alertas || {},
  )
  const blocking = alerts.filter((a) => a.severity === 'blocking')
  const confirmedBlocking = blocking.every((a) => input.confirmacoes_alertas?.[a.id])
  // blocking alerts that are MISSING or incomplete cannot be confirmed away
  const hardBlocking = blocking.filter(
    (a) =>
      a.code === 'MISSING_ANSWER'
      || a.code === 'INCOMPLETE_INFRACTION'
      || a.code === 'NO_PENALTY'
      || a.code === 'NO_INFRACTIONS'
      || a.code === 'NO_JUDGE'
      || a.code === 'NO_APPEAL_DEADLINE'
      || a.code === 'NO_REFUND_POLICY',
  )
  const softBlockingOk = blocking
    .filter((a) => !hardBlocking.includes(a))
    .every((a) => input.confirmacoes_alertas?.[a.id])

  const documento = generateDocument({
    answers: respostas,
    modules,
    infracoes,
    perfil: input.perfil,
    campeonatoNome: input.campeonatoNome,
    catalogVersion: CATALOG_VERSION,
    logoUrl: input.logoUrl ?? null,
  })

  return {
    perfil: input.perfil,
    respostas,
    modules,
    visibleQuestions: getVisibleQuestions(input.perfil, respostas),
    infracoes,
    alerts,
    canPublish: hardBlocking.length === 0 && softBlockingOk,
    documento,
  }
}

export function questionsMetaForClient(perfil: RulebookPerfil, answers: AnswersMap) {
  const visible = getVisibleQuestions(perfil, answers)
  return {
    catalogVersion: CATALOG_VERSION,
    etapa1: visible.filter((q) => q.etapa === 1),
    etapa2: visible.filter((q) => q.etapa === 2),
    etapa3: visible.filter((q) => q.etapa === 3),
    allVisible: visible,
  }
}
