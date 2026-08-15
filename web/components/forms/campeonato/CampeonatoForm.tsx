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
  /** Estado explícito para selecionar "Paga" antes de informar o valor. */
  inscricao_paga?: boolean
  descricao_premiacao: string
  divisao_premiacao: string
  numero_vagas: string
  diario_equipes_por_horario?: string
  /** Sistema de pontuação usado em todas as súmulas deste campeonato. */
  sistema_pontuacao_tipo: 'garena' | 'personalizado'
  sistema_pontuacao_nome: string
  pontuacao_equipes_por_partida: string
  pontos_colocacao: string[]
  pontos_por_abate: string
  numero_fases: string
  nomes_fases: string[]
  estrutura_planejada: CampeonatoStructurePhase[]
  formato: string
  /** Quantidade padrão de partidas em cada jogo criado pelo assistente */
  partidas_por_jogo?: string
  /** Quantidade de partidas da final quando for diferente das fases anteriores */
  partidas_final?: string
  final_dias?: string
  final_dias_config?: Array<{ dia: number; quedas: string }>
  final_quedas_por_dia?: string
  final_formato?: 'pontos_corridos' | 'champion_point' | 'point_rush' | 'point_rush_champion_point' | 'personalizado'
  final_champion_point_pontos?: string
  final_point_rush_dias?: string
  final_bonus_ranking?: Array<{ posicao: number; pontos_bonus: string }>
  final_observacoes?: string
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
    equipes: string
    valor_inscricao: string
    premiacao: string
  }>
}

export type CampeonatoStructurePhase = {
  nome: string
  grupos: string
  equipes_por_grupo: string
  classificam_por_grupo: string
  oculta?: boolean
  diario_horarios?: Array<{ id: string; horario: string }>
  final_dias_config?: Array<{ dia: number; quedas: string }>
  final_formato?: CampeonatoFormValue['final_formato']
  final_champion_point_pontos?: string
  final_point_rush_dias?: string
  final_bonus_ranking?: Array<{ posicao: number; pontos_bonus: string }>
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

export const OFFICIAL_GARENA_SCORING = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0] as const

function scoringPointsForCount(count: number, source: ReadonlyArray<string | number> = []) {
  return Array.from({ length: Math.max(2, Math.min(15, count)) }, (_, index) =>
    source[index] == null ? '' : String(source[index]),
  )
}

export const emptyCampeonatoForm: CampeonatoFormValue = {
  nome: '',
  tipo: '',
  logo_url: '',
  banner_url: '',
  premiacao: '',
  valor_inscricao: '',
  inscricao_paga: false,
  descricao_premiacao: '',
  divisao_premiacao: '',
  numero_vagas: '',
  diario_equipes_por_horario: '12',
  sistema_pontuacao_tipo: 'garena',
  sistema_pontuacao_nome: 'Oficial Garena',
  pontuacao_equipes_por_partida: '12',
  pontos_colocacao: OFFICIAL_GARENA_SCORING.map(String),
  pontos_por_abate: '1',
  numero_fases: '1',
  nomes_fases: ['Fase 1'],
  estrutura_planejada: [],
  formato: '',
  partidas_por_jogo: '4',
  partidas_final: '6',
  final_dias: '1',
  final_dias_config: [{ dia: 1, quedas: '6' }],
  final_quedas_por_dia: '6',
  final_formato: 'pontos_corridos',
  final_champion_point_pontos: '160',
  final_point_rush_dias: '1',
  final_bonus_ranking: [
    { posicao: 1, pontos_bonus: '12' },
    { posicao: 2, pontos_bonus: '9' },
    { posicao: 3, pontos_bonus: '8' },
  ],
  final_observacoes: '',
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
  cor_principal: '#c9b766',
  cor_secundaria: '#141518',
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

const THEME_PALETTES = [
  { name: 'DropZone', primary: '#c9b766', secondary: '#141518' },
  { name: 'Arena', primary: '#d94d5c', secondary: '#191317' },
  { name: 'Elite', primary: '#3b82f6', secondary: '#111827' },
  { name: 'Tático', primary: '#22a06b', secondary: '#112119' },
  { name: 'Pro', primary: '#8b5cf6', secondary: '#181326' },
] as const

function defaultFormat(type: string) {
  return TYPE_OPTIONS.find((option) => option.type === type)?.format || ''
}

function suggestedPhaseName(type: string, index: number, total: number) {
  if (total === 1) return type === 'diario' ? 'Rodada única' : type === 'copa' ? 'Fase classificatória' : 'Fase 1'
  if (index === total - 1) return 'Final'
  return index === 0 ? 'Fase classificatória' : `Fase ${index + 1}`
}

function defaultStructurePlan(type: string, count = 1, current: CampeonatoStructurePhase[] = []) {
  return Array.from({ length: count }, (_, index) => {
    const existing = current[index]
    const isCup = type === 'copa'
    return {
      nome: existing?.nome || suggestedPhaseName(type, index, count),
      grupos: existing?.grupos || (isCup && index === 0 ? '8' : '1'),
      equipes_por_grupo: existing?.equipes_por_grupo || (type === 'confronto' ? '2' : '12'),
      classificam_por_grupo: existing?.classificam_por_grupo || (isCup && index < count - 1 ? '6' : ''),
    }
  })
}

function guidedCupPlan(totalRaw: string, perGroupRaw: string, advanceRaw: string): CampeonatoStructurePhase[] {
  const total = Math.max(2, Number(totalRaw) || 96)
  const perGroup = Math.max(2, Number(perGroupRaw) || 12)
  const advance = Math.max(1, Math.min(perGroup - 1, Number(advanceRaw) || 6))
  const phases: CampeonatoStructurePhase[] = []
  let teams = total
  let guard = 0

  while (teams > perGroup && guard < 10) {
    const groups = Math.max(1, Math.ceil(teams / perGroup))
    const qualified = groups * advance
    phases.push({
      nome: phases.length === 0 ? 'Fase classificatória' : `Fase ${phases.length + 1}`,
      grupos: String(groups),
      equipes_por_grupo: String(perGroup),
      classificam_por_grupo: String(advance),
    })
    if (qualified >= teams) break
    teams = qualified
    guard += 1
  }

  phases.push({
    nome: 'Final',
    grupos: '1',
    equipes_por_grupo: String(Math.max(2, teams)),
    classificam_por_grupo: '',
  })

  return phases
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
  const [formPage, setFormPage] = useState<'origin' | 'identity' | 'season' | 'format' | 'matches' | 'operation' | 'scoring' | 'review'>('origin')
  const [originChoice, setOriginChoice] = useState<'novo' | 'modelo' | 'season' | null>(mode === 'edit' ? value.origem_criacao : null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [wizardError, setWizardError] = useState('')

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
    const structurePlan = defaultStructurePlan(value.tipo, count, value.estrutura_planejada)
    onChange({
      ...value,
      numero_fases: String(count),
      nomes_fases: Array.from({ length: count }, (_, index) => current[index] || structurePlan[index]?.nome || phaseNameSuggestion(index, count)),
      estrutura_planejada: structurePlan,
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
      estrutura_planejada: defaultStructurePlan(value.tipo, count, value.estrutura_planejada).map((phase, itemIndex) => itemIndex === index ? { ...phase, nome: name } : phase),
    })
  }

  function updateStructurePhase(index: number, patch: Partial<CampeonatoStructurePhase>) {
    const count = Math.max(1, Math.min(12, Number(value.numero_fases) || 1))
    const next = defaultStructurePlan(value.tipo, count, value.estrutura_planejada)
      .map((phase, itemIndex) => itemIndex === index ? { ...phase, ...patch } : phase)
    onChange({
      ...value,
      estrutura_planejada: next,
      nomes_fases: next.map((phase, itemIndex) => phase.nome || phaseNameSuggestion(itemIndex, count)),
    })
  }

  function normalizedDailySchedules(source = value.estrutura_planejada[0]?.diario_horarios) {
    return Array.isArray(source) && source.length
      ? source.map((item, index) => ({ id: String(item.id || `horario-${index + 1}`), horario: String(item.horario || '') }))
      : [{ id: 'horario-1', horario: '19:00' }]
  }

  function updateGuidedDaily(capacityRaw: string, schedulesRaw = normalizedDailySchedules()) {
    const capacity = Math.max(2, Math.min(52, Number(capacityRaw) || 12))
    const schedules = normalizedDailySchedules(schedulesRaw)
    const totalVacancies = capacity * schedules.length
    const plan: CampeonatoStructurePhase[] = [{
      nome: 'Fase 1',
      grupos: String(schedules.length),
      equipes_por_grupo: String(capacity),
      classificam_por_grupo: '',
      oculta: true,
      diario_horarios: schedules,
    }]
    onChange({
      ...value,
      numero_vagas: String(totalVacancies),
      diario_equipes_por_horario: String(capacity),
      numero_fases: '1',
      nomes_fases: ['Fase 1'],
      estrutura_planejada: plan,
      formato: 'Jogos únicos por horário',
    })
  }

  function addDailySchedule() {
    const schedules = normalizedDailySchedules()
    const last = schedules.at(-1)?.horario || '18:00'
    const [hourRaw, minuteRaw] = last.split(':')
    const nextHour = (Number(hourRaw || 18) + 1) % 24
    const suggested = `${String(nextHour).padStart(2, '0')}:${String(Number(minuteRaw || 0)).padStart(2, '0')}`
    updateGuidedDaily(value.diario_equipes_por_horario || '12', [...schedules, { id: crypto.randomUUID(), horario: suggested }])
  }

  function updateDailySchedule(id: string, horario: string) {
    updateGuidedDaily(value.diario_equipes_por_horario || '12', normalizedDailySchedules().map((item) => item.id === id ? { ...item, horario } : item))
  }

  function removeDailySchedule(id: string) {
    const schedules = normalizedDailySchedules().filter((item) => item.id !== id)
    if (!schedules.length) return setWizardError('O Diário precisa ter pelo menos um horário.')
    updateGuidedDaily(value.diario_equipes_por_horario || '12', schedules)
  }

  function updateGuidedCup(
    totalRaw = value.numero_vagas || '96',
    perGroupRaw = value.estrutura_planejada[0]?.equipes_por_grupo || '12',
    advanceRaw = value.estrutura_planejada[0]?.classificam_por_grupo || '6',
  ) {
    const total = String(Math.max(2, Number(totalRaw) || 96))
    const perGroup = String(Math.max(2, Number(perGroupRaw) || 12))
    const advance = String(Math.max(1, Math.min(Number(perGroup) - 1, Number(advanceRaw) || 6)))
    const plan = guidedCupPlan(total, perGroup, advance)
    const previousFinal = value.estrutura_planejada.at(-1)
    if (plan.length && previousFinal) {
      plan[plan.length - 1] = {
        ...plan[plan.length - 1],
        final_dias_config: previousFinal.final_dias_config,
        final_formato: previousFinal.final_formato,
        final_champion_point_pontos: previousFinal.final_champion_point_pontos,
        final_point_rush_dias: previousFinal.final_point_rush_dias,
        final_bonus_ranking: previousFinal.final_bonus_ranking,
      }
    }
    onChange({
      ...value,
      numero_vagas: total,
      numero_fases: String(plan.length),
      nomes_fases: plan.map((phase) => phase.nome),
      estrutura_planejada: plan,
      formato: 'Mata-mata',
    })
  }

  function selectType(type: ChampionshipType) {
    const nextFormat = defaultFormat(type)
    const guidedPlan = type === 'copa'
      ? guidedCupPlan('96', '12', '6')
      : type === 'diario'
        ? [{ nome: 'Fase 1', grupos: '1', equipes_por_grupo: '12', classificam_por_grupo: '', oculta: true, diario_horarios: [{ id: 'horario-1', horario: '19:00' }] }]
        : defaultStructurePlan(type, 1)
    onChange({
      ...value,
      tipo: type,
      formato: nextFormat,
      numero_vagas: type === 'copa' ? '96' : type === 'confronto' ? '2' : '12',
      diario_equipes_por_horario: type === 'diario' ? (value.diario_equipes_por_horario || '12') : value.diario_equipes_por_horario,
      sistema_pontuacao_tipo: value.sistema_pontuacao_tipo || 'garena',
      sistema_pontuacao_nome: value.sistema_pontuacao_nome || 'Oficial Garena',
      pontuacao_equipes_por_partida: value.pontuacao_equipes_por_partida || '12',
      pontos_colocacao: value.pontos_colocacao?.length ? value.pontos_colocacao : OFFICIAL_GARENA_SCORING.map(String),
      pontos_por_abate: value.pontos_por_abate || '1',
      numero_fases: String(guidedPlan.length),
      nomes_fases: guidedPlan.map((phase) => phase.nome),
      estrutura_planejada: guidedPlan,
      partidas_por_jogo: type === 'diario' || type === 'copa' ? (value.partidas_por_jogo || '4') : value.partidas_por_jogo,
      partidas_final: type === 'copa' ? (value.partidas_final || '6') : value.partidas_final,
      final_dias: type === 'copa' ? (value.final_dias || '1') : value.final_dias,
      final_dias_config: type === 'copa'
        ? (Array.isArray(value.final_dias_config) && value.final_dias_config.length ? value.final_dias_config : [{ dia: 1, quedas: value.final_quedas_por_dia || value.partidas_final || '6' }])
        : value.final_dias_config,
      final_quedas_por_dia: type === 'copa' ? (value.final_quedas_por_dia || value.partidas_final || '6') : value.final_quedas_por_dia,
      final_formato: type === 'copa' ? (value.final_formato || 'pontos_corridos') : value.final_formato,
      final_champion_point_pontos: type === 'copa' ? (value.final_champion_point_pontos || '160') : value.final_champion_point_pontos,
      final_point_rush_dias: type === 'copa' ? (value.final_point_rush_dias || '1') : value.final_point_rush_dias,
      final_bonus_ranking: type === 'copa'
        ? (Array.isArray(value.final_bonus_ranking) && value.final_bonus_ranking.length ? value.final_bonus_ranking : [{ posicao: 1, pontos_bonus: '12' }, { posicao: 2, pontos_bonus: '9' }, { posicao: 3, pontos_bonus: '8' }])
        : value.final_bonus_ranking,
      final_observacoes: type === 'copa' ? (value.final_observacoes || '') : value.final_observacoes,
      inscricao_paga: value.inscricao_paga ?? Number(value.valor_inscricao) > 0,
      plataforma: value.plataforma || 'mobile',
      servidor: value.servidor || 'Brasil',
      vagas_por_equipe: value.vagas_por_equipe || '4',
      jogadores_por_vaga: value.jogadores_por_vaga || '4',
      origem_criacao: 'novo',
      campeonato_origem_id: '',
      franquia_origem_id: '',
      liga_usa_divisoes: type === 'liga' ? value.liga_usa_divisoes : false,
      liga_nome_agrupamento: type === 'liga' ? (value.liga_nome_agrupamento || 'Série') : 'Divisões',
      liga_divisoes: type === 'liga'
        ? (value.liga_divisoes.length
            ? value.liga_divisoes
            : [{ id: crypto.randomUUID(), nome: 'Série única', codigo: 'UNICA', ordem: 1, equipes: '12', valor_inscricao: '', premiacao: '' }])
        : [],
    })
    setStep('form')
    setFormPage('origin')
    setOriginChoice(null)
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

  function selectCreationOrigin(modeValue: 'novo' | 'modelo' | 'season') {
    const changedOrigin = originChoice !== null && originChoice !== modeValue
    setOriginChoice(modeValue)
    setSourceError('')
    setSourceSearch('')
    onChange({
      ...value,
      origem_criacao: modeValue,
      campeonato_origem_id: '',
      franquia_origem_id: '',
      nome: changedOrigin ? '' : value.nome,
      logo_url: changedOrigin ? '' : value.logo_url,
      banner_url: changedOrigin ? '' : value.banner_url,
      nome_historico: '',
      temporada: '',
      titulo_publico: '',
      numero_edicao: '1',
    })
  }

  function clearSourceSelection() {
    onChange({
      ...value,
      campeonato_origem_id: '',
      franquia_origem_id: '',
      nome: '',
      logo_url: '',
      banner_url: '',
      nome_historico: '',
      temporada: '',
      titulo_publico: '',
      numero_edicao: '1',
    })
    setSourceSearch('')
    setSourceError('')
  }

  function updateCreationName(nextName: string) {
    onChange({
      ...value,
      nome: nextName,
      titulo_publico: value.origem_criacao === 'season' ? nextName : value.titulo_publico,
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
        editionNumber = json?.edition ? Number(json.edition.numero_edicao || 1) + 1 : 2
      }

      const copied: CampeonatoFormValue = { ...value }
      const copyKeys: Array<keyof CampeonatoFormValue> = [
        'nome', 'logo_url', 'banner_url', 'premiacao', 'valor_inscricao', 'descricao_premiacao',
        'divisao_premiacao', 'numero_vagas', 'diario_equipes_por_horario', 'sistema_pontuacao_tipo', 'sistema_pontuacao_nome',
        'pontuacao_equipes_por_partida', 'pontos_colocacao', 'pontos_por_abate', 'numero_fases', 'nomes_fases', 'estrutura_planejada', 'formato', 'partidas_por_jogo', 'partidas_final',
        'final_dias', 'final_dias_config', 'final_quedas_por_dia', 'final_formato', 'final_champion_point_pontos',
        'final_point_rush_dias', 'final_bonus_ranking', 'final_observacoes', 'plataforma', 'servidor', 'tipo_premiacao', 'inscricao_paga',
        'tem_trofeu', 'tem_live', 'vagas_por_equipe', 'jogadores_por_vaga',
        'permite_jogador_multiplas_equipes', 'permite_troca_jogadores', 'data_limite_trocas',
        'data_limite_inscricao', 'aceita_novas_inscricoes_equipes', 'contatos_whatsapp',
        'pagamento_pix_ativo', 'pagamento_cartao_ativo', 'pagamento_paypal_ativo',
        'pagamento_whatsapp_ativo', 'cartao_max_parcelas', 'paypal_moedas',
        'cor_principal', 'cor_secundaria', 'bg_opacidade',
        'recurso_export', 'recurso_stream', 'recurso_rulebook', 'recurso_stats', 'recurso_broadcast',
        'liga_usa_divisoes', 'liga_nome_agrupamento', 'liga_divisoes',
      ]
      for (const key of copyKeys) {
        const sourceField = sourceValue(source, key)
        if (sourceField !== undefined && sourceField !== null) (copied as any)[key] = sourceField
      }
      if (sourceValue(source, 'sistema_pontuacao_tipo') == null) {
        const copiedPoints = Array.isArray(copied.pontos_colocacao) ? copied.pontos_colocacao : []
        const matchesOfficial = copiedPoints.length === OFFICIAL_GARENA_SCORING.length
          && copiedPoints.every((point, index) => Number(point) === OFFICIAL_GARENA_SCORING[index])
          && Number(copied.pontos_por_abate || 1) === 1
        copied.sistema_pontuacao_tipo = matchesOfficial ? 'garena' : 'personalizado'
        copied.sistema_pontuacao_nome = matchesOfficial ? 'Oficial Garena' : 'Personalizada'
        copied.pontuacao_equipes_por_partida = String(copiedPoints.length || 12)
      }
      copied.tipo = value.tipo
      copied.bg_image_url = ''
      copied.campeonato_origem_id = source.id
      copied.origem_criacao = value.origem_criacao
      copied.franquia_origem_id = value.origem_criacao === 'season' ? franchiseId : ''
      if (value.origem_criacao === 'season') {
        copied.nome_historico = franchiseName
        copied.numero_edicao = String(Math.max(2, editionNumber))
        copied.temporada = `Season ${Math.max(2, editionNumber)}`
        copied.titulo_publico = copied.nome
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

  function setScoringMode(nextMode: CampeonatoFormValue['sistema_pontuacao_tipo']) {
    if (nextMode === 'garena') {
      onChange({
        ...value,
        sistema_pontuacao_tipo: 'garena',
        sistema_pontuacao_nome: 'Oficial Garena',
        pontuacao_equipes_por_partida: '12',
        pontos_colocacao: OFFICIAL_GARENA_SCORING.map(String),
        pontos_por_abate: '1',
      })
      return
    }

    const count = Math.max(2, Math.min(15, Number(value.pontuacao_equipes_por_partida || 12) || 12))
    onChange({
      ...value,
      sistema_pontuacao_tipo: 'personalizado',
      sistema_pontuacao_nome: value.sistema_pontuacao_tipo === 'personalizado' ? value.sistema_pontuacao_nome : '',
      pontuacao_equipes_por_partida: String(count),
      pontos_colocacao: scoringPointsForCount(count, value.pontos_colocacao?.length ? value.pontos_colocacao : OFFICIAL_GARENA_SCORING),
      pontos_por_abate: value.pontos_por_abate || '1',
    })
  }

  function updateScoringTeamCount(rawCount: string) {
    if (!rawCount) {
      onChange({ ...value, pontuacao_equipes_por_partida: '' })
      return
    }
    const count = Math.max(2, Math.min(15, Number(rawCount) || 12))
    onChange({
      ...value,
      pontuacao_equipes_por_partida: String(count),
      pontos_colocacao: scoringPointsForCount(count, value.pontos_colocacao),
    })
  }

  function updatePlacementPoint(index: number, rawPoint: string) {
    const next = scoringPointsForCount(
      value.sistema_pontuacao_tipo === 'garena' ? 12 : Number(value.pontuacao_equipes_por_partida || 12),
      value.pontos_colocacao,
    )
    next[index] = rawPoint.replace(/[^0-9-]/g, '')
    update('pontos_colocacao', next)
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

  function updateGuidedEntry(isPaid: boolean) {
    onChange({
      ...value,
      inscricao_paga: isPaid,
      valor_inscricao: isPaid ? value.valor_inscricao : '',
    })
  }

  function updateGuidedPrize(nextType: 'sem_premiacao' | 'pix' | 'brinde') {
    updatePrizeType(nextType)
  }

  function updateCupFinal(patch: Partial<Pick<
    CampeonatoFormValue,
    'final_dias' | 'final_dias_config' | 'final_quedas_por_dia' | 'final_formato' |
    'final_champion_point_pontos' | 'final_point_rush_dias' | 'final_bonus_ranking' | 'final_observacoes'
  >>) {
    const next: CampeonatoFormValue = { ...value, ...patch }
    const days = Math.max(1, Math.min(15, Number(next.final_dias || 1)))
    const sourceDays = Array.isArray(next.final_dias_config) ? next.final_dias_config : []
    const fallback = String(Math.max(1, Number(next.final_quedas_por_dia || value.partidas_final || 6)))
    const dayPlan = Array.from({ length: days }, (_, index) => {
      const day = index + 1
      const existing = sourceDays.find((item) => Number(item.dia) === day)
      return { dia: day, quedas: String(Math.max(1, Number(existing?.quedas || fallback))) }
    })
    const totalFalls = dayPlan.reduce((sum, item) => sum + Math.max(1, Number(item.quedas || 1)), 0)
    next.final_dias = String(days)
    next.final_dias_config = dayPlan
    next.final_quedas_por_dia = dayPlan[0]?.quedas || fallback
    next.partidas_final = String(totalFalls)

    const finalIndex = next.estrutura_planejada.length - 1
    if (finalIndex >= 0) {
      next.estrutura_planejada = next.estrutura_planejada.map((phase, index) => index === finalIndex ? {
        ...phase,
        final_dias_config: dayPlan,
        final_formato: next.final_formato,
        final_champion_point_pontos: next.final_champion_point_pontos,
        final_point_rush_dias: next.final_point_rush_dias,
        final_bonus_ranking: next.final_bonus_ranking,
      } : phase)
    }
    setWizardError('')
    onChange(next)
  }

  function updateFinalDayFalls(day: number, raw: string) {
    const current = Array.isArray(value.final_dias_config) ? value.final_dias_config : []
    const nextDays = Array.from({ length: Math.max(1, Number(value.final_dias || 1)) }, (_, index) => {
      const currentDay = index + 1
      const existing = current.find((item) => Number(item.dia) === currentDay)
      return {
        dia: currentDay,
        quedas: currentDay === day ? raw : String(existing?.quedas || value.final_quedas_por_dia || '6'),
      }
    })
    updateCupFinal({ final_dias_config: nextDays })
  }

  function addFinalBonusPosition() {
    const current = Array.isArray(value.final_bonus_ranking) ? value.final_bonus_ranking : []
    updateCupFinal({ final_bonus_ranking: [...current, { posicao: current.length + 1, pontos_bonus: '' }] })
  }

  function updateFinalBonusPosition(index: number, pontos: string) {
    const current = Array.isArray(value.final_bonus_ranking) ? value.final_bonus_ranking : []
    updateCupFinal({ final_bonus_ranking: current.map((item, itemIndex) => itemIndex === index ? { ...item, pontos_bonus: pontos } : item) })
  }

  function removeFinalBonusPosition(index: number) {
    const current = Array.isArray(value.final_bonus_ranking) ? value.final_bonus_ranking : []
    updateCupFinal({
      final_bonus_ranking: current
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, posicao: itemIndex + 1 })),
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

  function leagueSeriesLabel(index: number) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return index < alphabet.length ? `Série ${alphabet[index]}` : `Série ${index + 1}`
  }

  function createLeagueSeries(index: number): CampeonatoFormValue['liga_divisoes'][number] {
    const nome = value.liga_usa_divisoes ? leagueSeriesLabel(index) : 'Série única'
    return {
      id: crypto.randomUUID(),
      nome,
      codigo: value.liga_usa_divisoes ? nome.replace('Série ', '').trim() : 'UNICA',
      ordem: index + 1,
      equipes: '12',
      valor_inscricao: '',
      premiacao: '',
    }
  }

  function setLeagueModel(useSeries: boolean) {
    const divisions = useSeries
      ? (value.liga_usa_divisoes && value.liga_divisoes.length > 1
          ? value.liga_divisoes
          : [0, 1, 2].map((index) => ({
              id: crypto.randomUUID(),
              nome: leagueSeriesLabel(index),
              codigo: leagueSeriesLabel(index).replace('Série ', '').trim(),
              ordem: index + 1,
              equipes: '12',
              valor_inscricao: '',
              premiacao: '',
            })))
      : [{
          id: value.liga_divisoes[0]?.id || crypto.randomUUID(),
          nome: 'Série única',
          codigo: 'UNICA',
          ordem: 1,
          equipes: value.liga_divisoes[0]?.equipes || '12',
          valor_inscricao: value.liga_divisoes[0]?.valor_inscricao || '',
          premiacao: value.liga_divisoes[0]?.premiacao || '',
        }]

    onChange({
      ...value,
      liga_usa_divisoes: useSeries,
      liga_nome_agrupamento: useSeries ? 'Séries' : 'Série',
      liga_divisoes: divisions,
      numero_vagas: String(divisions.reduce((sum, item) => sum + Math.max(0, Number(item.equipes || 0)), 0)),
      formato: useSeries ? 'Liga por séries' : 'Liga de série única',
    })
  }

  function addLeagueDivision() {
    const nextOrder = value.liga_divisoes.length
    const next = [...value.liga_divisoes, createLeagueSeries(nextOrder)]
    onChange({
      ...value,
      liga_divisoes: next,
      numero_vagas: String(next.reduce((sum, item) => sum + Math.max(0, Number(item.equipes || 0)), 0)),
    })
  }

  function updateLeagueDivision(id: string, patch: Partial<CampeonatoFormValue['liga_divisoes'][number]>) {
    const divisions = value.liga_divisoes.map((division) => division.id === id ? { ...division, ...patch } : division)
    onChange({
      ...value,
      liga_divisoes: divisions,
      numero_vagas: String(divisions.reduce((sum, item) => sum + Math.max(0, Number(item.equipes || 0)), 0)),
    })
  }

  function removeLeagueDivision(id: string) {
    const divisions = value.liga_divisoes
      .filter((division) => division.id !== id)
      .map((division, index) => ({ ...division, ordem: index + 1 }))
    if (!divisions.length) return setWizardError('A Liga precisa ter pelo menos uma série.')
    onChange({
      ...value,
      liga_divisoes: divisions,
      numero_vagas: String(divisions.reduce((sum, item) => sum + Math.max(0, Number(item.equipes || 0)), 0)),
    })
  }

  async function submitWithImages() {
    const resolvedValue: CampeonatoFormValue = {
      ...value,
      logo_url: await resolvePendingImageUpload(value.logo_url),
      banner_url: await resolvePendingImageUpload(value.banner_url),
      bg_image_url: '',
    }
    onChange(resolvedValue)
    await onSubmit(resolvedValue)
  }

  if (step === 'type') {
    return (
      <div className="championship-type-step">
        <div className="championship-step-copy">
          <span className="championship-step-index">Criação guiada</span>
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
        { id: 'format', label: 'Estrutura' },
        { id: 'operation', label: 'Operação' },
        { id: 'scoring', label: 'Pontuação' },
      ]
    : value.tipo === 'copa'
      ? [
          { id: 'origin', label: 'Início' },
          { id: 'operation', label: 'Vagas e prêmio' },
          { id: 'scoring', label: 'Pontuação' },
          { id: 'format' as const, label: 'Fases e grupos' },
          { id: 'matches' as const, label: 'Final' },
          { id: 'review', label: 'Revisão' },
        ]
      : value.tipo === 'diario'
        ? [
            { id: 'origin', label: 'Início' },
            { id: 'operation', label: 'Vagas e prêmio' },
            { id: 'scoring', label: 'Pontuação' },
            { id: 'matches' as const, label: 'Quedas' },
            { id: 'format' as const, label: 'Horários' },
            { id: 'review', label: 'Revisão' },
          ]
        : value.tipo === 'liga'
        ? [
            { id: 'origin', label: 'Início' },
            { id: 'format' as const, label: 'Séries' },
            { id: 'scoring', label: 'Pontuação' },
            { id: 'review', label: 'Revisão' },
          ]
        : [
            { id: 'origin', label: 'Início' },
            { id: 'format' as const, label: 'Estrutura' },
            { id: 'operation', label: 'Operação' },
            { id: 'scoring', label: 'Pontuação' },
            { id: 'review', label: 'Revisão' },
          ]
  const currentPageIndex = Math.max(0, wizardPages.findIndex((page) => page.id === formPage))
  const pageVisible = (page: typeof formPage) => mode === 'edit' || formPage === page
  function goNext() {
    setWizardError('')
    if (formPage === 'origin') {
      if (!originChoice) return setWizardError('Escolha como deseja criar o campeonato.')
      if (value.origem_criacao !== 'novo' && !value.campeonato_origem_id) return setWizardError('Selecione o campeonato de origem.')
      if (!value.nome.trim() || !value.logo_url) return setWizardError('Informe o nome e envie a logo para continuar.')
    }
    if (formPage === 'format' && value.tipo === 'diario') {
      const schedules = normalizedDailySchedules()
      if (!schedules.length) return setWizardError('Adicione pelo menos um horário para o Diário.')
      if (schedules.some((item) => !/^\d{2}:\d{2}$/.test(item.horario))) return setWizardError('Preencha todos os horários do Diário.')
      if (new Set(schedules.map((item) => item.horario)).size !== schedules.length) return setWizardError('Os horários do Diário não podem se repetir.')
    }
    if (formPage === 'format' && value.tipo === 'liga') {
      if (!value.liga_divisoes.length) return setWizardError('Adicione pelo menos uma série à Liga.')
      if (value.liga_divisoes.some((division) => !division.nome.trim())) return setWizardError('Todas as séries precisam de um nome.')
      if (value.liga_divisoes.some((division) => Number(division.equipes || 0) < 2)) return setWizardError('Cada série precisa ter pelo menos 2 equipes.')
      const leagueNames = value.liga_divisoes.map((division) => division.nome.trim().toLocaleLowerCase('pt-BR'))
      if (new Set(leagueNames).size !== leagueNames.length) return setWizardError('As séries da Liga não podem ter nomes repetidos.')
    }
    if (formPage === 'format' && value.tipo === 'copa') {
      const first = value.estrutura_planejada[0]
      if (!first || Number(value.numero_vagas) < 2 || Number(first.equipes_por_grupo) < 2 || Number(first.classificam_por_grupo) < 1) return setWizardError('Confira vagas, equipes por grupo e quantas avançam.')
      if (Number(first.classificam_por_grupo) >= Number(first.equipes_por_grupo)) return setWizardError('A quantidade que avança precisa ser menor que o total de equipes do grupo.')
    }
    if (formPage === 'operation' && (value.tipo === 'diario' || value.tipo === 'copa')) {
      if (Number(value.numero_vagas) < 2) return setWizardError('Informe pelo menos 2 equipes/vagas.')
      if (value.inscricao_paga && Number(value.valor_inscricao || 0) <= 0) return setWizardError('A inscrição está marcada como paga. Informe um valor maior que R$ 0,00 ou selecione Gratuita.')
      if (showMoneyPrize && Number(value.premiacao || 0) <= 0) return setWizardError('Informe o valor da premiação ou selecione Sem premiação.')
      if (showGiftPrize && !value.descricao_premiacao.trim()) return setWizardError('Descreva o brinde da premiação para continuar.')
    }
    if (formPage === 'scoring') {
      if (value.sistema_pontuacao_tipo === 'personalizado') {
        const count = Number(value.pontuacao_equipes_por_partida || 0)
        if (count < 2 || count > 15) return setWizardError('A pontuação personalizada precisa ter entre 2 e 15 posições.')
        if (!value.sistema_pontuacao_nome.trim()) return setWizardError('Dê um nome ao sistema de pontuação personalizado.')
        if (value.pontos_colocacao.length !== count) return setWizardError('Confira a quantidade de posições do sistema de pontuação.')
      }
      if (Number(value.pontos_por_abate || 0) < 0) return setWizardError('O valor por abate não pode ser negativo.')
    }
    if (formPage === 'matches' && value.tipo === 'diario' && Number(value.partidas_por_jogo || 0) < 1) return setWizardError('Informe quantas quedas terá o Diário.')
    if (formPage === 'matches' && value.tipo === 'copa') {
      const dayPlan = Array.isArray(value.final_dias_config) ? value.final_dias_config : []
      if (Number(value.final_dias || 0) < 1 || dayPlan.length !== Number(value.final_dias)) return setWizardError('Confira a quantidade de dias da Final.')
      if (dayPlan.some((item) => Number(item.quedas || 0) < 1)) return setWizardError('Informe quantas quedas serão disputadas em cada dia da Final.')
      const usesChampionPoint = value.final_formato === 'champion_point' || value.final_formato === 'point_rush_champion_point'
      const usesPointRush = value.final_formato === 'point_rush' || value.final_formato === 'point_rush_champion_point'
      if (usesChampionPoint && Number(value.final_champion_point_pontos || 0) <= 0) return setWizardError('Informe a pontuação necessária para ativar o Champion Point.')
      if (usesPointRush && Number(value.final_point_rush_dias || 0) < 1) return setWizardError('Informe quantos dias usarão o formato Point Rush.')
      if (usesPointRush && (!value.final_bonus_ranking?.length || value.final_bonus_ranking.every((item) => item.pontos_bonus === ''))) return setWizardError('Defina pelo menos um bônus por posição para o Point Rush.')
    }
    const next = wizardPages[currentPageIndex + 1]
    if (next) setFormPage(next.id)
  }

  function goBack() {
    const previous = wizardPages[currentPageIndex - 1]
    if (previous) setFormPage(previous.id)
    else if (mode === 'create') setStep('type')
  }

  const selectedSource = championships.find((item) => item.id === value.campeonato_origem_id) || null

  function renderGuidedIdentity() {
    const helper = value.origem_criacao === 'season'
      ? `Os dados vieram da season anterior. Altere o nome, logo ou banner desta nova season se quiser. Ela continuará ligada a ${value.nome_historico || 'este campeonato'}.`
      : value.origem_criacao === 'modelo'
        ? 'O modelo preencheu os dados iniciais. Ajuste o que quiser; este campeonato será independente do original.'
        : 'Defina somente a identidade básica agora. As demais regras serão configuradas nas próximas etapas.'

    return (
      <div className="championship-guided-identity">
        <div className="championship-guided-copy">
          <span>{value.origem_criacao === 'season' ? `Nova ${value.temporada || 'season'}` : 'Identidade inicial'}</span>
          <strong>{value.origem_criacao === 'novo' ? 'Como esse campeonato vai aparecer?' : 'Confira os dados antes de continuar'}</strong>
          <small>{helper}</small>
        </div>
        <div className="mini-grid two championship-guided-identity-grid">
          <Field label="Nome do campeonato">
            <input
              required
              value={value.nome}
              onChange={(event) => updateCreationName(event.target.value)}
              placeholder={value.origem_criacao === 'season' ? 'Ex.: ALOE Pará' : 'Ex.: Copa ALOE'}
            />
          </Field>
          <UploadField label="Logo *" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
        </div>
        <div className="championship-banner-upload">
          <UploadField label="Banner da vitrine" value={value.banner_url} bucket="campeonato" cropTarget="campeonato_banner" onChange={(url) => update('banner_url', url)} onUpload={uploadPublicFile} />
          <p>O banner é opcional. Se enviar, ele será ajustado e compactado automaticamente.</p>
        </div>
      </div>
    )
  }

  const showMoneyPrize = value.tipo_premiacao === 'pix' || value.tipo_premiacao === 'dinheiro'
  const showGiftPrize = value.tipo_premiacao === 'brinde'

  return (
    <div className="championship-form-stack">
      <div className="championship-form-progress">
        <div>
          <strong>{selectedType?.title || CHAMPIONSHIP_TYPE_LABELS[value.tipo as ChampionshipType] || 'Campeonato'} · {currentPageIndex + 1} de {wizardPages.length}</strong>
        </div>
        {mode === 'create' ? (
          <button className="text-action-button" type="button" onClick={() => setStep('type')} title="Alterar formato">
            <ArrowLeft size={15} /> Formato
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
              <span>{String(index + 1).padStart(2, '0')}</span>{page.label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'create' ? (
        <section className="form-section-card championship-origin-card" hidden={!pageVisible('origin')}>
          <div className="championship-guided-copy">
            <span>Passo 1 · Como começar</span>
            <strong>Como você quer criar este campeonato?</strong>
            <small>Escolha uma opção. O assistente mostra somente o que você precisa preencher agora.</small>
          </div>

          <div className="championship-origin-options">
            <button
              type="button"
              className={originChoice === 'novo' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => selectCreationOrigin('novo')}
            >
              <strong>Criar novo</strong>
              <small>Comece sem reaproveitar outro campeonato.</small>
            </button>
            <button
              type="button"
              className={originChoice === 'modelo' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => selectCreationOrigin('modelo')}
            >
              <strong>Usar como modelo</strong>
              <small>Copie a configuração de outro campeonato. O novo será independente.</small>
            </button>
            <button
              type="button"
              className={originChoice === 'season' ? 'championship-origin-option active' : 'championship-origin-option'}
              onClick={() => selectCreationOrigin('season')}
            >
              <strong>Criar nova season</strong>
              <small>Continue um campeonato existente e mantenha todas as seasons ligadas.</small>
            </button>
          </div>

          {originChoice === 'novo' ? renderGuidedIdentity() : null}

          {originChoice === 'modelo' || originChoice === 'season' ? (
            <div className="championship-source-picker">
              {!value.campeonato_origem_id ? (
                <>
                  <div className="championship-guided-copy compact">
                    <span>{originChoice === 'season' ? 'Season anterior' : 'Modelo'}</span>
                    <strong>{originChoice === 'season' ? 'Qual campeonato você quer continuar?' : 'Qual campeonato você quer usar como base?'}</strong>
                    <small>
                      {originChoice === 'season'
                        ? 'Pesquise uma season já criada. A próxima ficará vinculada ao mesmo histórico.'
                        : 'Pesquise um campeonato do mesmo tipo. Apenas as configurações serão copiadas.'}
                    </small>
                  </div>
                  <Field label={originChoice === 'season' ? 'Pesquisar season' : 'Pesquisar modelo'}>
                    <input
                      autoFocus
                      value={sourceSearch}
                      onChange={(event) => setSourceSearch(event.target.value)}
                      placeholder={`Digite o nome de um ${selectedType?.title || value.tipo}`}
                    />
                  </Field>
                  <div className="championship-source-results">
                    {sourceCandidates.length ? sourceCandidates.map((source) => (
                      <button
                        type="button"
                        key={source.id}
                        disabled={sourceLoading}
                        className="championship-source-item"
                        onClick={() => void applySourceChampionship(source)}
                      >
                        <span className="championship-source-logo">
                          {String(source.data?.logo_url || '') ? <img src={String(source.data?.logo_url)} alt="" /> : <Trophy size={18} />}
                        </span>
                        <span className="championship-source-copy">
                          <strong>{String(source.name || source.data?.nome || 'Campeonato')}</strong>
                          <small>{originChoice === 'season' ? 'Usar como season anterior' : 'Usar como modelo'}</small>
                        </span>
                        <span className="championship-source-action">Selecionar</span>
                      </button>
                    )) : (
                      <p className="form-empty-note">Nenhum campeonato desse tipo foi encontrado nesta produtora.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="championship-source-selected">
                    <span className="championship-source-logo">
                      {String(selectedSource?.data?.logo_url || value.logo_url || '') ? <img src={String(selectedSource?.data?.logo_url || value.logo_url)} alt="" /> : <Trophy size={18} />}
                    </span>
                    <span className="championship-source-copy">
                      <small>{originChoice === 'season' ? 'Season anterior selecionada' : 'Modelo selecionado'}</small>
                      <strong>{String(selectedSource?.name || selectedSource?.data?.nome || value.nome || 'Campeonato')}</strong>
                      {originChoice === 'season' ? <em>Próxima edição: {value.temporada || `Season ${value.numero_edicao}`}</em> : null}
                    </span>
                    <button type="button" className="text-action-button" onClick={clearSourceSelection}>Trocar</button>
                  </div>
                  {renderGuidedIdentity()}
                </>
              )}
              {sourceLoading ? <p className="form-empty-note">Carregando dados...</p> : null}
              {sourceError ? <div className="message error">{sourceError}</div> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="form-section-card" hidden={mode !== 'edit' || !pageVisible('identity')}>
        <div className="mini-grid two">
          <Field label="Nome"><input required value={value.nome} onChange={(e) => update('nome', e.target.value)} /></Field>
          <UploadField label="Logo *" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
        </div>
        <div className="championship-banner-upload">
          <UploadField label="Banner da vitrine" value={value.banner_url} bucket="campeonato" cropTarget="campeonato_banner" onChange={(url) => update('banner_url', url)} onUpload={uploadPublicFile} />
          <p>Formato 4:5. Ajuste a imagem antes de salvar; ela será convertida para WebP e compactada automaticamente.</p>
        </div>
      </section>

      <section className="form-section-card" hidden={mode !== 'edit' || !pageVisible('identity')}>
        <p className="eyebrow">Cores do campeonato</p>
        <p className="empty" style={{ margin: '0 0 12px' }}>Escolha uma paleta ou ajuste as duas cores. A identidade usa fundo neutro para manter o sistema leve.</p>
        <div className="championship-theme-palettes" aria-label="Paletas de cores">
          {THEME_PALETTES.map((palette) => {
            const isActive = value.cor_principal.toLowerCase() === palette.primary && value.cor_secundaria.toLowerCase() === palette.secondary
            return (
              <button
                key={palette.name}
                type="button"
                className={isActive ? 'championship-theme-palette active' : 'championship-theme-palette'}
                onClick={() => onChange({ ...value, cor_principal: palette.primary, cor_secundaria: palette.secondary, bg_opacidade: '18', bg_image_url: '' })}
              >
                <span><i style={{ background: palette.primary }} /><i style={{ background: palette.secondary }} /></span>
                {palette.name}
              </button>
            )
          })}
        </div>
        <div className="mini-grid two">
          <Field label="Cor principal">
            <div className="color-field-row">
              <input type="color" value={value.cor_principal || '#c9b766'} onChange={(e) => update('cor_principal', e.target.value)} />
              <input value={value.cor_principal || ''} onChange={(e) => update('cor_principal', e.target.value)} placeholder="#c9b766" />
            </div>
          </Field>
          <Field label="Cor de apoio">
            <div className="color-field-row">
              <input type="color" value={value.cor_secundaria || '#141518'} onChange={(e) => update('cor_secundaria', e.target.value)} />
              <input value={value.cor_secundaria || ''} onChange={(e) => update('cor_secundaria', e.target.value)} placeholder="#141518" />
            </div>
          </Field>
        </div>
        <div
          className="champ-theme-preview champ-theme"
          style={championshipThemeStyle({
            cor_principal: value.cor_principal,
            cor_secundaria: value.cor_secundaria,
            bg_opacidade: '18',
            bg_image_url: '',
          })}
        >
          <div className="champ-theme-preview-banner">Prévia da identidade</div>
          <div className="champ-theme-preview-body">
            <div>
              <strong>Área clara do layout</strong>
              <small style={{ display: 'block', marginTop: 4, opacity: 0.75 }}>
                As cores aparecem em títulos, indicadores e ações principais.
              </small>
            </div>
            <button type="button" className="champ-theme-preview-btn">Botão principal</button>
          </div>
        </div>
      </section>

      <section className="form-section-card" hidden={mode !== 'edit' || !pageVisible('season')}>
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

      <section className="form-section-card championship-scoring-card" hidden={!pageVisible('scoring')}>
        <div className="championship-guided-copy">
          <span>Sistema de pontuação</span>
          <strong>Como os resultados vão valer pontos?</strong>
          <small>O MatchResult entrega colocação e abates. Aqui o DropZone define quantos pontos cada posição e cada abate valem.</small>
        </div>

        <div className="championship-scoring-mode-choice">
          <button
            type="button"
            className={value.sistema_pontuacao_tipo === 'garena' ? 'active' : ''}
            onClick={() => setScoringMode('garena')}
          >
            <strong>Oficial Garena</strong>
            <small>12 equipes · tabela oficial · 1 ponto por abate.</small>
          </button>
          <button
            type="button"
            className={value.sistema_pontuacao_tipo === 'personalizado' ? 'active' : ''}
            onClick={() => setScoringMode('personalizado')}
          >
            <strong>Personalizada</strong>
            <small>Crie seu próprio sistema para jogos com até 15 equipes.</small>
          </button>
        </div>

        {value.sistema_pontuacao_tipo === 'personalizado' ? (
          <div className="championship-scoring-custom-head">
            <Field label="Nome do sistema">
              <input
                value={value.sistema_pontuacao_nome}
                onChange={(event) => update('sistema_pontuacao_nome', event.target.value)}
                placeholder="Ex.: Pontuação Liga Paraense"
              />
            </Field>
            <Field label="Equipes por partida">
              <input
                type="number"
                min="2"
                max="15"
                value={value.pontuacao_equipes_por_partida}
                onChange={(event) => updateScoringTeamCount(event.target.value)}
                placeholder="Ex.: 15"
              />
            </Field>
            <Field label="Pontos por abate">
              <input
                type="number"
                min="0"
                step="0.5"
                value={value.pontos_por_abate}
                onChange={(event) => update('pontos_por_abate', event.target.value)}
                placeholder="Ex.: 1"
              />
            </Field>
          </div>
        ) : (
          <div className="championship-scoring-official-summary">
            <div><small>Sistema</small><strong>Oficial Garena</strong></div>
            <div><small>Equipes</small><strong>12</strong></div>
            <div><small>Abate</small><strong>1 ponto</strong></div>
          </div>
        )}

        <div className="championship-scoring-table">
          <div className="championship-scoring-table-head">
            <span>Colocação</span>
            <span>Pontos</span>
          </div>
          {scoringPointsForCount(
            value.sistema_pontuacao_tipo === 'garena' ? 12 : Number(value.pontuacao_equipes_por_partida || 12),
            value.sistema_pontuacao_tipo === 'garena' ? OFFICIAL_GARENA_SCORING : value.pontos_colocacao,
          ).map((points, index) => (
            <div className="championship-scoring-row" key={`scoring-position-${index + 1}`}>
              <span>
                <small>{index === 0 ? 'BOOYAH' : 'TOP'}</small>
                <strong>{index + 1}º</strong>
              </span>
              {value.sistema_pontuacao_tipo === 'garena' ? (
                <strong>{points || '0'}</strong>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={points}
                  onChange={(event) => updatePlacementPoint(index, event.target.value)}
                  placeholder="0"
                  aria-label={`Pontos do ${index + 1}º lugar`}
                />
              )}
            </div>
          ))}
        </div>

        <p className="championship-guided-note">
          Posição sem valor preenchido conta como 0 ponto. Os abates continuam sendo lidos do KillScore da equipe no MatchResult.
        </p>
      </section>

      <section className="form-section-card" hidden={!pageVisible('format')}>
        {mode === 'create' && value.tipo === 'diario' ? (
          <div className="championship-guided-structure championship-daily-schedules">
            <div className="championship-guided-copy">
              <span>Última configuração</span>
              <strong>Quais horários estarão disponíveis?</strong>
              <small>Cada horário funciona como um grupo independente. Internamente o sistema mantém uma Fase 1 oculta para preservar pontuação, jogos e slots.</small>
            </div>

            <div className="championship-daily-schedule-list">
              {normalizedDailySchedules().map((item, index) => (
                <div className="championship-daily-schedule-row" key={item.id}>
                  <span className="championship-daily-schedule-index">{String(index + 1).padStart(2, '0')}</span>
                  <Field label={`Horário ${index + 1}`}>
                    <input type="time" value={item.horario} onChange={(event) => updateDailySchedule(item.id, event.target.value)} />
                  </Field>
                  <div className="championship-daily-schedule-meta">
                    <strong>{value.diario_equipes_por_horario || '12'} equipes</strong>
                    <small>{value.partidas_por_jogo || '0'} quedas</small>
                  </div>
                  <button type="button" className="icon-action-button danger" disabled={normalizedDailySchedules().length <= 1} onClick={() => removeDailySchedule(item.id)} aria-label={`Remover horário ${index + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="button secondary championship-daily-add-schedule" onClick={addDailySchedule}>
              <Plus size={14} /> Adicionar horário
            </button>

            <div className="championship-guided-preview">
              <span>Estrutura interna</span>
              <strong>{normalizedDailySchedules().length} horário(s) · {value.numero_vagas || '0'} vagas no total</strong>
              <small>{normalizedDailySchedules().map((item) => item.horario || '--:--').join(' · ')} · A Fase 1 será criada oculta e cada horário será um grupo independente.</small>
            </div>
          </div>
        ) : mode === 'create' && value.tipo === 'copa' ? (
          <div className="championship-guided-structure">
            <div className="championship-guided-copy">
              <span>Passo 2 · Estrutura</span>
              <strong>Como começa esta Copa?</strong>
              <small>Informe somente a entrada. O sistema calcula os grupos e mostra como as equipes avançam até a final.</small>
            </div>

            <div className="championship-guided-question-grid">
              <Field label="Equipes inscritas">
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={value.numero_vagas}
                  onChange={(event) => updateGuidedCup(event.target.value)}
                  placeholder="Ex.: 96"
                />
              </Field>
              <Field label="Equipes por grupo">
                <input
                  type="number"
                  min="2"
                  max="52"
                  value={value.estrutura_planejada[0]?.equipes_por_grupo || '12'}
                  onChange={(event) => updateGuidedCup(value.numero_vagas, event.target.value)}
                  placeholder="Ex.: 12"
                />
              </Field>
              <Field label="Avançam por grupo">
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, Number(value.estrutura_planejada[0]?.equipes_por_grupo || 12) - 1)}
                  value={value.estrutura_planejada[0]?.classificam_por_grupo || '6'}
                  onChange={(event) => updateGuidedCup(
                    value.numero_vagas,
                    value.estrutura_planejada[0]?.equipes_por_grupo || '12',
                    event.target.value,
                  )}
                  placeholder="Ex.: 6"
                />
              </Field>
            </div>

            <div className="championship-guided-flow" aria-label="Progressão calculada da Copa">
              {value.estrutura_planejada.map((phase, index) => {
                const teams = Number(phase.grupos || 0) * Number(phase.equipes_por_grupo || 0)
                const classified = phase.classificam_por_grupo
                  ? Number(phase.grupos || 0) * Number(phase.classificam_por_grupo || 0)
                  : 0
                return (
                  <div className="championship-guided-flow-step" key={`${phase.nome}-${index}`}>
                    <span>{phase.nome}</span>
                    <strong>{phase.grupos} {Number(phase.grupos) === 1 ? 'grupo' : 'grupos'} · {teams} equipes</strong>
                    {classified ? <small>{phase.classificam_por_grupo} avançam por grupo → {classified} classificadas</small> : <small>Última fase da Copa</small>}
                  </div>
                )
              })}
            </div>

            <div className="championship-guided-question">
              <Field label="Quedas por jogo nas fases">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={value.partidas_por_jogo || '4'}
                  onChange={(event) => update('partidas_por_jogo', event.target.value)}
                  placeholder="Ex.: 4"
                />
              </Field>
            </div>
            <p className="championship-guided-note">
              Aqui você define a progressão das fases. A Final tem configuração própria na próxima etapa.
            </p>
          </div>
        ) : value.tipo === 'liga' ? (
          <div className="championship-guided-structure championship-league-series">
            <div className="championship-guided-copy">
              <span>Estrutura da Liga</span>
              <strong>Esta Liga possui séries?</strong>
              <small>Comece somente pela estrutura principal. Classificatórias, acesso, rebaixamento e confrontos serão configurados nas próximas etapas.</small>
            </div>

            <div className="championship-league-model-choice">
              <button
                type="button"
                className={!value.liga_usa_divisoes ? 'active' : ''}
                onClick={() => setLeagueModel(false)}
              >
                <strong>Série única</strong>
                <small>Todas as equipes disputam a mesma divisão.</small>
              </button>
              <button
                type="button"
                className={value.liga_usa_divisoes ? 'active' : ''}
                onClick={() => setLeagueModel(true)}
              >
                <strong>Possui séries</strong>
                <small>Ex.: Série A, Série B e Série C.</small>
              </button>
            </div>

            <div className="championship-league-series-head">
              <div>
                <span>{value.liga_usa_divisoes ? 'Séries da Liga' : 'Configuração da série'}</span>
                <strong>{value.liga_usa_divisoes ? `${value.liga_divisoes.length} séries` : 'Série única'}</strong>
              </div>
              <small>{value.numero_vagas || '0'} equipes somando todas as séries</small>
            </div>

            <div className="championship-league-series-list">
              {value.liga_divisoes.map((division, index) => (
                <div className="championship-league-series-row" key={division.id}>
                  <div className="championship-league-series-index">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{division.codigo || (value.liga_usa_divisoes ? String.fromCharCode(65 + index) : 'Única')}</strong>
                  </div>

                  <div className="championship-league-series-fields">
                    <Field label="Nome da série">
                      <input
                        value={division.nome}
                        onChange={(event) => updateLeagueDivision(division.id, { nome: event.target.value })}
                        placeholder={value.liga_usa_divisoes ? `Ex.: Série ${String.fromCharCode(65 + index)}` : 'Ex.: Liga Principal'}
                      />
                    </Field>
                    <Field label="Equipes">
                      <input
                        type="number"
                        min="2"
                        max="200"
                        value={division.equipes}
                        onChange={(event) => updateLeagueDivision(division.id, { equipes: event.target.value })}
                        placeholder="Ex.: 24"
                      />
                    </Field>
                    <Field label="Inscrição por equipe">
                      <input
                        inputMode="numeric"
                        value={moneyDisplay(division.valor_inscricao)}
                        onChange={(event) => updateLeagueDivision(division.id, { valor_inscricao: moneyValue(event.target.value) })}
                        placeholder="R$ 0,00"
                      />
                    </Field>
                    <Field label="Premiação">
                      <input
                        inputMode="numeric"
                        value={moneyDisplay(division.premiacao)}
                        onChange={(event) => updateLeagueDivision(division.id, { premiacao: moneyValue(event.target.value) })}
                        placeholder="R$ 0,00"
                      />
                    </Field>
                  </div>

                  {value.liga_usa_divisoes ? (
                    <button
                      type="button"
                      className="icon-action-button danger championship-league-series-remove"
                      disabled={value.liga_divisoes.length <= 1}
                      onClick={() => removeLeagueDivision(division.id)}
                      aria-label={`Remover ${division.nome || `série ${index + 1}`}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {value.liga_usa_divisoes ? (
              <button type="button" className="button secondary championship-league-add-series" onClick={addLeagueDivision}>
                <Plus size={14} /> Adicionar série
              </button>
            ) : null}

            <div className="championship-guided-preview">
              <span>Resumo da Liga</span>
              <strong>
                {value.liga_usa_divisoes
                  ? `${value.liga_divisoes.length} séries · ${value.numero_vagas || '0'} equipes`
                  : `${value.liga_divisoes[0]?.nome || 'Série única'} · ${value.liga_divisoes[0]?.equipes || '0'} equipes`}
              </strong>
              <small>
                {value.liga_usa_divisoes
                  ? value.liga_divisoes.map((division) => `${division.nome}: ${division.equipes || '0'}`).join(' · ')
                  : 'Na próxima rodada definiremos como as equipes entram e como a fase principal funciona.'}
              </small>
            </div>
          </div>
        ) : (
          <>
            <p className="eyebrow">Estrutura inicial</p>
            <p className="form-empty-note">
              {value.tipo === 'liga' && 'Defina as fases e as séries. Promoção, rebaixamento, grupos e vagas diretas continuam na organização da liga.'}
              {value.tipo === 'xtreino' && 'Defina a estrutura base do treino. Grupos e jogos podem ser ajustados depois.'}
              {value.tipo === 'confronto' && 'Defina o modo e a estrutura do confronto direto entre as equipes.'}
              {value.tipo === 'diario' && 'Um grupo e um jogo.'}
              {value.tipo === 'copa' && 'Estrutura eliminatória da Copa.'}
            </p>
            <div className="mini-grid three">
              <Field label="Limite de vagas (meta)">
                <input
                  type="number"
                  min="1"
                  value={value.numero_vagas}
                  onChange={(e) => update('numero_vagas', e.target.value)}
                  placeholder="Ex.: 96"
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
                          ? [{
                              id: crypto.randomUUID(),
                              nome: 'Série A',
                              codigo: 'A',
                              ordem: 1,
                              equipes: '12',
                              valor_inscricao: '',
                              premiacao: '',
                            }]
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
                A montagem abaixo cria fases, grupos e slots automaticamente. As vagas comerciais contam somente a fase de entrada; as próximas recebem classificados.
              </p>
              {defaultStructurePlan(value.tipo, Math.max(1, Math.min(12, Number(value.numero_fases) || 1)), value.estrutura_planejada).map((phase, index) => (
                <div className="championship-structure-phase" key={index}>
                  <span>Fase {index + 1}</span>
                  <div className="mini-grid four">
                    <Field label="Nome da fase">
                      <input value={phase.nome} onChange={(event) => updateInitialPhaseName(index, event.target.value)} placeholder={phaseNameSuggestion(index, Number(value.numero_fases) || 1)} />
                    </Field>
                    <Field label="Grupos">
                      <input type="number" min="1" max="26" value={phase.grupos} onChange={(event) => updateStructurePhase(index, { grupos: event.target.value })} />
                    </Field>
                    <Field label="Equipes por grupo">
                      <input type="number" min="1" max="52" value={phase.equipes_por_grupo} onChange={(event) => updateStructurePhase(index, { equipes_por_grupo: event.target.value })} />
                    </Field>
                    {index < Math.max(1, Number(value.numero_fases) || 1) - 1 ? (
                      <Field label="Classificam por grupo">
                        <input type="number" min="1" max="51" value={phase.classificam_por_grupo} onChange={(event) => updateStructurePhase(index, { classificam_por_grupo: event.target.value })} placeholder="Ex.: 6" />
                      </Field>
                    ) : <div className="championship-structure-summary">{Number(phase.grupos || 0) * Number(phase.equipes_por_grupo || 0) || 0} vagas nesta fase</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa') ? (
        <section className="form-section-card" hidden={!pageVisible('matches')}>
          {value.tipo === 'diario' ? (
            <div className="championship-guided-matches">
              <div className="championship-guided-copy">
                <span>Quedas do Diário</span>
                <strong>Quantas quedas terá este jogo?</strong>
                <small>O Diário possui somente um jogo. Informe quantas quedas serão disputadas até encerrar o evento.</small>
              </div>

              <div className="championship-guided-question">
                <Field label="Quedas no jogo">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={value.partidas_por_jogo || '4'}
                    onChange={(event) => update('partidas_por_jogo', event.target.value)}
                    placeholder="Ex.: 4"
                  />
                </Field>
                <div className="championship-guided-quick-options" aria-label="Sugestões de quedas">
                  {[4, 6, 8].map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      className={Number(value.partidas_por_jogo || 0) === amount ? 'active' : ''}
                      onClick={() => update('partidas_por_jogo', String(amount))}
                    >
                      {amount} quedas
                    </button>
                  ))}
                </div>
              </div>

              <div className="championship-guided-preview">
                <span>Resumo do Diário</span>
                <strong>1 jogo · {value.partidas_por_jogo || '0'} quedas</strong>
                <small>{value.numero_vagas || '0'} equipes disputam todas as partidas juntas.</small>
              </div>
            </div>
          ) : (
            <div className="championship-guided-matches championship-guided-final">
              <div className="championship-guided-copy">
                <span>Configuração da Final</span>
                <strong>Como será disputada a Final?</strong>
                <small>Configure cada dia separadamente. Essas escolhas serão reaproveitadas quando os jogos da Grande Final forem criados.</small>
              </div>

              <div className="championship-guided-final-grid">
                <Field label="Dias de Final">
                  <input type="number" min="1" max="15" value={value.final_dias || '1'} onChange={(event) => updateCupFinal({ final_dias: event.target.value })} placeholder="Ex.: 2" />
                </Field>
                <Field label="Formato da Final">
                  <select value={value.final_formato || 'pontos_corridos'} onChange={(event) => updateCupFinal({ final_formato: event.target.value as CampeonatoFormValue['final_formato'] })}>
                    <option value="pontos_corridos">Pontos corridos</option>
                    <option value="champion_point">Champion Point</option>
                    <option value="point_rush">Point Rush</option>
                    <option value="point_rush_champion_point">Point Rush + Champion Point</option>
                    <option value="personalizado">Personalizado</option>
                  </select>
                </Field>
                <Field label="Equipes na Final"><input value={value.estrutura_planejada.at(-1)?.equipes_por_grupo || '12'} disabled /></Field>
              </div>

              <div className="championship-final-days">
                {(value.final_dias_config || [{ dia: 1, quedas: value.final_quedas_por_dia || '6' }]).map((day) => (
                  <div className="championship-final-day-row" key={day.dia}>
                    <span><small>Dia</small><strong>{day.dia}</strong></span>
                    <Field label="Quedas neste dia">
                      <input type="number" min="1" max="30" value={day.quedas} onChange={(event) => updateFinalDayFalls(day.dia, event.target.value)} placeholder="Ex.: 6" />
                    </Field>
                    <em>{day.quedas || '0'} quedas</em>
                  </div>
                ))}
              </div>

              {(value.final_formato === 'champion_point' || value.final_formato === 'point_rush_champion_point') ? (
                <div className="championship-guided-decision championship-final-rule">
                  <div className="championship-guided-decision-copy">
                    <strong>Champion Point</strong>
                    <small>Ao atingir essa pontuação, a equipe fica elegível para fechar o campeonato com BOOYAH.</small>
                  </div>
                  <div className="championship-guided-field">
                    <Field label="Pontos para ativar">
                      <input type="number" min="1" step="1" value={value.final_champion_point_pontos || '160'} onChange={(event) => updateCupFinal({ final_champion_point_pontos: event.target.value })} placeholder="Ex.: 160" />
                    </Field>
                  </div>
                </div>
              ) : null}

              {(value.final_formato === 'point_rush' || value.final_formato === 'point_rush_champion_point') ? (
                <div className="championship-guided-decision championship-final-rule">
                  <div className="championship-guided-decision-copy">
                    <strong>Point Rush</strong>
                    <small>Defina quantos dias usarão o formato e qual bônus cada colocação leva para a etapa decisiva.</small>
                  </div>
                  <div className="championship-guided-field">
                    <Field label="Dias de Point Rush">
                      <input type="number" min="1" max={Math.max(1, Number(value.final_dias || 1))} value={value.final_point_rush_dias || '1'} onChange={(event) => updateCupFinal({ final_point_rush_dias: event.target.value })} />
                    </Field>
                  </div>
                  <div className="championship-final-bonus-editor">
                    <div className="championship-final-bonus-head"><span>Posição</span><span>Bônus de pontos</span></div>
                    {(value.final_bonus_ranking || []).map((item, index) => (
                      <div className="championship-final-bonus-row" key={`${item.posicao}-${index}`}>
                        <strong>TOP {item.posicao}</strong>
                        <input type="number" min="0" step="1" value={item.pontos_bonus} onChange={(event) => updateFinalBonusPosition(index, event.target.value)} placeholder="Ex.: 12" />
                        <button type="button" className="icon-action-button danger" onClick={() => removeFinalBonusPosition(index)} aria-label={`Remover TOP ${item.posicao}`}><Trash2 size={15} /></button>
                      </div>
                    ))}
                    <button type="button" className="button secondary championship-final-bonus-add" onClick={addFinalBonusPosition}><Plus size={14} /> Adicionar posição</button>
                  </div>
                </div>
              ) : null}

              <Field label="Observações da Final (opcional)">
                <textarea value={value.final_observacoes || ''} onChange={(event) => updateCupFinal({ final_observacoes: event.target.value })} placeholder="Ex.: Dia 1 com 6 quedas; Dia 2 com 10; regra especial de desempate..." />
              </Field>

              <div className="championship-guided-final-summary">
                <div><small>Dias</small><strong>{value.final_dias || '1'}</strong></div>
                <div><small>Total de quedas</small><strong>{value.partidas_final || '0'}</strong></div>
                <div><small>Formato</small><strong>{value.final_formato === 'champion_point' ? 'Champion Point' : value.final_formato === 'point_rush' ? 'Point Rush' : value.final_formato === 'point_rush_champion_point' ? 'Point Rush + CP' : value.final_formato === 'personalizado' ? 'Personalizado' : 'Pontos corridos'}</strong></div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa') ? (
        <section className="form-section-card championship-guided-operation" hidden={!pageVisible('operation')}>
          <div className="championship-guided-copy">
            <span>Passo 4 · Inscrição e premiação</span>
            <strong>Como será a entrada e o prêmio?</strong>
            <small>Defina só o essencial agora. Pagamentos, contatos de venda e regras avançadas podem ser ajustados depois na gestão do campeonato.</small>
          </div>

          <div className="championship-guided-decision">
            <div className="championship-guided-decision-copy">
              <strong>{value.tipo === 'copa' ? 'Quantas vagas terá a Copa?' : 'Quantas equipes cabem em cada horário?'}</strong>
              <small>{value.tipo === 'copa' ? 'Informe o total de equipes que entram na primeira fase.' : 'Cada horário será um jogo independente com essa quantidade de equipes.'}</small>
            </div>
            <div className="championship-guided-field">
              <Field label={value.tipo === 'copa' ? 'Vagas disponíveis' : 'Equipes por horário'}>
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={value.tipo === 'diario' ? (value.diario_equipes_por_horario || '12') : value.numero_vagas}
                  onChange={(event) => {
                    if (value.tipo === 'copa') updateGuidedCup(event.target.value)
                    else updateGuidedDaily(event.target.value)
                  }}
                  placeholder={value.tipo === 'copa' ? 'Ex.: 96' : 'Ex.: 12 ou 15'}
                />
              </Field>
            </div>
          </div>

          <div className="championship-guided-decision">
            <div className="championship-guided-decision-copy">
              <strong>A inscrição é gratuita ou paga?</strong>
              <small>Se for paga, informe somente o valor por vaga.</small>
            </div>
            <div className="championship-guided-choice-row">
              <button
                type="button"
                className={!value.inscricao_paga ? 'active' : ''}
                onClick={() => updateGuidedEntry(false)}
              >
                Gratuita
              </button>
              <button
                type="button"
                className={value.inscricao_paga ? 'active' : ''}
                onClick={() => updateGuidedEntry(true)}
              >
                Paga
              </button>
            </div>

            {value.inscricao_paga ? (
              <div className="championship-guided-field">
                <Field label="Valor da inscrição">
                  <input
                    inputMode="numeric"
                    value={moneyDisplay(value.valor_inscricao)}
                    onChange={(event) => update('valor_inscricao', moneyValue(event.target.value))}
                    placeholder="R$ 0,00"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="championship-guided-decision">
            <div className="championship-guided-decision-copy">
              <strong>Vai ter premiação?</strong>
              <small>Escolha o tipo. A distribuição pode ser definida agora quando houver prêmio em dinheiro.</small>
            </div>
            <div className="championship-guided-choice-row three">
              <button
                type="button"
                className={value.tipo_premiacao === 'sem_premiacao' ? 'active' : ''}
                onClick={() => updateGuidedPrize('sem_premiacao')}
              >
                Sem premiação
              </button>
              <button
                type="button"
                className={(value.tipo_premiacao === 'pix' || value.tipo_premiacao === 'dinheiro') ? 'active' : ''}
                onClick={() => updateGuidedPrize('pix')}
              >
                Dinheiro / PIX
              </button>
              <button
                type="button"
                className={value.tipo_premiacao === 'brinde' ? 'active' : ''}
                onClick={() => updateGuidedPrize('brinde')}
              >
                Brinde
              </button>
            </div>

            {showMoneyPrize ? (
              <div className="championship-guided-prize">
                <Field label="Valor total da premiação">
                  <input
                    inputMode="numeric"
                    value={moneyDisplay(value.premiacao)}
                    onChange={(event) => update('premiacao', moneyValue(event.target.value))}
                    placeholder="R$ 0,00"
                  />
                </Field>
                {Number(value.premiacao || 0) > 0 ? (
                  <PremiacaoDivisaoEditor
                    totalPremiacao={value.premiacao}
                    value={value.divisao_premiacao}
                    onChange={(serialized) => update('divisao_premiacao', serialized)}
                    disabled={loading}
                  />
                ) : null}
              </div>
            ) : null}

            {showGiftPrize ? (
              <div className="championship-guided-field">
                <Field label="Qual é o brinde?">
                  <textarea
                    value={value.descricao_premiacao}
                    onChange={(event) => update('descricao_premiacao', event.target.value)}
                    placeholder="Ex.: troféu, camisa personalizada e kit gamer"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="championship-guided-preview">
            <span>Resumo</span>
            <strong>
              {value.inscricao_paga ? `${moneyDisplay(value.valor_inscricao) || 'Valor pendente'} por vaga` : 'Inscrição gratuita'}
              {' · '}
              {showMoneyPrize && value.premiacao
                ? `${moneyDisplay(value.premiacao)} em premiação`
                : showGiftPrize && value.descricao_premiacao
                  ? 'Premiação em brinde'
                  : 'Sem premiação'}
            </strong>
            <small>As demais regras operacionais continuam disponíveis depois que o campeonato for criado.</small>
          </div>
        </section>
      ) : null}

      <section className="form-section-card" hidden={!pageVisible('operation') || (mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa'))}>
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

      <section className="form-section-card" hidden={!pageVisible('operation') || (mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa'))}>
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

      <section className="form-section-card" hidden={!pageVisible('operation') || (mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa'))}>
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

      <section className="form-section-card whatsapp-contacts-section" hidden={!pageVisible('operation') || (mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa'))}>
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
            {value.origem_criacao === 'season' ? (
              <>
                <div><small>Histórico</small><strong>{value.nome_historico || 'Campeonato de origem'}</strong></div>
                <div><small>Season</small><strong>{value.temporada || `Season ${value.numero_edicao || '2'}`}</strong></div>
              </>
            ) : null}
            <div><small>Vagas</small><strong>{value.tipo === 'diario' ? `${value.numero_vagas || '0'} total · ${value.diario_equipes_por_horario || '12'} por horário` : value.numero_vagas || 'Não definidas'}</strong></div>
            {value.tipo !== 'diario' ? <div><small>Fases iniciais</small><strong>{Math.max(1, Number(value.numero_fases) || 1)}</strong></div> : null}
            <div><small>Formato</small><strong>{value.formato || defaultFormat(value.tipo)}</strong></div>
            <div>
              <small>Pontuação</small>
              <strong>{value.sistema_pontuacao_tipo === 'garena' ? 'Oficial Garena' : (value.sistema_pontuacao_nome || 'Personalizada')}</strong>
            </div>
            <div>
              <small>Regra de abate</small>
              <strong>{value.pontos_por_abate || '0'} ponto(s) por abate · {value.sistema_pontuacao_tipo === 'garena' ? 12 : value.pontuacao_equipes_por_partida} posições</strong>
            </div>
            {(value.tipo === 'diario' || value.tipo === 'copa') ? (
              <div>
                <small>Partidas</small>
                <strong>
                  {value.tipo === 'copa'
                    ? `${value.partidas_por_jogo || '—'} quedas por jogo nas fases`
                    : `${value.partidas_por_jogo || '—'} quedas no jogo`}
                </strong>
              </div>
            ) : null}
            {value.tipo === 'diario' ? (
              <div><small>Horários</small><strong>{normalizedDailySchedules().map((item) => item.horario).join(' · ')}</strong></div>
            ) : null}
            {value.tipo === 'copa' ? (
              <div>
                <small>Final</small>
                <strong>{(value.final_dias_config || []).map((day) => `Dia ${day.dia}: ${day.quedas} quedas`).join(' · ') || `${value.final_dias || '1'} dia(s)`}{' · '}{value.partidas_final || '0'} no total</strong>
              </div>
            ) : null}
            {(value.tipo === 'diario' || value.tipo === 'copa') ? (
              <>
                <div>
                  <small>Inscrição</small>
                  <strong>{value.inscricao_paga ? (moneyDisplay(value.valor_inscricao) || 'Paga · valor pendente') : 'Gratuita'}</strong>
                </div>
                <div>
                  <small>Premiação</small>
                  <strong>
                    {showMoneyPrize && value.premiacao
                      ? moneyDisplay(value.premiacao)
                      : showGiftPrize && value.descricao_premiacao
                        ? value.descricao_premiacao
                        : 'Sem premiação'}
                  </strong>
                </div>
              </>
            ) : null}
            {value.tipo === 'liga' ? (
              <>
                <div>
                  <small>Organização</small>
                  <strong>{value.liga_usa_divisoes ? `${value.liga_divisoes.length} séries` : 'Série única'}</strong>
                </div>
                <div>
                  <small>Equipes</small>
                  <strong>{value.numero_vagas || '0'} no total</strong>
                </div>
                <div className="championship-review-wide">
                  <small>Séries</small>
                  <strong>{value.liga_divisoes.map((division) => `${division.nome} · ${division.equipes} equipes`).join(' | ')}</strong>
                </div>
              </>
            ) : null}
          </div>
          <p className="form-empty-note">
            {value.tipo === 'diario'
              ? 'A Fase 1 será criada internamente e ficará oculta. Na organização você verá diretamente os horários como grupos independentes.'
              : value.tipo === 'liga'
                ? 'Nesta etapa serão salvas somente as séries. A formação das equipes, classificatórias, acesso, rebaixamento e fases serão configurados em seguida.'
                : 'As fases iniciais serão criadas automaticamente. Depois você ajusta grupos, slots, datas e progressão na aba Grupos e fases.'}
          </p>
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

      {wizardError ? <div className="message error championship-wizard-error">{wizardError}</div> : null}
      <div className="button-row championship-wizard-actions">
        {mode === 'create' ? <button className="button secondary" type="button" onClick={goBack} disabled={loading}>Voltar</button> : null}
        {mode === 'create' && formPage !== 'review' ? (
          <button
            className="button"
            type="button"
            onClick={goNext}
            disabled={loading || (
              formPage === 'origin' && (
                !originChoice ||
                (value.origem_criacao !== 'novo' && !value.campeonato_origem_id) ||
                !value.nome.trim() ||
                !value.logo_url
              )
            )}
          >
            Continuar
          </button>
        ) : (
          <button className="button" type="button" onClick={() => void submitWithImages()} disabled={loading}>{mode === 'edit' ? 'Salvar alterações' : 'Criar campeonato'}</button>
        )}
        {onCancel && mode !== 'create' ? <button className="button secondary" type="button" onClick={onCancel} disabled={loading}>Cancelar</button> : null}
      </div>
    </div>
  )
}
