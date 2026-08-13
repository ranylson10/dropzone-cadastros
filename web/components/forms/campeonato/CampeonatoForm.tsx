'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CreditCard, Dumbbell, Medal, MessageCircle, Plus, QrCode, Swords, Trash2, Trophy, WalletCards } from 'lucide-react'
import { CHAMPIONSHIP_TYPE_LABELS, type ChampionshipType } from '@/lib/dropzone-constants'
import type { DropZoneRow } from '@/lib/types'
import { championshipThemeStyle } from '@/lib/championship-theme'
import { Field, UploadField, resolvePendingImageUpload } from '@/features/dropzone/components/form-fields'
import { PremiacaoDivisaoEditor } from './PremiacaoDivisaoEditor'

export type CampeonatoFormValue = {
  nome: string
  tipo: string
  logo_url: string
  banner_url: string
  premiacao: string
  valor_inscricao: string
  descricao_premiacao: string
  divisao_premiacao: string
  numero_vagas: string
  numero_fases: string
  nomes_fases: string[]
  formato: string
  plataforma: string
  servidor: string
  tipo_premiacao: string
  tem_trofeu: boolean
  tem_live: boolean
  vagas_por_equipe: string
  jogadores_por_vaga: string
  permite_jogador_multiplas_equipes: boolean
  permite_troca_jogadores: boolean
  data_limite_trocas: string
  data_limite_inscricao: string
  aceita_novas_inscricoes_equipes: boolean
  contatos_whatsapp: CampeonatoWhatsappContact[]
  pagamento_pix_ativo: boolean
  pagamento_cartao_ativo: boolean
  pagamento_paypal_ativo: boolean
  pagamento_whatsapp_ativo: boolean
  cartao_max_parcelas: string
  paypal_moedas: string[]
  /** Tema visual do campeonato */
  cor_principal: string
  cor_secundaria: string
  /** Intensidade da cor no fundo (0–100) */
  bg_opacidade: string
  /** Imagem de fundo do layout (opcional) */
  bg_image_url: string
  cor_texto_clara: string
  cor_texto_escura: string
  /** Recursos cobrados no pacote DropZone (criação) */
  recurso_export: boolean
  recurso_stream: boolean
  recurso_rulebook: boolean
  recurso_stats: boolean
  recurso_broadcast: boolean
  nome_historico: string
  numero_edicao: string
  temporada: string
  titulo_publico: string
  origem_criacao: 'novo' | 'modelo' | 'season'
  campeonato_origem_id: string
  franquia_origem_id: string
  liga_usa_divisoes: boolean
  liga_nome_agrupamento: string
  liga_divisoes: Array<{
    id: string
    nome: string
    codigo: string
    ordem: number
  }>
}

export type CampeonatoWhatsappContact = {
  id: string
  nome: string
  pais: string
  bandeira: string
  ddi: string
  telefone: string
}

export const WHATSAPP_COUNTRIES = [
  { pais: 'Brasil', bandeira: '🇧🇷', ddi: '+55' },
  { pais: 'Portugal', bandeira: '🇵🇹', ddi: '+351' },
  { pais: 'Estados Unidos', bandeira: '🇺🇸', ddi: '+1' },
  { pais: 'Argentina', bandeira: '🇦🇷', ddi: '+54' },
  { pais: 'Paraguai', bandeira: '🇵🇾', ddi: '+595' },
] as const

export const emptyCampeonatoForm: CampeonatoFormValue = {
  nome: '',
  tipo: '',
  logo_url: '',
  banner_url: '',
  premiacao: '',
  valor_inscricao: '',
  descricao_premiacao: '',
  divisao_premiacao: '',
  numero_vagas: '',
  numero_fases: '1',
  nomes_fases: ['Fase 1'],
  formato: '',
  plataforma: '',
  servidor: '',
  tipo_premiacao: 'sem_premiacao',
  tem_trofeu: false,
  tem_live: false,
  vagas_por_equipe: '',
  jogadores_por_vaga: '',
  permite_jogador_multiplas_equipes: false,
  permite_troca_jogadores: false,
  data_limite_trocas: '',
  data_limite_inscricao: '',
  aceita_novas_inscricoes_equipes: true,
  contatos_whatsapp: [],
  pagamento_pix_ativo: true,
  pagamento_cartao_ativo: true,
  pagamento_paypal_ativo: false,
  pagamento_whatsapp_ativo: true,
  cartao_max_parcelas: '1',
  paypal_moedas: ['BRL', 'USD', 'EUR'],
  cor_principal: '#ff4655',
  cor_secundaria: '#17191d',
  bg_opacidade: '18',
  bg_image_url: '',
  cor_texto_clara: '#ffffff',
  cor_texto_escura: '#17191d',
  recurso_export: true,
  recurso_stream: true,
  recurso_rulebook: true,
  recurso_stats: true,
  recurso_broadcast: false,
  nome_historico: '',
  numero_edicao: '1',
  temporada: '',
  titulo_publico: '',
  origem_criacao: 'novo',
  campeonato_origem_id: '',
  franquia_origem_id: '',
  liga_usa_divisoes: false,
  liga_nome_agrupamento: 'Divisões',
  liga_divisoes: [],
}

const TYPE_OPTIONS: Array<{
  type: ChampionshipType
  title: string
  description: string
  format: string
  icon: typeof Trophy
}> = [
  {
    type: 'diario',
    title: 'Diário',
    description: 'Evento rápido em grupo único, com uma rodada e um vencedor.',
    format: 'Grupo único / jogo único',
    icon: CalendarDays,
  },
  {
    type: 'copa',
    title: 'Copa',
    description: 'Competição eliminatória com grupos, classificatórias e fases finais.',
    format: 'Mata-mata',
    icon: Trophy,
  },
  {
    type: 'liga',
    title: 'Liga',
    description: 'Poucas equipes disputam várias rodadas em sistema de pontos corridos.',
    format: 'Pontos corridos ou híbrido',
    icon: Medal,
  },
  {
    type: 'xtreino',
    title: 'X-Treino',
    description: 'Treino preparatório que pode usar jogo único, mata-mata ou pontos corridos.',
    format: 'Jogo único',
    icon: Dumbbell,
  },
  {
    type: 'confronto',
    title: 'Confronto',
    description: 'Disputa direta 4x4 entre equipes, em modo Tático, UMP ou personalizado.',
    format: 'Confronto direto 4x4 - Tático',
    icon: Swords,
  },
]

function defaultFormat(type: string) {
  return TYPE_OPTIONS.find((option) => option.type === type)?.format || ''
}

function moneyDisplay(value: string) {
  if (!value) return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(parsed)
}

function moneyValue(input: string) {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toFixed(2)
}

type PriceQuote = {
  valor_total_brl: string
  valor_total_centavos: number
  linhas: Array<{ chave: string; rotulo: string; valor_centavos: number; qtd?: number }>
}

export function CampeonatoForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
  mode = 'create',
  championships = [],
  uploadPublicFile,
}: {
  value: CampeonatoFormValue
  onChange: (value: CampeonatoFormValue) => void
  onSubmit: (resolvedValue: CampeonatoFormValue) => void | Promise<void>
  onCancel?: () => void
  loading: boolean
  mode?: 'create' | 'edit'
  championships?: DropZoneRow[]
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [step, setStep] = useState<'type' | 'form'>(mode === 'edit' ? 'form' : 'type')
  const [formPage, setFormPage] = useState<'origin' | 'identity' | 'season' | 'format' | 'operation' | 'review'>('origin')
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)

  useEffect(() => {
    setStep(mode === 'edit' ? 'form' : 'type')
    setFormPage(mode === 'edit' ? 'identity' : 'origin')
    setSourceSearch('')
    setSourceError('')
  }, [mode])

  const selectedType = useMemo(
    () => TYPE_OPTIONS.find((option) => option.type === value.tipo),
    [value.tipo],
  )

  // Cotação ao vivo (só na criação)
  useEffect(() => {
    if (mode !== 'create' || step !== 'form' || !value.tipo) {
      setQuote(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true)
      setQuoteError('')
      try {
        const { data } = await import('@/lib/supabase-browser').then((m) => m.supabase.auth.getSession())
        const token = data.session?.access_token
        const res = await fetch('/api/campeonatos/pricing-quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            tipo: value.tipo,
            numero_vagas: Number(value.numero_vagas) || 0,
            recursos: {
              export: value.recurso_export !== false,
              stream: value.recurso_stream !== false,
              rulebook: value.recurso_rulebook !== false,
              stats: value.recurso_stats !== false,
              broadcast: value.recurso_broadcast === true,
            },
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao cotar')
        if (!cancelled) setQuote(json.quote || null)
      } catch (e: any) {
        if (!cancelled) {
          setQuote(null)
          setQuoteError(e?.message || 'Cotação indisponível (rode o SQL de preços se ainda não rodou).')
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    mode,
    step,
    value.tipo,
    value.numero_vagas,
    value.recurso_export,
    value.recurso_stream,
    value.recurso_rulebook,
    value.recurso_stats,
    value.recurso_broadcast,
  ])

  function update<K extends keyof CampeonatoFormValue>(key: K, next: CampeonatoFormValue[K]) {
    onChange({ ...value, [key]: next })
  }

  function phaseNameSuggestion(index: number, total: number) {
    if (total === 1) return 'Fase 1'
    if (index === 0) return 'Fase 1'
    return `Fase ${index + 1}`
  }

  function updateInitialPhaseCount(raw: string) {
    const count = Math.max(1, Math.min(12, Number(raw) || 1))
    const current = Array.isArray(value.nomes_fases) ? value.nomes_fases : []
    onChange({
      ...value,
      numero_fases: String(count),
      nomes_fases: Array.from({ length: count }, (_, index) => current[index] || phaseNameSuggestion(index, count)),
    })
  }

  function updateInitialPhaseName(index: number, name: string) {
    const count = Math.max(1, Math.min(12, Number(value.numero_fases) || 1))
    const current = Array.isArray(value.nomes_fases) ? value.nomes_fases : []
    onChange({
      ...value,
      nomes_fases: Array.from({ length: count }, (_, itemIndex) =>
        itemIndex === index ? name : current[itemIndex] || phaseNameSuggestion(itemIndex, count),
      ),
    })
  }

  function selectType(type: ChampionshipType) {
    const nextFormat = defaultFormat(type)
    onChange({
      ...value,
      tipo: type,
      formato: nextFormat,
      origem_criacao: 'novo',
      campeonato_origem_id: '',
      franquia_origem_id: '',
      liga_usa_divisoes: type === 'liga' ? value.liga_usa_divisoes : false,
      liga_nome_agrupamento: type === 'liga' ? value.liga_nome_agrupamento || 'Divisões' : 'Divisões',
      liga_divisoes: type === 'liga' ? value.liga_divisoes : [],
    })
    setStep('form')
    setFormPage('origin')
    setSourceSearch('')
    setSourceError('')
  }

  function sourceValue(source: DropZoneRow, key: keyof CampeonatoFormValue) {
    if (key === 'nome') return String(source.name || source.data?.nome || '')
    return source.data?.[key]
  }

  const sourceCandidates = useMemo(() => {
    const term = sourceSearch.trim().toLocaleLowerCase('pt-BR')
    return championships
      .filter((item) => String(item.data?.tipo || '') === value.tipo)
      .filter((item) => !term || String(item.name || item.data?.nome || '').toLocaleLowerCase('pt-BR').includes(term))
      .slice(0, 20)
  }, [championships, sourceSearch, value.tipo])

  async function selectCreationOrigin(modeValue: 'novo' | 'modelo' | 'season') {
    setSourceError('')
    setSourceSearch('')
    onChange({
      ...value,
      origem_criacao: modeValue,
      campeonato_origem_id: '',
      franquia_origem_id: '',
      nome_historico: modeValue === 'season' ? value.nome_historico : '',
      temporada: modeValue === 'season' ? value.temporada : '',
      titulo_publico: modeValue === 'season' ? value.titulo_publico : '',
      numero_edicao: modeValue === 'season' ? value.numero_edicao : '1',
    })
  }

  async function applySourceChampionship(source: DropZoneRow) {
    setSourceLoading(true)
    setSourceError('')
    try {
      let franchiseId = ''
      let franchiseName = String(source.name || source.data?.nome || '')
      let editionNumber = 1
      if (value.origem_criacao === 'season') {
        const { data } = await import('@/lib/supabase-browser').then((module) => module.supabase.auth.getSession())
        const token = data.session?.access_token
        const response = await fetch(`/api/campeonatos/${encodeURIComponent(source.id)}/estrutura-avancada`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || 'Não foi possível carregar a season escolhida.')
        franchiseId = String(json?.franchise?.id || '')
        franchiseName = String(json?.franchise?.nome || franchiseName)
        editionNumber = Number(json?.edition?.numero_edicao || 0) + 1
      }

      const copied: CampeonatoFormValue = { ...value }
      const copyKeys: Array<keyof CampeonatoFormValue> = [
        'nome', 'logo_url', 'banner_url', 'premiacao', 'valor_inscricao', 'descricao_premiacao',
        'divisao_premiacao', 'numero_vagas', 'numero_fases', 'nomes_fases', 'formato', 'plataforma', 'servidor', 'tipo_premiacao',
        'tem_trofeu', 'tem_live', 'vagas_por_equipe', 'jogadores_por_vaga',
        'permite_jogador_multiplas_equipes', 'permite_troca_jogadores', 'data_limite_trocas',
        'data_limite_inscricao', 'aceita_novas_inscricoes_equipes', 'contatos_whatsapp',
        'pagamento_pix_ativo', 'pagamento_cartao_ativo', 'pagamento_paypal_ativo',
        'pagamento_whatsapp_ativo', 'cartao_max_parcelas', 'paypal_moedas',
        'cor_principal', 'cor_secundaria', 'bg_opacidade', 'bg_image_url',
        'recurso_export', 'recurso_stream', 'recurso_rulebook', 'recurso_stats', 'recurso_broadcast',
        'liga_usa_divisoes', 'liga_nome_agrupamento', 'liga_divisoes',
      ]
      for (const key of copyKeys) {
        const sourceField = sourceValue(source, key)
        if (sourceField !== undefined && sourceField !== null) (copied as any)[key] = sourceField
      }
      copied.tipo = value.tipo
      copied.campeonato_origem_id = source.id
      copied.origem_criacao = value.origem_criacao
      copied.franquia_origem_id = value.origem_criacao === 'season' ? franchiseId : ''
      if (value.origem_criacao === 'season') {
        copied.nome_historico = franchiseName
        copied.numero_edicao = String(Math.max(1, editionNumber))
        copied.temporada = `Season ${Math.max(1, editionNumber)}`
        copied.titulo_publico = `${franchiseName} — Season ${Math.max(1, editionNumber)}`
        copied.nome = copied.titulo_publico
      } else {
        copied.nome_historico = ''
        copied.numero_edicao = '1'
        copied.temporada = ''
        copied.titulo_publico = ''
      }
      onChange(copied)
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : 'Não foi possível usar este campeonato.')
    } finally {
      setSourceLoading(false)
    }
  }

  function updatePrizeType(nextType: string) {
    onChange({
      ...value,
      tipo_premiacao: nextType,
      premiacao: nextType === 'pix' || nextType === 'dinheiro' ? value.premiacao : '',
      descricao_premiacao: nextType === 'brinde' ? value.descricao_premiacao : '',
      divisao_premiacao: nextType === 'pix' || nextType === 'dinheiro' ? value.divisao_premiacao : '',
    })
  }

  function addWhatsappContact() {
    update('contatos_whatsapp', [
      ...value.contatos_whatsapp,
      { id: crypto.randomUUID(), nome: '', pais: 'Brasil', bandeira: '🇧🇷', ddi: '+55', telefone: '' },
    ])
  }

  function updateWhatsappContact(id: string, patch: Partial<CampeonatoWhatsappContact>) {
    update('contatos_whatsapp', value.contatos_whatsapp.map((contact) => contact.id === id ? { ...contact, ...patch } : contact))
  }

  function removeWhatsappContact(id: string) {
    update('contatos_whatsapp', value.contatos_whatsapp.filter((contact) => contact.id !== id))
  }

  function addLeagueDivision() {
    const nextOrder = value.liga_divisoes.length + 1
    update('liga_divisoes', [
      ...value.liga_divisoes,
      {
        id: crypto.randomUUID(),
        nome: `${value.liga_nome_agrupamento.replace(/s$/i, '') || 'Divisão'} ${nextOrder}`,
        codigo: '',
        ordem: nextOrder,
      },
    ])
  }

  function updateLeagueDivision(id: string, patch: Partial<CampeonatoFormValue['liga_divisoes'][number]>) {
    update('liga_divisoes', value.liga_divisoes.map((division) => division.id === id ? { ...division, ...patch } : division))
  }

  function removeLeagueDivision(id: string) {
    update('liga_divisoes', value.liga_divisoes.filter((division) => division.id !== id).map((division, index) => ({ ...division, ordem: index + 1 })))
  }

  async function submitWithImages() {
    const resolvedValue: CampeonatoFormValue = {
      ...value,
      logo_url: await resolvePendingImageUpload(value.logo_url),
      banner_url: await resolvePendingImageUpload(value.banner_url),
      bg_image_url: await resolvePendingImageUpload(value.bg_image_url),
    }
    onChange(resolvedValue)
    await onSubmit(resolvedValue)
  }

  if (step === 'type') {
    return (
      <div className="championship-type-step">
        <div className="championship-step-copy">
          <span className="championship-step-index">1 de 2</span>
          <h3>Escolha o formato</h3>
        </div>

        <div className="championship-type-cards">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                className="championship-type-card"
                type="button"
                onClick={() => selectType(option.type)}
              >
                <span className="championship-type-icon"><Icon size={26} /></span>
                <span className="championship-type-card-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="championship-type-format">{option.format}</span>
              </button>
            )
          })}
        </div>

        {onCancel ? (
          <div className="championship-type-actions">
            <button className="text-action-button" type="button" onClick={onCancel}>Cancelar</button>
          </div>
        ) : null}
      </div>
    )
  }

  const wizardPages: Array<{ id: typeof formPage; label: string }> = mode === 'edit'
    ? [
        { id: 'identity', label: 'Identidade' },
        { id: 'season', label: 'Temporada' },
        { id: 'format', label: 'Formato' },
        { id: 'operation', label: 'Operação' },
      ]
    : [
        { id: 'origin', label: 'Origem' },
        { id: 'identity', label: 'Identidade' },
        ...(value.origem_criacao === 'season' || value.tipo === 'liga'
          ? [{ id: 'season' as const, label: 'Temporada' }]
          : []),
        ...(['liga', 'xtreino', 'confronto'].includes(value.tipo)
          ? [{ id: 'format' as const, label: value.tipo === 'liga' ? 'Liga' : 'Formato' }]
          : []),
        { id: 'operation', label: 'Operação' },
        { id: 'review', label: 'Revisão' },
      ]
  const currentPageIndex = Math.max(0, wizardPages.findIndex((page) => page.id === formPage))
  const pageVisible = (page: typeof formPage) => mode === 'edit' || formPage === page
  function goNext() {
    if (formPage === 'origin' && value.origem_criacao !== 'novo' && !value.campeonato_origem_id) return
    if (formPage === 'identity' && (!value.nome.trim() || !value.logo_url)) return
    const next = wizardPages[currentPageIndex + 1]
    if (next) setFormPage(next.id)
  }
  function goBack() {
    const previous = wizardPages[currentPageIndex - 1]
    if (previous) setFormPage(previous.id)
    else if (mode === 'create') setStep('type')
  }

  const showMoneyPrize = value.tipo_premiacao === 'pix' || value.tipo_premiacao === 'dinheiro'
  const showGiftPrize = value.tipo_premiacao === 'brinde'

  return (
    <div className="championship-form-stack">
      <div className="championship-form-progress">
        <div>
          <p className="eyebrow">Assistente de criação · etapa {currentPageIndex + 1} de {wizardPages.length}</p>
          <strong>{selectedType?.title || CHAMPIONSHIP_TYPE_LABELS[value.tipo as ChampionshipType] || 'Campeonato'}</strong>
          <small>{selectedType?.description}</small>
        </div>
        {mode === 'create' ? (
          <button className="text-action-button" type="button" onClick={() => setStep('type')}>
            <ArrowLeft size={15} /> Alterar tipo
          </button>
        ) : null}
      </div>

      {mode === 'create' ? (
        <div className="championship-wizard-steps" aria-label="Etapas da criação">
          {wizardPages.map((page, index) => (
            <button
              type="button"
              key={page.id}
              className={`${formPage === page.id ? 'active' : ''} ${index < currentPageIndex ? 'done' : ''}`}
              onClick={() => index <= currentPageIndex && setFormPage(page.id)}
            >
              <span>{index + 1}</span>{page.label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'create' ? (
        <section className="form-section-card championship-origin-card" hidden={!pageVisible('origin')}>
          <p className="eyebrow">Como deseja criar?</p>
          <div className="championship-origin-options">
            <button
              type="button"
              className={value.origem_criacao === 'novo' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => void selectCreationOrigin('novo')}
            >
              <strong>Criar do zero</strong>
              <small>Comece um campeonato totalmente novo.</small>
            </button>
            <button
              type="button"
              className={value.origem_criacao === 'modelo' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => void selectCreationOrigin('modelo')}
            >
              <strong>Usar como modelo</strong>
              <small>Copie os dados de outro {selectedType?.title?.toLocaleLowerCase('pt-BR') || 'campeonato'} e altere antes de salvar.</small>
            </button>
            <button
              type="button"
              className={value.origem_criacao === 'season' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => void selectCreationOrigin('season')}
            >
              <strong>Criar nova season</strong>
              <small>Crie uma nova edição ligada ao histórico da competição escolhida.</small>
            </button>
          </div>

          {value.origem_criacao !== 'novo' ? (
            <div className="championship-source-picker">
              <Field label={`Pesquisar ${selectedType?.title || 'campeonato'} da sua produtora`}>
                <input
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder={`Digite o nome de um campeonato do tipo ${selectedType?.title || value.tipo}`}
                />
              </Field>
              <div className="championship-source-results">
                {sourceCandidates.length ? sourceCandidates.map((source) => (
                  <button
                    type="button"
                    key={source.id}
                    disabled={sourceLoading}
                    className={value.campeonato_origem_id === source.id ? 'championship-source-item active' : 'championship-source-item'}
                    onClick={() => void applySourceChampionship(source)}
                  >
                    <span className="championship-source-logo">
                      {String(source.data?.logo_url || '') ? <img src={String(source.data?.logo_url)} alt="" /> : <Trophy size={18} />}
                    </span>
                    <span className="championship-source-copy">
                      <strong>{String(source.name || source.data?.nome || 'Campeonato')}</strong>
                      <small>{value.origem_criacao === 'season' ? 'Continuar como nova temporada' : 'Copiar como modelo independente'}</small>
                    </span>
                    <span className="championship-source-action">
                      {value.campeonato_origem_id === source.id ? 'Selecionado' : 'Selecionar'}
                    </span>
                  </button>
                )) : (
                  <p className="form-empty-note">Nenhum campeonato desse tipo foi encontrado nesta produtora.</p>
                )}
              </div>
              {sourceLoading ? <p className="form-empty-note">Carregando campeonato escolhido...</p> : null}
              {sourceError ? <div className="message error">{sourceError}</div> : null}
              {value.campeonato_origem_id ? (
                <div className="message">
                  {value.origem_criacao === 'season'
                    ? 'Season anterior selecionada. Os dados foram copiados e a nova edição continuará ligada à mesma competição.'
                    : 'Modelo selecionado. Os campos foram preenchidos, mas o novo campeonato será independente.'}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="form-empty-note">Você preencherá apenas os campos necessários para o tipo escolhido.</p>
          )}
        </section>
      ) : null}

      <section className="form-section-card" hidden={!pageVisible('identity')}>
        <p className="eyebrow">Dados obrigatórios</p>
        <div className="mini-grid two">
          <Field label="Nome do campeonato"><input required value={value.nome} onChange={(e) => update('nome', e.target.value)} /></Field>
          <UploadField label="Logo do campeonato *" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
          <UploadField label="Banner do campeonato" value={value.banner_url} bucket="campeonato" cropTarget="campeonato_banner" onChange={(url) => update('banner_url', url)} onUpload={uploadPublicFile} />
        </div>
      </section>

      <section className="form-section-card" hidden={!pageVisible('identity')}>
        <p className="eyebrow">Identidade visual</p>
        <p className="empty" style={{ margin: '0 0 12px' }}>
          Escolha 2 cores, a intensidade do fundo e (opcional) uma imagem de background. O sistema usa a cor{' '}
          <strong>mais escura</strong> nos botões, aplica a opacidade no BG e calcula o contraste do texto.
        </p>
        <div className="mini-grid two">
          <Field label="Cor A">
            <div className="color-field-row">
              <input type="color" value={value.cor_principal || '#ff4655'} onChange={(e) => update('cor_principal', e.target.value)} />
              <input value={value.cor_principal || ''} onChange={(e) => update('cor_principal', e.target.value)} placeholder="#ff4655" />
            </div>
          </Field>
          <Field label="Cor B">
            <div className="color-field-row">
              <input type="color" value={value.cor_secundaria || '#17191d'} onChange={(e) => update('cor_secundaria', e.target.value)} />
              <input value={value.cor_secundaria || ''} onChange={(e) => update('cor_secundaria', e.target.value)} placeholder="#17191d" />
            </div>
          </Field>
        </div>
        <div className="mini-grid two" style={{ marginTop: 12 }}>
          <Field label={`Opacidade do fundo (${value.bg_opacidade || 18}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Number(value.bg_opacidade || 18)}
              onChange={(e) => update('bg_opacidade', e.target.value)}
            />
            <div className="color-field-row" style={{ marginTop: 8 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={value.bg_opacidade || '18'}
                onChange={(e) => update('bg_opacidade', e.target.value)}
                style={{ gridColumn: '1 / -1' }}
              />
            </div>
          </Field>
          <UploadField
            label="Imagem de fundo (opcional)"
            value={value.bg_image_url}
            bucket="campeonato"
            onChange={(url) => update('bg_image_url', url)}
            onUpload={uploadPublicFile}
          />
        </div>
        <div
          className="champ-theme-preview champ-theme"
          style={championshipThemeStyle({
            cor_principal: value.cor_principal,
            cor_secundaria: value.cor_secundaria,
            bg_opacidade: value.bg_opacidade,
            bg_image_url: value.bg_image_url,
          })}
        >
          <div className="champ-theme-preview-banner">Prévia do banner</div>
          <div className="champ-theme-preview-body">
            <div>
              <strong>Área clara do layout</strong>
              <small style={{ display: 'block', marginTop: 4, opacity: 0.75 }}>
                Botão = cor mais escura · BG com {value.bg_opacidade || 18}%
              </small>
            </div>
            <button type="button" className="champ-theme-preview-btn">Botão principal</button>
          </div>
        </div>
      </section>

      <section className="form-section-card" hidden={!pageVisible('season')}>
        <p className="eyebrow">Temporada e edição</p>
        <p className="empty" style={{ margin: '0 0 12px' }}>
          Use esta etapa para identificar seasons, edições anuais ou ciclos recorrentes. Os campos são opcionais.
        </p>
        <div className="mini-grid two">
          <Field label="Nome histórico da competição">
            <input value={value.nome_historico} onChange={(event) => update('nome_historico', event.target.value)} placeholder={value.nome || 'Ex.: Liga ALOE'} />
          </Field>
          <Field label="Título público desta edição">
            <input value={value.titulo_publico} onChange={(event) => update('titulo_publico', event.target.value)} placeholder="Ex.: Liga ALOE — Ouro 2026" />
          </Field>
          <Field label="Season / temporada">
            <input value={value.temporada} onChange={(event) => update('temporada', event.target.value)} placeholder="Ex.: Temporada 2026 ou Season 3" />
          </Field>
          <Field label="Número da edição">
            <input type="number" min="1" value={value.numero_edicao} onChange={(event) => update('numero_edicao', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="form-section-card" hidden={!pageVisible('format')}>
        <p className="eyebrow">Formato inicial</p>
        <div className="mini-grid three">
          <Field label="Limite de vagas (meta)">
            <input
              type="number"
              min="1"
              value={value.numero_vagas}
              onChange={(e) => update('numero_vagas', e.target.value)}
              placeholder="Ex.: 96 — não cria slots; só limita"
            />
          </Field>

          <Field label="Fases iniciais">
            <input
              type="number"
              min="1"
              max="12"
              value={value.numero_fases || '1'}
              onChange={(e) => updateInitialPhaseCount(e.target.value)}
              placeholder="Ex.: 2"
            />
          </Field>

          {value.tipo === 'liga' ? (
            <Field label="Modelo da liga">
              <select
                value={value.liga_usa_divisoes ? 'divisoes' : 'simples'}
                onChange={(event) => {
                  const useDivisions = event.target.value === 'divisoes'
                  onChange({
                    ...value,
                    liga_usa_divisoes: useDivisions,
                    liga_divisoes: useDivisions && !value.liga_divisoes.length
                      ? [{ id: crypto.randomUUID(), nome: 'Divisão 1', codigo: '', ordem: 1 }]
                      : value.liga_divisoes,
                    formato: useDivisions ? 'Liga híbrida por divisões' : 'Pontos corridos',
                  })
                }}
              >
                <option value="simples">Liga simples — pontos corridos</option>
                <option value="divisoes">Liga com divisões, séries ou categorias</option>
              </select>
            </Field>
          ) : value.tipo === 'xtreino' ? (
            <Field label="Formato do X-Treino">
              <select value={value.formato} onChange={(e) => update('formato', e.target.value)}>
                <option value="Jogo único">Jogo único</option>
                <option value="Mata-mata">Mata-mata</option>
                <option value="Pontos corridos">Pontos corridos</option>
              </select>
            </Field>
          ) : value.tipo === 'confronto' ? (
            <Field label="Modo do confronto">
              <select value={value.formato} onChange={(e) => update('formato', e.target.value)}>
                <option value="Confronto direto 4x4 - Tático">Tático</option>
                <option value="Confronto direto 4x4 - UMP">UMP</option>
                <option value="Confronto direto 4x4 - Personalizado">Personalizado</option>
              </select>
            </Field>
          ) : (
            <Field label="Formato definido pelo tipo"><input value={value.tipo === 'copa' ? 'Mata-mata' : 'Jogo único'} readOnly /></Field>
          )}

          <Field label="Plataforma">
            <select value={value.plataforma} onChange={(e) => update('plataforma', e.target.value)}>
              <option value="">Selecione</option>
              <option value="mobile">Mobile</option>
              <option value="emulador">Emulador</option>
              <option value="misto">Misto</option>
            </select>
          </Field>
          <Field label="Servidor"><input value={value.servidor} onChange={(e) => update('servidor', e.target.value)} placeholder="Ex.: Brasil" /></Field>
        </div>
        <div className="form-initial-phases">
          <div className="form-section-heading">
            <div>
              <p className="eyebrow">Sincronização com Grupos e fases</p>
              <strong>Estas fases serão criadas automaticamente</strong>
            </div>
          </div>
          <p className="form-empty-note">
            As vagas comerciais contam somente a fase de entrada. Fases posteriores são avanço/classificação e não entram como vagas livres.
          </p>
          <div className="mini-grid three">
            {Array.from({ length: Math.max(1, Math.min(12, Number(value.numero_fases) || 1)) }).map((_, index) => (
              <Field label={`Nome da fase ${index + 1}`} key={index}>
                <input
                  value={(Array.isArray(value.nomes_fases) ? value.nomes_fases[index] : '') || phaseNameSuggestion(index, Number(value.numero_fases) || 1)}
                  onChange={(event) => updateInitialPhaseName(index, event.target.value)}
                  placeholder={`Fase ${index + 1}`}
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      {value.tipo === 'liga' && pageVisible('format') && value.liga_usa_divisoes ? (
        <section className="form-section-card league-organization-card">
          <div className="form-section-heading">
            <div>
              <p className="eyebrow">Organização da liga</p>
              <strong>Defina como os níveis serão chamados</strong>
            </div>
          </div>
          <p className="form-empty-note">
            Você pode usar Série A/B/C, Bronze/Prata/Ouro, Elite/Challenger ou qualquer nome próprio.
          </p>
          <div className="mini-grid two">
            <Field label="Nome do agrupamento">
              <select
                value={['Séries', 'Divisões', 'Categorias', 'Níveis', 'Conferências', 'Circuitos'].includes(value.liga_nome_agrupamento) ? value.liga_nome_agrupamento : 'Personalizado'}
                onChange={(event) => update('liga_nome_agrupamento', event.target.value === 'Personalizado' ? '' : event.target.value)}
              >
                <option value="Divisões">Divisões</option>
                <option value="Séries">Séries</option>
                <option value="Categorias">Categorias</option>
                <option value="Níveis">Níveis</option>
                <option value="Conferências">Conferências</option>
                <option value="Circuitos">Circuitos</option>
                <option value="Personalizado">Nome personalizado</option>
              </select>
            </Field>
            <Field label="Nome exibido">
              <input
                value={value.liga_nome_agrupamento}
                onChange={(event) => update('liga_nome_agrupamento', event.target.value)}
                placeholder="Ex.: Copas, Faixas ou Classes"
              />
            </Field>
          </div>
          <div className="league-division-list">
            {value.liga_divisoes.map((division, index) => (
              <div className="league-division-row" key={division.id}>
                <span className="league-division-order">{index + 1}</span>
                <Field label="Nome">
                  <input value={division.nome} onChange={(event) => updateLeagueDivision(division.id, { nome: event.target.value })} placeholder="Ex.: Ouro" />
                </Field>
                <Field label="Código opcional">
                  <input value={division.codigo} onChange={(event) => updateLeagueDivision(division.id, { codigo: event.target.value })} placeholder="Ex.: OURO" />
                </Field>
                <button className="inline-icon-button" type="button" onClick={() => removeLeagueDivision(division.id)} aria-label={`Remover ${division.nome || 'divisão'}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button className="button secondary" type="button" onClick={addLeagueDivision}>
            <Plus size={15} /> Adicionar {value.liga_nome_agrupamento.replace(/s$/i, '').toLocaleLowerCase('pt-BR') || 'divisão'}
          </button>
          <p className="form-empty-note">
            Datas, vendas, fases, promoção e rebaixamento de cada item serão configurados na próxima etapa da criação da Liga.
          </p>
        </section>
      ) : null}


      <section className="form-section-card" hidden={!pageVisible('operation')}>
        <p className="eyebrow">Premiação e inscrição</p>
        <div className="mini-grid three">
          <Field label="Tipo de premiação">
            <select value={value.tipo_premiacao} onChange={(e) => updatePrizeType(e.target.value)}>
              <option value="sem_premiacao">Sem premiação</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="brinde">Brinde</option>
            </select>
          </Field>

          {showMoneyPrize ? (
            <Field label="Valor da premiação">
              <input
                inputMode="numeric"
                value={moneyDisplay(value.premiacao)}
                onChange={(e) => update('premiacao', moneyValue(e.target.value))}
                placeholder="R$ 0,00"
              />
            </Field>
          ) : null}

          <Field label="Valor da inscrição">
            <input
              inputMode="numeric"
              value={moneyDisplay(value.valor_inscricao)}
              onChange={(e) => update('valor_inscricao', moneyValue(e.target.value))}
              placeholder="R$ 0,00"
            />
          </Field>
        </div>

        {showGiftPrize ? (
          <Field label="Descrição do brinde"><textarea value={value.descricao_premiacao} onChange={(e) => update('descricao_premiacao', e.target.value)} placeholder="Ex.: troféu, camisa personalizada e kit gamer" /></Field>
        ) : null}

        {showMoneyPrize ? (
          <PremiacaoDivisaoEditor
            totalPremiacao={value.premiacao}
            value={value.divisao_premiacao}
            onChange={(serialized) => update('divisao_premiacao', serialized)}
            disabled={loading}
          />
        ) : null}

        <div className="checkbox-row">
          <label><input type="checkbox" checked={value.tem_trofeu} onChange={(e) => update('tem_trofeu', e.target.checked)} /> Tem troféu</label>
          <label><input type="checkbox" checked={value.tem_live} onChange={(e) => update('tem_live', e.target.checked)} /> Tem transmissão ao vivo</label>
        </div>
      </section>

      <section className="form-section-card" hidden={!pageVisible('operation')}>
        <p className="eyebrow">Controle de inscrições</p>
        <div className="mini-grid three">
          <Field label="Vagas por equipe"><input type="number" min="1" value={value.vagas_por_equipe} onChange={(e) => update('vagas_por_equipe', e.target.value)} /></Field>
          <Field label="Players por vaga"><input type="number" min="1" value={value.jogadores_por_vaga} onChange={(e) => update('jogadores_por_vaga', e.target.value)} /></Field>
          <Field label="Data limite de inscrição"><input type="datetime-local" value={value.data_limite_inscricao} onChange={(e) => update('data_limite_inscricao', e.target.value)} /></Field>
        </div>
        <div className="checkbox-row">
          <label><input type="checkbox" checked={value.aceita_novas_inscricoes_equipes} onChange={(e) => update('aceita_novas_inscricoes_equipes', e.target.checked)} /> Aceitar novas inscrições de equipes</label>
          <label><input type="checkbox" checked={value.permite_jogador_multiplas_equipes} onChange={(e) => update('permite_jogador_multiplas_equipes', e.target.checked)} /> Permitir jogador em mais de uma line</label>
          <label><input type="checkbox" checked={value.permite_troca_jogadores} onChange={(e) => update('permite_troca_jogadores', e.target.checked)} /> Permitir troca de jogadores</label>
        </div>
        {value.permite_troca_jogadores ? (
          <Field label="Data limite para troca de jogadores"><input type="datetime-local" value={value.data_limite_trocas} onChange={(e) => update('data_limite_trocas', e.target.value)} /></Field>
        ) : null}
      </section>

      <section className="form-section-card" hidden={!pageVisible('operation')}>
        <div className="form-section-heading">
          <div>
            <p className="eyebrow">Pagamento da vaga</p>
            <strong>Meios aceitos neste campeonato</strong>
          </div>
        </div>
        <p className="empty" style={{ margin: '0 0 12px' }}>
          A Lili mostrará somente as opções ativadas abaixo. Em campeonato gratuito, não será exibida cobrança.
        </p>
        <div className="championship-resource-grid">
          <label className="championship-resource-toggle">
            <input type="checkbox" checked={value.pagamento_pix_ativo} onChange={(e) => update('pagamento_pix_ativo', e.target.checked)} />
            <span><QrCode size={15} /> PIX</span>
          </label>
          <label className="championship-resource-toggle">
            <input type="checkbox" checked={value.pagamento_cartao_ativo} onChange={(e) => update('pagamento_cartao_ativo', e.target.checked)} />
            <span><CreditCard size={15} /> Cartão</span>
          </label>
          <label className="championship-resource-toggle">
            <input type="checkbox" checked={value.pagamento_paypal_ativo} onChange={(e) => update('pagamento_paypal_ativo', e.target.checked)} />
            <span><WalletCards size={15} /> PayPal</span>
          </label>
          <label className="championship-resource-toggle">
            <input type="checkbox" checked={value.pagamento_whatsapp_ativo} onChange={(e) => update('pagamento_whatsapp_ativo', e.target.checked)} />
            <span><MessageCircle size={15} /> WhatsApp</span>
          </label>
        </div>

        {value.pagamento_cartao_ativo ? (
          <Field label="Máximo de parcelas no cartão">
            <select value={value.cartao_max_parcelas} onChange={(e) => update('cartao_max_parcelas', e.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((installment) => (
                <option value={String(installment)} key={installment}>{installment === 1 ? 'À vista' : `Até ${installment}x`}</option>
              ))}
            </select>
          </Field>
        ) : null}

        {value.pagamento_paypal_ativo ? (
          <Field label="Moedas aceitas no PayPal">
            <div className="checkbox-row">
              {(['BRL', 'USD', 'EUR'] as const).map((currency) => (
                <label key={currency}>
                  <input
                    type="checkbox"
                    checked={value.paypal_moedas.includes(currency)}
                    onChange={(event) => update(
                      'paypal_moedas',
                      event.target.checked
                        ? [...new Set([...value.paypal_moedas, currency])]
                        : value.paypal_moedas.filter((item) => item !== currency),
                    )}
                  /> {currency}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
      </section>

      <section className="form-section-card whatsapp-contacts-section" hidden={!pageVisible('operation')}>
        <div className="form-section-heading">
          <div><p className="eyebrow">Venda de vagas</p><strong>Contatos do WhatsApp</strong></div>
          <button className="button secondary" type="button" onClick={addWhatsappContact}><Plus size={15} /> Adicionar contato</button>
        </div>
        {value.contatos_whatsapp.length ? (
          <div className="whatsapp-contact-list">
            {value.contatos_whatsapp.map((contact) => (
              <div className="whatsapp-contact-row" key={contact.id}>
                <Field label="Nome do vendedor"><input value={contact.nome} onChange={(event) => updateWhatsappContact(contact.id, { nome: event.target.value })} placeholder="Ex.: Paulo" /></Field>
                <Field label="País do contato">
                  <select value={contact.ddi} onChange={(event) => {
                    const country = WHATSAPP_COUNTRIES.find((item) => item.ddi === event.target.value) || WHATSAPP_COUNTRIES[0]
                    updateWhatsappContact(contact.id, country)
                  }}>
                    {WHATSAPP_COUNTRIES.map((country) => <option value={country.ddi} key={country.ddi}>{country.bandeira} {country.pais} ({country.ddi})</option>)}
                  </select>
                </Field>
                <Field label="Contato">
                  <div className="phone-input-group"><span>{contact.bandeira} {contact.ddi}</span><input inputMode="tel" value={contact.telefone} onChange={(event) => updateWhatsappContact(contact.id, { telefone: event.target.value.replace(/[^0-9 ()-]/g, '') })} placeholder="(91) 99999-9999" /></div>
                </Field>
                <button className="inline-icon-button whatsapp-contact-remove" type="button" onClick={() => removeWhatsappContact(contact.id)} aria-label={`Remover contato de ${contact.nome || 'vendedor'}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : <p className="form-empty-note">Nenhum contato de venda cadastrado.</p>}
      </section>

      {mode === 'create' && formPage === 'review' ? (
        <section className="form-section-card championship-review-card">
          <p className="eyebrow">Revisão da criação</p>
          <div className="championship-review-grid">
            <div><small>Campeonato</small><strong>{value.nome || 'Não informado'}</strong></div>
            <div><small>Tipo</small><strong>{selectedType?.title || value.tipo}</strong></div>
            <div><small>Temporada</small><strong>{value.temporada || 'Sem temporada definida'}</strong></div>
            <div><small>Edição</small><strong>{value.numero_edicao || '1'}</strong></div>
            <div><small>Vagas</small><strong>{value.numero_vagas || 'Não definidas'}</strong></div>
            <div><small>Fases iniciais</small><strong>{Math.max(1, Number(value.numero_fases) || 1)}</strong></div>
            <div><small>Formato</small><strong>{value.formato || defaultFormat(value.tipo)}</strong></div>
            {value.tipo === 'liga' ? (
              <div><small>Organização</small><strong>{value.liga_usa_divisoes ? `${value.liga_divisoes.length} ${value.liga_nome_agrupamento || 'divisões'}` : 'Liga simples'}</strong></div>
            ) : null}
          </div>
          <p className="form-empty-note">As fases iniciais serão criadas automaticamente. Depois você ajusta grupos, slots, datas e progressão na aba Grupos e fases.</p>
        </section>
      ) : null}

      {mode === 'create' ? (
        <section className="form-section-card championship-pricing-card" hidden={!pageVisible('review')}>
          <p className="eyebrow">Pacote DropZone · valor estimado</p>
          <p className="empty" style={{ margin: '0 0 12px' }}>
            O campeonato fica <strong>pendente de aprovação</strong> do admin do sistema. O valor abaixo é a
            cotação automática (base + vagas + recursos).
          </p>
          <div className="championship-resource-grid">
            {(
              [
                ['recurso_export', 'Export / Spec'],
                ['recurso_stream', 'Overlays Stream'],
                ['recurso_rulebook', 'Rulebook PDF'],
                ['recurso_stats', 'Tabelas e stats'],
                ['recurso_broadcast', 'Broadcast pack'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="championship-resource-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(value[key])}
                  onChange={(e) => update(key, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="championship-quote-box">
            {quoteLoading ? <small>Calculando…</small> : null}
            {quoteError ? <small className="error-text">{quoteError}</small> : null}
            {quote ? (
              <>
                <ul className="championship-quote-lines">
                  {quote.linhas.map((line) => (
                    <li key={`${line.chave}-${line.qtd || 1}`}>
                      <span>
                        {line.rotulo}
                        {line.qtd && line.qtd > 1 ? ` × ${line.qtd}` : ''}
                      </span>
                      <strong>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          line.valor_centavos / 100,
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="championship-quote-total">
                  <span>Total estimado</span>
                  <strong>{quote.valor_total_brl}</strong>
                </div>
              </>
            ) : !quoteLoading && !quoteError ? (
              <small>Informe tipo e vagas para ver a cotação.</small>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="button-row championship-wizard-actions">
        {mode === 'create' ? <button className="button secondary" type="button" onClick={goBack} disabled={loading}>Voltar</button> : null}
        {mode === 'create' && formPage !== 'review' ? (
          <button className="button" type="button" onClick={goNext} disabled={loading || (formPage === 'origin' && value.origem_criacao !== 'novo' && !value.campeonato_origem_id) || (formPage === 'identity' && (!value.nome.trim() || !value.logo_url))}>Continuar</button>
        ) : (
          <button className="button" type="button" onClick={() => void submitWithImages()} disabled={loading}>{mode === 'edit' ? 'Salvar alterações' : 'Criar campeonato'}</button>
        )}
        {onCancel ? <button className="button secondary" type="button" onClick={onCancel} disabled={loading}>Cancelar</button> : null}
      </div>
    </div>
  )
}
