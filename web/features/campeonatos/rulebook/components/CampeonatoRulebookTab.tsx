'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { PremiacaoDivisaoEditor } from '@/components/forms/campeonato/PremiacaoDivisaoEditor'
import {
  moneyInputToValue,
  moneyValueToDisplay,
  parseMoneyNumber,
} from '@/lib/premiacao-divisao'
import { rulebookService } from '../services/rulebook.service'
import { RulebookViewer } from './RulebookViewer'
import '../rulebook.css'
import type {
  AnswerValue,
  InfracaoConfig,
  RulebookApiResponse,
  RulebookPerfil,
  RulebookQuestion,
} from '../types/rulebook.types'

type Props = {
  campeonatoId: string
}

const ETAPA_LABELS = [
  'Perfil',
  'Configuração',
  'Regras',
  'Infrações',
  'Revisão',
]

const DEFAULT_LINKED = new Set([
  'possui_premiacao',
  'descricao_premiacao',
  'premiacao_total',
  'divisao_premiacao_json',
  'possui_taxa',
  'valor_taxa',
  'possui_transmissao',
  'plataforma',
  'emulador_proibido',
  'qtd_titulares',
  'permite_reservas',
  'qtd_reservas',
  'modalidade',
])

function isEmptyAnswer(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null || v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

function QuestionField({
  question,
  value,
  onChange,
  invalid,
}: {
  question: RulebookQuestion
  value: AnswerValue
  onChange: (v: AnswerValue) => void
  invalid?: boolean
}) {
  if (question.type === 'boolean') {
    return (
      <div className={`rulebook-bool ${invalid ? 'invalid' : ''}`}>
        <button type="button" className={value === true ? 'active' : ''} onClick={() => onChange(true)}>
          Sim
        </button>
        <button type="button" className={value === false ? 'active' : ''} onClick={() => onChange(false)}>
          Não
        </button>
      </div>
    )
  }

  if (question.type === 'single' || question.type === 'select') {
    return (
      <div className={`rulebook-options ${invalid ? 'invalid' : ''}`}>
        {(question.options || []).map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={value === opt.value ? 'active' : ''}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'multi') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className={`rulebook-options multi ${invalid ? 'invalid' : ''}`}>
        {(question.options || []).map((opt) => {
          const on = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              className={on ? 'active' : ''}
              onClick={() => {
                if (on) onChange(selected.filter((s) => s !== opt.value))
                else onChange([...selected, opt.value])
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'number') {
    return (
      <div className={`rulebook-number ${invalid ? 'invalid' : ''}`}>
        <input
          type="number"
          min={question.min}
          max={question.max}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const n = e.target.value === '' ? null : Number(e.target.value)
            onChange(n)
          }}
        />
        {question.unit ? <span>{question.unit}</span> : null}
      </div>
    )
  }

  if (question.type === 'long_text') {
    return (
      <textarea
        className={`rulebook-textarea ${invalid ? 'invalid' : ''}`}
        rows={4}
        placeholder={question.placeholder}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <input
      className={`rulebook-input ${invalid ? 'invalid' : ''}`}
      type="text"
      placeholder={question.placeholder}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function CampeonatoRulebookTab({ campeonatoId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [error, setError] = useState('')
  const [stepError, setStepError] = useState('')
  const [data, setData] = useState<RulebookApiResponse | null>(null)
  const [draftAnswers, setDraftAnswers] = useState<Record<string, AnswerValue>>({})
  const [draftInfracoes, setDraftInfracoes] = useState<InfracaoConfig[]>([])
  const [confirmacoes, setConfirmacoes] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'wizard' | 'document'>('wizard')
  const [seedBanner, setSeedBanner] = useState<string[] | null>(null)
  const [highlightMissing, setHighlightMissing] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const saveInflight = useRef<Promise<RulebookApiResponse | null> | null>(null)
  const lastSavedSnap = useRef('')

  const snapshotOf = useCallback(
    (
      answers: Record<string, AnswerValue>,
      infracoes: InfracaoConfig[],
      conf: Record<string, boolean>,
    ) => JSON.stringify({ answers, infracoes, conf }),
    [],
  )

  const applyResponse = useCallback(
    (json: RulebookApiResponse, opts?: { keepDirty?: boolean }) => {
      setData(json)
      setDraftAnswers(json.rulebook.respostas || {})
      setDraftInfracoes(json.rulebook.infracoes || [])
      setConfirmacoes(json.rulebook.confirmacoes_alertas || {})
      lastSavedSnap.current = snapshotOf(
        json.rulebook.respostas || {},
        json.rulebook.infracoes || [],
        json.rulebook.confirmacoes_alertas || {},
      )
      if (!opts?.keepDirty) setDirty(false)
      if (json.meta?.seedAplicado && json.meta.seedCampos?.length) {
        setSeedBanner(json.meta.seedCampos)
      }
    },
    [snapshotOf],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Faça login para gerenciar o regulamento.')
      const json = await rulebookService.load(campeonatoId, token)
      applyResponse(json)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar rulebook.')
    } finally {
      setLoading(false)
    }
  }, [campeonatoId, applyResponse])

  useEffect(() => {
    void load()
  }, [load])

  const etapa = data?.rulebook.etapa_atual ?? 0
  const perfil = data?.rulebook.perfil

  const etapaQuestions: RulebookQuestion[] = useMemo(() => {
    if (!data) return []
    if (etapa === 1) return data.questions.etapa1
    if (etapa === 2) return data.questions.etapa2
    if (etapa === 3) return data.questions.etapa3
    return []
  }, [data, etapa])

  const stepProgress = useMemo(() => {
    if (!etapaQuestions.length) return { done: 0, total: 0, percent: 100 }
    const required = etapaQuestions.filter((q) => q.required)
    const done = required.filter((q) => !isEmptyAnswer(draftAnswers[q.id])).length
    const total = required.length
    return {
      done,
      total,
      percent: total ? Math.round((done / total) * 100) : 100,
    }
  }, [etapaQuestions, draftAnswers])

  const alerts = data?.engine.alerts || data?.rulebook.alertas || []
  const canPublish = data?.engine.canPublish
  const globalProgress = data?.engine.progress?.percent ?? 0
  const linkedFields = useMemo(
    () => new Set(data?.meta?.linkedFields?.length ? data.meta.linkedFields : [...DEFAULT_LINKED]),
    [data?.meta?.linkedFields],
  )

  function renderQuestionControl(q: RulebookQuestion, invalid: boolean) {
    // Premiação total (moeda)
    if (q.id === 'premiacao_total') {
      return (
        <div className={`rulebook-number ${invalid ? 'invalid' : ''}`}>
          <input
            inputMode="numeric"
            value={moneyValueToDisplay(String(draftAnswers.premiacao_total ?? ''))}
            placeholder="R$ 0,00"
            onChange={(e) => setAnswer('premiacao_total', moneyInputToValue(e.target.value))}
          />
        </div>
      )
    }

    // Divisão estruturada com orçamento restante
    if (q.id === 'divisao_premiacao_json') {
      return (
        <PremiacaoDivisaoEditor
          totalPremiacao={String(draftAnswers.premiacao_total ?? '')}
          value={String(draftAnswers.divisao_premiacao_json ?? '')}
          onChange={(serialized) => setAnswer('divisao_premiacao_json', serialized)}
          disabled={saving || autoSaving}
        />
      )
    }

    // Valor da taxa
    if (q.id === 'valor_taxa') {
      const raw = String(draftAnswers.valor_taxa ?? '')
      const asNum = parseMoneyNumber(raw)
      return (
        <div className={`rulebook-number ${invalid ? 'invalid' : ''}`}>
          <input
            inputMode="numeric"
            value={asNum > 0 || raw ? moneyValueToDisplay(asNum || moneyInputToValue(raw) || raw) : ''}
            placeholder="R$ 0,00"
            onChange={(e) => {
              const v = moneyInputToValue(e.target.value)
              setAnswer('valor_taxa', v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '')
            }}
          />
        </div>
      )
    }

    return (
      <QuestionField
        question={q}
        value={draftAnswers[q.id] ?? null}
        onChange={(v) => setAnswer(q.id, v)}
        invalid={invalid}
      />
    )
  }

  const missingRequiredIds = useMemo(() => {
    return etapaQuestions
      .filter((q) => q.required && isEmptyAnswer(draftAnswers[q.id]))
      .map((q) => q.id)
  }, [etapaQuestions, draftAnswers])

  const persist = useCallback(
    async (
      payload: Parameters<typeof rulebookService.save>[2],
      opts?: { silent?: boolean },
    ): Promise<RulebookApiResponse | null> => {
      // Espera save em andamento para não perder respostas ao clicar Continuar
      if (saveInflight.current) {
        try {
          await saveInflight.current
        } catch {
          // ignore
        }
      }

      if (opts?.silent) setAutoSaving(true)
      else setSaving(true)
      setError('')

      let settle!: (value: RulebookApiResponse | null) => void
      const run = new Promise<RulebookApiResponse | null>((resolve) => {
        settle = resolve
      })
      saveInflight.current = run

      try {
        const token = await getAccessToken()
        const json = await rulebookService.save(campeonatoId, token, payload)
        applyResponse(json)
        settle(json)
        return json
      } catch (e: any) {
        setError(e?.message || 'Erro ao salvar.')
        settle(null)
        return null
      } finally {
        if (saveInflight.current === run) saveInflight.current = null
        setSaving(false)
        setAutoSaving(false)
      }
    },
    [campeonatoId, applyResponse],
  )

  // Auto-save com debounce — regenera documento e módulos
  useEffect(() => {
    if (!data || loading || etapa === 0 || viewMode !== 'wizard') return
    const snap = snapshotOf(draftAnswers, draftInfracoes, confirmacoes)
    if (snap === lastSavedSnap.current) {
      setDirty(false)
      return
    }
    setDirty(true)
    const timer = window.setTimeout(() => {
      void persist(
        {
          respostas: draftAnswers,
          infracoes: draftInfracoes,
          confirmacoes_alertas: confirmacoes,
          etapa_atual: etapa,
        },
        { silent: true },
      )
    }, 850)
    return () => window.clearTimeout(timer)
  }, [
    draftAnswers,
    draftInfracoes,
    confirmacoes,
    data,
    loading,
    etapa,
    viewMode,
    snapshotOf,
    persist,
  ])

  async function selectPerfil(next: RulebookPerfil) {
    setStepError('')
    setHighlightMissing(new Set())
    await persist({ perfil: next, etapa_atual: 1 })
  }

  function validateCurrentStep(): boolean {
    if (etapa === 0) {
      setStepError('Escolha um perfil para continuar.')
      return false
    }
    if (etapa === 1 || etapa === 2 || etapa === 3) {
      if (missingRequiredIds.length) {
        setHighlightMissing(new Set(missingRequiredIds))
        setStepError(
          `Responda as perguntas obrigatórias desta etapa (${missingRequiredIds.length} pendente${
            missingRequiredIds.length > 1 ? 's' : ''
          }).`,
        )
        // scroll first missing
        const first = missingRequiredIds[0]
        const el = document.getElementById(`rb-q-${first}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return false
      }
    }
    setHighlightMissing(new Set())
    setStepError('')
    return true
  }

  async function saveAnswersAndGo(nextEtapa: number) {
    if (nextEtapa > etapa && !validateCurrentStep()) return
    await persist({
      respostas: draftAnswers,
      infracoes: draftInfracoes,
      confirmacoes_alertas: confirmacoes,
      etapa_atual: nextEtapa,
    })
  }

  async function publish() {
    setSaving(true)
    setError('')
    try {
      const token = await getAccessToken()
      await rulebookService.save(campeonatoId, token, {
        respostas: draftAnswers,
        infracoes: draftInfracoes,
        confirmacoes_alertas: confirmacoes,
      })
      const json = await rulebookService.publish(campeonatoId, token, confirmacoes)
      applyResponse(json)
      setViewMode('document')
    } catch (e: any) {
      setError(e?.message || 'Não foi possível publicar.')
    } finally {
      setSaving(false)
    }
  }

  function updateInfracao(codigo: string, patch: Partial<InfracaoConfig>) {
    setDraftInfracoes((list) =>
      list.map((i) => (i.codigo === codigo ? { ...i, ...patch } : i)),
    )
  }

  function setAnswer(id: string, value: AnswerValue) {
    setDraftAnswers((prev) => ({ ...prev, [id]: value }))
    setHighlightMissing((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (stepError) setStepError('')
  }

  if (loading) {
    return (
      <div className="rulebook-loading">
        <Loader2 className="spin" size={22} />
        <span>Carregando assistente de regulamento…</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rulebook-error">
        <ShieldAlert size={20} />
        <p>{error}</p>
        <button type="button" className="button" onClick={() => void load()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null


  return (
    <div className="rulebook-tab">
      <header className="rulebook-tab-header">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} /> Rulebook Builder
          </p>
          <h3>Regulamento inteligente</h3>
          <p className="muted">
            Responda o essencial — o regulamento é gerado e atualizado automaticamente.
          </p>
        </div>
        <div className="rulebook-status-pills">
          <span className={`pill status-${data.rulebook.status}`}>{data.rulebook.status}</span>
          <span className="pill">v{data.rulebook.versao}</span>
          {autoSaving ? (
            <span className="pill">
              <Loader2 className="spin" size={12} /> Salvando…
            </span>
          ) : dirty ? (
            <span className="pill">Alterações pendentes</span>
          ) : (
            <span className="pill success">
              <CheckCircle2 size={12} /> Sincronizado
            </span>
          )}
          {data.rulebook.publicado_em ? (
            <span className="pill success">
              <CheckCircle2 size={14} /> Publicado
            </span>
          ) : null}
        </div>
      </header>

      {/* Progresso global */}
      <div className="rulebook-progress-bar no-print" aria-label="Progresso do regulamento">
        <div className="rulebook-progress-track">
          <div className="rulebook-progress-fill" style={{ width: `${globalProgress}%` }} />
        </div>
        <span>
          {data.engine.progress
            ? `${data.engine.progress.answeredRequired}/${data.engine.progress.totalRequired} obrigatórias · ${globalProgress}%`
            : `${globalProgress}%`}
        </span>
      </div>

      <div className="rulebook-mode-switch no-print">
        <button
          type="button"
          className={viewMode === 'wizard' ? 'active' : ''}
          onClick={() => setViewMode('wizard')}
        >
          <Wand2 size={15} /> Assistente
        </button>
        <button
          type="button"
          className={viewMode === 'document' ? 'active' : ''}
          onClick={() => setViewMode('document')}
          title="Ver o regulamento completo (prévia final)"
        >
          <BookOpen size={15} /> Prévia do documento
        </button>
      </div>

      {seedBanner?.length ? (
        <div className="rulebook-seed-banner no-print">
          <Wand2 size={16} />
          <div>
            <strong>Pré-preenchido com dados do campeonato</strong>
            <p>
              Já importamos: {seedBanner.slice(0, 6).join(' · ')}
              {seedBanner.length > 6 ? ` · +${seedBanner.length - 6}` : ''}. Você pode ajustar tudo.
            </p>
          </div>
          <button type="button" className="button secondary" onClick={() => setSeedBanner(null)}>
            Entendi
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rulebook-inline-error">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}

      {viewMode === 'document' ? (
        <RulebookViewer documento={data.rulebook.documento} />
      ) : (
        <>
          <ol className="rulebook-steps">
            {ETAPA_LABELS.map((label, idx) => (
              <li key={label} className={etapa === idx ? 'active' : etapa > idx ? 'done' : ''}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (idx > etapa && !validateCurrentStep()) return
                    void persist({
                      etapa_atual: idx,
                      respostas: draftAnswers,
                      infracoes: draftInfracoes,
                      confirmacoes_alertas: confirmacoes,
                    })
                  }}
                >
                  <span>{idx}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          <div className="rulebook-create-layout">
            <div className="rulebook-create-main">
              {etapa === 0 ? (
                <section className="rulebook-profiles">
                  <h4>Como é o seu campeonato?</h4>
                  <p className="muted">
                    Escolha o perfil. Campeonatos menores respondem menos perguntas; profissionais têm
                    controle total. Dados já cadastrados no campeonato serão aproveitados.
                  </p>
                  <div className="rulebook-profile-grid">
                    {(data.catalog.perfis || []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`rulebook-profile-card ${perfil === p.id ? 'selected' : ''}`}
                        onClick={() => void selectPerfil(p.id)}
                        disabled={saving}
                      >
                        <strong>{p.label}</strong>
                        <span>{p.description}</span>
                        {p.id === 'comunitario' ? (
                          <em className="profile-hint">Recomendado para começar rápido</em>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {(etapa === 1 || etapa === 2) ? (
                <section className="rulebook-questions">
                  <div className="rulebook-step-head">
                    <div>
                      <h4>
                        {etapa === 1
                          ? 'Configuração do campeonato'
                          : 'Regras por seção (módulos ativos)'}
                      </h4>
                      <p className="muted">
                        {etapa === 1
                          ? 'Cada resposta define o que entra no regulamento (e o que some).'
                          : 'Perguntas agrupadas por tema: equipes, partidas, bugs, pontuação etc. Só entram módulos que você habilitou.'}
                      </p>
                    </div>
                    <div className="rulebook-step-progress">
                      <strong>{stepProgress.percent}%</strong>
                      <small>
                        {stepProgress.done}/{stepProgress.total} nesta etapa
                      </small>
                    </div>
                  </div>
                  <div className="rulebook-question-list">
                    {(() => {
                      const groups = data.catalog.chapterGroups || {}
                      const chapterOrder = [
                        'disposicoes_gerais',
                        'organizacao',
                        'participacao',
                        'elegibilidade',
                        'equipes',
                        'jogadores',
                        'manager',
                        'coach',
                        'cadastro',
                        'check_in',
                        'partidas',
                        'pontuacao',
                        'desconexoes',
                        'remakes',
                        'infracoes',
                        'penalidades',
                        'recursos',
                        'premiacao',
                        'direitos_imagem',
                        'disposicoes_finais',
                      ]
                      const byChapter = new Map<string, RulebookQuestion[]>()
                      for (const q of etapaQuestions) {
                        const list = byChapter.get(q.chapter) || []
                        list.push(q)
                        byChapter.set(q.chapter, list)
                      }
                      const orderedChapters = [
                        ...chapterOrder.filter((id) => byChapter.has(id)),
                        ...Array.from(byChapter.keys()).filter((id) => !chapterOrder.includes(id)),
                      ]
                      // Na etapa 1 (config), lista plana; na etapa 2 (regras), agrupa por seção
                      if (etapa === 1) {
                        return etapaQuestions.map((q) => {
                          const invalid = highlightMissing.has(q.id)
                          const linked = linkedFields.has(q.id)
                          return (
                            <div
                              key={q.id}
                              id={`rb-q-${q.id}`}
                              className={`rulebook-question-card ${invalid ? 'missing' : ''} ${linked ? 'linked' : ''}`}
                            >
                              <label>
                                {q.label}
                                {q.required ? <em>*</em> : null}
                                {linked ? (
                                  <span className="rulebook-linked-tag">Vinculado ao campeonato</span>
                                ) : null}
                              </label>
                              {q.help ? <small className="muted">{q.help}</small> : null}
                              {renderQuestionControl(q, invalid)}
                              {invalid ? (
                                <small className="rulebook-field-error">Campo obrigatório</small>
                              ) : null}
                            </div>
                          )
                        })
                      }
                      return orderedChapters.map((chapterId) => {
                        const qs = byChapter.get(chapterId) || []
                        const title = groups[chapterId] || chapterId
                        return (
                          <div key={chapterId} className="rulebook-section-group">
                            <div className="rulebook-section-group-head">
                              <h5>{title}</h5>
                              <span>{qs.length} pergunta{qs.length === 1 ? '' : 's'}</span>
                            </div>
                            {qs.map((q) => {
                              const invalid = highlightMissing.has(q.id)
                              const linked = linkedFields.has(q.id)
                              return (
                                <div
                                  key={q.id}
                                  id={`rb-q-${q.id}`}
                                  className={`rulebook-question-card ${invalid ? 'missing' : ''} ${linked ? 'linked' : ''}`}
                                >
                                  <label>
                                    {q.label}
                                    {q.required ? <em>*</em> : null}
                                    {linked ? (
                                      <span className="rulebook-linked-tag">Vinculado ao campeonato</span>
                                    ) : null}
                                  </label>
                                  {q.help ? <small className="muted">{q.help}</small> : null}
                                  {renderQuestionControl(q, invalid)}
                                  {invalid ? (
                                    <small className="rulebook-field-error">Campo obrigatório</small>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })
                    })()}
                    {!etapaQuestions.length ? (
                      <p className="empty">Nenhuma pergunta nesta etapa com o perfil/módulos atuais.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {etapa === 3 ? (
                <section className="rulebook-infracoes">
                  <div className="rulebook-step-head">
                    <div>
                      <h4>Infrações e penalidades</h4>
                      <p className="muted">
                        Habilite as tipificações e complete os campos. Infrações incompletas bloqueiam a
                        publicação.
                      </p>
                    </div>
                  </div>

                  {data.questions.etapa3.map((q) => (
                    <div
                      key={q.id}
                      id={`rb-q-${q.id}`}
                      className={`rulebook-question-card ${highlightMissing.has(q.id) ? 'missing' : ''}`}
                    >
                      <label>
                        {q.label}
                        {q.required ? <em>*</em> : null}
                      </label>
                      <QuestionField
                        question={q}
                        value={draftAnswers[q.id] ?? null}
                        onChange={(v) => setAnswer(q.id, v)}
                        invalid={highlightMissing.has(q.id)}
                      />
                    </div>
                  ))}

                  <div className="rulebook-infracao-list">
                    {draftInfracoes.map((inf) => (
                      <details key={inf.codigo} className="rulebook-infracao-card" open={inf.enabled}>
                        <summary>
                          <label className="rulebook-infracao-toggle" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={inf.enabled}
                              onChange={(e) => updateInfracao(inf.codigo, { enabled: e.target.checked })}
                            />
                            <strong>{inf.titulo}</strong>
                            <span className={`gravidade g-${inf.gravidade}`}>{inf.gravidade}</span>
                          </label>
                        </summary>
                        {inf.enabled ? (
                          <div className="rulebook-infracao-fields">
                            {(
                              [
                                ['definicao', 'Definição'],
                                ['condicoes', 'Condições'],
                                ['provas_aceitas', 'Provas aceitas'],
                                ['competencia', 'Competência para julgamento'],
                                ['penalidade_inicial', 'Penalidade inicial'],
                                ['penalidade_reincidencia', 'Penalidade por reincidência'],
                                ['prazo', 'Prazo'],
                                ['observacoes', 'Observações'],
                              ] as const
                            ).map(([field, label]) => (
                              <label key={field}>
                                {label}
                                <textarea
                                  rows={2}
                                  value={String(inf[field] || '')}
                                  onChange={(e) =>
                                    updateInfracao(inf.codigo, { [field]: e.target.value })
                                  }
                                />
                              </label>
                            ))}
                            <div className="rulebook-bool-row">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={inf.direito_defesa}
                                  onChange={(e) =>
                                    updateInfracao(inf.codigo, { direito_defesa: e.target.checked })
                                  }
                                />
                                Direito de defesa
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={inf.direito_recurso}
                                  onChange={(e) =>
                                    updateInfracao(inf.codigo, { direito_recurso: e.target.checked })
                                  }
                                />
                                Direito de recurso
                              </label>
                            </div>
                          </div>
                        ) : null}
                      </details>
                    ))}
                  </div>
                </section>
              ) : null}

              {etapa === 4 ? (
                <section className="rulebook-review">
                  <h4>Revisão e publicação</h4>
                  <p className="muted">
                    Confira os alertas e a prévia completa do regulamento. Alertas bloqueantes precisam
                    ser resolvidos antes de publicar.
                  </p>

                  <div className="rulebook-alerts">
                    {!alerts.length ? (
                      <div className="rulebook-alert ok">
                        <CheckCircle2 size={16} /> Nenhum alerta pendente — pronto para publicar.
                      </div>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.id} className={`rulebook-alert ${a.severity}`}>
                          <AlertTriangle size={16} />
                          <div>
                            <strong>{a.severity === 'blocking' ? 'Bloqueante' : 'Atenção'}</strong>
                            <p>{a.message}</p>
                            {a.severity === 'warning' ? (
                              <label className="confirm-alert">
                                <input
                                  type="checkbox"
                                  checked={Boolean(confirmacoes[a.id])}
                                  onChange={(e) =>
                                    setConfirmacoes((prev) => ({
                                      ...prev,
                                      [a.id]: e.target.checked,
                                    }))
                                  }
                                />
                                Confirmo ciência e desejo seguir assim
                              </label>
                            ) : a.field && etapaQuestions.some((q) => q.id === a.field) ? null : a.field ? (
                              <button
                                type="button"
                                className="button secondary small"
                                onClick={() => {
                                  // tenta voltar para etapa onde o campo existe
                                  const all = [
                                    ...data.questions.etapa1,
                                    ...data.questions.etapa2,
                                    ...data.questions.etapa3,
                                  ]
                                  const q = all.find((x) => x.id === a.field)
                                  if (q) {
                                    void persist({
                                      etapa_atual: q.etapa,
                                      respostas: draftAnswers,
                                      infracoes: draftInfracoes,
                                    })
                                  }
                                }}
                              >
                                Corrigir
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rulebook-modules">
                    <p className="eyebrow">Módulos ativos</p>
                    <div className="pill-row">
                      {(data.engine.modules || []).map((m) => (
                        <span key={m} className="pill">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rulebook-review-preview">
                    <div className="rulebook-review-preview-head">
                      <p className="eyebrow">Prévia do regulamento</p>
                      <small>
                        {(data.rulebook.documento as { articleCount?: number } | null)?.articleCount || 0}{' '}
                        artigos · use PDF / Imprimir no documento
                      </small>
                    </div>
                    <RulebookViewer documento={data.rulebook.documento} />
                  </div>
                </section>
              ) : null}

              {stepError ? (
                <div className="rulebook-inline-error">
                  <AlertTriangle size={16} /> {stepError}
                </div>
              ) : null}

              <footer className="rulebook-footer no-print">
                <button
                  type="button"
                  className="button secondary"
                  disabled={saving || etapa === 0}
                  onClick={() => void saveAnswersAndGo(Math.max(0, etapa - 1))}
                >
                  <ChevronLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={saving || autoSaving}
                  onClick={() =>
                    void persist({
                      respostas: draftAnswers,
                      infracoes: draftInfracoes,
                      confirmacoes_alertas: confirmacoes,
                      etapa_atual: etapa,
                    })
                  }
                >
                  {saving || autoSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                  Salvar
                </button>
                {etapa < 4 ? (
                  <button
                    type="button"
                    className="button"
                    disabled={saving}
                    onClick={() => void saveAnswersAndGo(Math.min(4, etapa + 1))}
                  >
                    Continuar <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button"
                    disabled={saving || canPublish === false}
                    onClick={() => void publish()}
                    title={
                      canPublish === false
                        ? 'Resolva os alertas bloqueantes'
                        : 'Publicar regulamento'
                    }
                  >
                    {saving ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                    Publicar regulamento
                  </button>
                )}
              </footer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
