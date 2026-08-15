'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, ChevronDown, ChevronRight, Copy, Link2, Loader2, LockKeyhole, Medal, Pencil, Plus, Search, Send, Shield, Trash2, Trophy, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { SystemModal } from '@/components/layout/SystemModal'
import type { DropZoneRow } from '@/lib/types'
import { Field, UploadField, resolvePendingImageUpload } from '../../components/form-fields'
import { ProfileEditForm } from '@/components/forms/ProfileEditForm'
import { uploadPublicFile } from '@/lib/upload-public'
import { dataText, rowTitle } from '../../utils'
import { PlayerTeamRequest } from '@/components/equipes/PlayerTeamRequest'
import { LineRosterManager } from '@/components/equipes/LineRosterManager'


type TeamTraining = {
  campeonato_id: string
  campeonato_equipe_id: string
  equipe_id: string
  nome: string
  logo_url?: string | null
  status?: string | null
  line_nome?: string | null
  grupo_nome?: string | null
  fase_nome?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  quedas: number
  booyahs: number
  abates: number
  pontos_total: number
  colocacao_media: number | null
  melhor_posicao: number | null
  dano: number
  assistencias: number
  revives: number
  configuracao_analise: {
    call_fixa: boolean
    primeira_safe: boolean
    segunda_safe: boolean
  }
  quedas_detalhe: Array<{
    partida_id: string
    jogo_id?: string | null
    numero_partida: number
    mapa_codigo?: string | null
    posicao: number | null
    abates: number
    pontos_total: number
    booyah: boolean
    dano: number
    assistencias: number
    revives: number
    call_nome: string
    primeira_safe: string
    segunda_safe: string
    anotacao_atualizada_em?: string | null
    telemetria_garena: boolean
    jogadores_detalhados: Array<{
      player_id: string
      campeonato_jogador_id?: string | null
      nick: string
      abates: number
      assistencias: number
      dano: number
      headshots: number
      knockdowns: number
      sobrevivencia_segundos: number
      distancia_movida: number
      distancia_max_abate: number
      precisao_percentual: number
      taxa_headshot_kill_percentual: number
      precisao_headshot_percentual: number
      revives: number
      membros_revividos: number
      membros_resgatados: number
      granadas_usadas: number
      abates_granada: number
      dano_granada: number
      gel_usado: number
      gel_destruido: number
      kits_medicos: number
      armas: Array<{ arma: string; abates: number; dano: number; headshots: number; precisao_percentual: number }>
      habilidades: Array<{ tipo: string; personagem: string; habilidade: string; usos: number }>
    }>
  }>
  jogadores: Array<{
    campeonato_jogador_id: string
    nick: string
    id_jogo?: string | null
    foto_url?: string | null
    quedas: number
    abates: number
    dano: number
    assistencias: number
    revives: number
  }>
}


type TrainingTrendPoint = {
  label: string
  value: number | null
}

type TrainingBreakdown = {
  nome: string
  quedas: number
  colocacao_media: number | null
  abates_media: number
  dano_media: number
}

function buildTrainingAnalytics(training: TeamTraining) {
  const drops = training.quedas_detalhe
  const trend = drops.map((drop) => {
    const survivalValues = drop.jogadores_detalhados
      .map((player) => Number(player.sobrevivencia_segundos || 0))
      .filter((value) => value > 0)
    return {
      label: `Q${drop.numero_partida || '?'}`,
      colocacao: drop.posicao,
      abates: drop.abates,
      dano: drop.dano,
      sobrevivencia: survivalValues.length
        ? survivalValues.reduce((sum, value) => sum + value, 0) / survivalValues.length
        : null,
    }
  })

  const summarize = (nameOf: (drop: TeamTraining['quedas_detalhe'][number]) => string) => {
    const groups = new Map<string, TeamTraining['quedas_detalhe']>()
    for (const drop of drops) {
      const name = nameOf(drop).trim()
      if (!name) continue
      groups.set(name, [...(groups.get(name) || []), drop])
    }
    return [...groups.entries()].map(([nome, rows]): TrainingBreakdown => {
      const positions = rows.map((row) => row.posicao).filter((value): value is number => Boolean(value && value > 0))
      return {
        nome,
        quedas: rows.length,
        colocacao_media: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null,
        abates_media: rows.reduce((sum, row) => sum + row.abates, 0) / rows.length,
        dano_media: rows.reduce((sum, row) => sum + row.dano, 0) / rows.length,
      }
    }).sort((a, b) => (a.colocacao_media ?? 99) - (b.colocacao_media ?? 99) || b.abates_media - a.abates_media)
  }

  return {
    trend,
    mapas: summarize((drop) => drop.mapa_codigo || 'Mapa não definido'),
    calls: summarize((drop) => drop.call_nome || ''),
  }
}

type TrainingCrossInsight = {
  titulo: string
  descricao: string
  coeficiente: number | null
  amostras: number
  leitura: string
}

type TrainingPlayerAnalytics = {
  chave: string
  nick: string
  quedas: number
  abates: number
  dano: number
  assistencias: number
  sobrevivencia_media: number | null
  mapas: Array<{ nome: string; quedas: number; abates_media: number; dano_media: number }>
}

function pearsonCorrelation(pairs: Array<[number, number]>) {
  const clean = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (clean.length < 3) return null
  const meanX = clean.reduce((sum, [x]) => sum + x, 0) / clean.length
  const meanY = clean.reduce((sum, [, y]) => sum + y, 0) / clean.length
  let numerator = 0
  let sumX = 0
  let sumY = 0
  for (const [x, y] of clean) {
    const dx = x - meanX
    const dy = y - meanY
    numerator += dx * dy
    sumX += dx * dx
    sumY += dy * dy
  }
  const denominator = Math.sqrt(sumX * sumY)
  if (!denominator) return 0
  return Math.max(-1, Math.min(1, numerator / denominator))
}

function relationLabel(value: number | null, positiveText: string, negativeText: string) {
  if (value === null) return 'Dados insuficientes'
  const strength = Math.abs(value)
  if (strength < 0.2) return 'Sem relação clara'
  const intensity = strength >= 0.7 ? 'forte' : strength >= 0.4 ? 'moderada' : 'leve'
  return `${intensity} · ${value >= 0 ? positiveText : negativeText}`
}

function buildTrainingCrossAnalytics(training: TeamTraining) {
  const validPosition = training.quedas_detalhe.filter((drop) => Number(drop.posicao || 0) > 0)
  const survival = (drop: TeamTraining['quedas_detalhe'][number]) => {
    const values = drop.jogadores_detalhados.map((player) => Number(player.sobrevivencia_segundos || 0)).filter((value) => value > 0)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }

  const damageKillsPairs = training.quedas_detalhe
    .filter((drop) => Number.isFinite(drop.dano) && Number.isFinite(drop.abates))
    .map((drop): [number, number] => [drop.dano, drop.abates])
  const killsPlacementPairs = validPosition.map((drop): [number, number] => [drop.abates, -Number(drop.posicao)])
  const survivalPlacementPairs = validPosition
    .map((drop) => [survival(drop), -Number(drop.posicao)] as const)
    .filter((pair): pair is [number, number] => pair[0] !== null)

  const insights: TrainingCrossInsight[] = [
    {
      titulo: 'Dano × kills',
      descricao: 'se o dano está virando eliminações',
      coeficiente: pearsonCorrelation(damageKillsPairs),
      amostras: damageKillsPairs.length,
      leitura: '',
    },
    {
      titulo: 'Kills × colocação',
      descricao: 'relação entre eliminações e melhor posição',
      coeficiente: pearsonCorrelation(killsPlacementPairs),
      amostras: killsPlacementPairs.length,
      leitura: '',
    },
    {
      titulo: 'Sobrevivência × colocação',
      descricao: 'se permanecer vivo acompanha resultado',
      coeficiente: pearsonCorrelation(survivalPlacementPairs),
      amostras: survivalPlacementPairs.length,
      leitura: '',
    },
  ]
  insights[0].leitura = relationLabel(insights[0].coeficiente, 'mais dano acompanha mais kills', 'mais dano não acompanha mais kills')
  insights[1].leitura = relationLabel(insights[1].coeficiente, 'mais kills acompanham melhor colocação', 'mais kills não acompanham melhor colocação')
  insights[2].leitura = relationLabel(insights[2].coeficiente, 'mais sobrevivência acompanha melhor colocação', 'mais sobrevivência não acompanha melhor colocação')

  const players = new Map<string, { nick: string; quedas: number; abates: number; dano: number; assistencias: number; sobrevivencia: number[]; mapas: Map<string, { quedas: number; abates: number; dano: number }> }>()
  for (const drop of training.quedas_detalhe) {
    for (const player of drop.jogadores_detalhados) {
      const key = player.player_id || player.campeonato_jogador_id || player.nick
      const current = players.get(key) || { nick: player.nick, quedas: 0, abates: 0, dano: 0, assistencias: 0, sobrevivencia: [] as number[], mapas: new Map<string, { quedas: number; abates: number; dano: number }>() }
      current.quedas += 1
      current.abates += Number(player.abates || 0)
      current.dano += Number(player.dano || 0)
      current.assistencias += Number(player.assistencias || 0)
      if (Number(player.sobrevivencia_segundos || 0) > 0) current.sobrevivencia.push(Number(player.sobrevivencia_segundos))
      const mapName = (drop.mapa_codigo || 'Mapa não definido').trim()
      const map = current.mapas.get(mapName) || { quedas: 0, abates: 0, dano: 0 }
      map.quedas += 1
      map.abates += Number(player.abates || 0)
      map.dano += Number(player.dano || 0)
      current.mapas.set(mapName, map)
      players.set(key, current)
    }
  }

  const jogadores: TrainingPlayerAnalytics[] = [...players.entries()].map(([chave, player]) => ({
    chave,
    nick: player.nick,
    quedas: player.quedas,
    abates: player.abates,
    dano: player.dano,
    assistencias: player.assistencias,
    sobrevivencia_media: player.sobrevivencia.length ? player.sobrevivencia.reduce((sum, value) => sum + value, 0) / player.sobrevivencia.length : null,
    mapas: [...player.mapas.entries()].map(([nome, map]) => ({
      nome,
      quedas: map.quedas,
      abates_media: map.abates / map.quedas,
      dano_media: map.dano / map.quedas,
    })).sort((a, b) => b.abates_media - a.abates_media || b.dano_media - a.dano_media),
  })).sort((a, b) => b.abates - a.abates || b.dano - a.dano)

  return { insights, jogadores }
}

function TrainingTrendChart(props: {
  title: string
  subtitle: string
  points: TrainingTrendPoint[]
  format: (value: number) => string
  lowerIsBetter?: boolean
}) {
  const available = props.points.filter((point): point is { label: string; value: number } => point.value !== null && Number.isFinite(point.value))
  if (available.length < 2) {
    return (
      <article className="team-training-chart is-empty">
        <div><strong>{props.title}</strong><small>{props.subtitle}</small></div>
        <span>Dados insuficientes</span>
      </article>
    )
  }

  const rawValues = available.map((point) => point.value)
  const min = Math.min(...rawValues)
  const max = Math.max(...rawValues)
  const spread = Math.max(1, max - min)
  const width = 320
  const height = 96
  const padX = 8
  const padY = 10
  const plotWidth = width - padX * 2
  const plotHeight = height - padY * 2
  const coords = available.map((point, index) => {
    const x = available.length === 1 ? width / 2 : padX + (index / (available.length - 1)) * plotWidth
    const normalized = (point.value - min) / spread
    const yValue = props.lowerIsBetter ? normalized : 1 - normalized
    const y = padY + yValue * plotHeight
    return { ...point, x, y }
  })
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const latest = available[available.length - 1]

  return (
    <article className="team-training-chart">
      <div className="team-training-chart-head">
        <span><strong>{props.title}</strong><small>{props.subtitle}</small></span>
        <b>{props.format(latest.value)}</b>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${props.title} por queda`}>
        <path className="team-training-chart-line" d={path} />
        {coords.map((point) => <circle key={`${point.label}:${point.x}`} className="team-training-chart-point" cx={point.x} cy={point.y} r="3" />)}
      </svg>
      <div className="team-training-chart-labels">
        {available.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </article>
  )
}

type Lineup = {
  campeonato_equipe_id: string
  campeonato_id: string
  equipe_id: string
  equipe_nome?: string
  line_id: string
  grupo_id: string
  slot_equipe: number | null
  campeonato_nome: string
  line_nome: string
  line_logo_url?: string | null
  grupo_nome?: string | null
  fase_nome?: string | null
  limite_jogadores: number
  jogadores_confirmados: number
  vagas_disponiveis: number
  link_id?: string | null
  link_token?: string | null
  link_ativo?: boolean | null
  link_expira_em?: string | null
  data_jogo?: string | null
  horario?: string | null
  jogadores: Array<any>
}

export function EquipePanel(props: {
  accountType: string | null
  teams: DropZoneRow[]
  managedTeams: DropZoneRow[]
  managedChampionships: DropZoneRow[]
  managedLinks: DropZoneRow[]
  tokens: DropZoneRow[]
  registrations: DropZoneRow[]
  playerTeams: DropZoneRow[]
  teamLines: DropZoneRow[]
  lineupRules: DropZoneRow[]
  team: { nome: string; tag: string; logo_url: string; senha_dono: string }
  setTeam: (value: any) => void
  createTeam: () => void
  teamPlayerChampId: string
  setTeamPlayerChampId: (value: string) => void
  teamPlayerTeamId: string
  setTeamPlayerTeamId: (value: string) => void
  generatePlayerInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [tab, setTab] = useState<'campeonatos' | 'treinos' | 'lines' | 'jogadores' | 'convites' | 'staff' | 'config'>('campeonatos')
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [expanded, setExpanded] = useState<string>('')
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupError, setLineupError] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; link: string; texto: string } | null>(null)
  const [editingInvite, setEditingInvite] = useState<Lineup | null>(null)
  const [inviteLimit, setInviteLimit] = useState('')
  const [inviteExpiresAt, setInviteExpiresAt] = useState('')
  const [copiedLineupId, setCopiedLineupId] = useState('')
  const [rosterInvite, setRosterInvite] = useState<{ teamId: string; teamName: string; texto: string } | null>(null)
  const [trainings, setTrainings] = useState<TeamTraining[]>([])
  const [trainingExpanded, setTrainingExpanded] = useState('')
  const [trainingLoading, setTrainingLoading] = useState(false)
  const [trainingError, setTrainingError] = useState('')
  const [trainingDropSaving, setTrainingDropSaving] = useState('')
  const [trainingDropSaved, setTrainingDropSaved] = useState('')

  // Staff / managers
  const [staffTeamId, setStaffTeamId] = useState('')
  const [staffList, setStaffList] = useState<any[]>([])
  const [staffConvites, setStaffConvites] = useState<any[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [staffMsg, setStaffMsg] = useState('')
  const [staffQuery, setStaffQuery] = useState('')
  const [staffSearch, setStaffSearch] = useState<any[]>([])
  const [staffSelected, setStaffSelected] = useState<any | null>(null)
  const [staffMessage, setStaffMessage] = useState('')
  const [staffValidade, setStaffValidade] = useState('7')
  const [staffPerms, setStaffPerms] = useState({
    pode_ver: true,
    pode_editar: false,
    pode_escalar: true,
    pode_gerar_token: false,
  })
  const [showStaffInvite, setShowStaffInvite] = useState(false)
  const [staffDetail, setStaffDetail] = useState<any | null>(null)
  const [staffDetailPerms, setStaffDetailPerms] = useState({
    pode_ver: true,
    pode_editar: false,
    pode_escalar: true,
    pode_gerar_token: false,
  })
  const [staffBusy, setStaffBusy] = useState(false)
  const teamLines = useMemo(() => props.teamLines.filter((line) => line.ref_id && props.managedTeams.some((team) => team.id === line.ref_id)), [props.teamLines, props.managedTeams])
  const teamPlayers = useMemo(() => props.playerTeams.filter((row) => row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id)), [props.playerTeams, props.managedTeams])
  const showStaffTools = props.accountType !== 'manager'
  const championshipStats = useMemo(() => {
    const championshipIds = new Set(lineups.map((lineup) => lineup.campeonato_id).filter(Boolean))
    const incomplete = lineups.filter((lineup) => Number(lineup.jogadores_confirmados || 0) < Number(lineup.limite_jogadores || 0)).length
    const activeLinks = lineups.filter((lineup) => Boolean(lineup.link_token)).length
    const nextGame = [...lineups]
      .filter((lineup) => lineup.data_jogo)
      .sort((a, b) => `${a.data_jogo} ${a.horario || ''}`.localeCompare(`${b.data_jogo} ${b.horario || ''}`))[0]
    const playersInLineups = new Set(
      lineups.flatMap((lineup) => (lineup.jogadores || []).map((player) => String(player.id || player.jogador_id || player.equipe_jogador_id || player.nick))).filter(Boolean),
    )
    return {
      campeonatos: championshipIds.size,
      lines: teamLines.length || new Set(lineups.map((lineup) => lineup.line_id).filter(Boolean)).size,
      jogadores: Math.max(teamPlayers.length, playersInLineups.size),
      incompletas: incomplete,
      links: activeLinks,
      nextGame,
    }
  }, [lineups, teamLines.length, teamPlayers.length])

  useEffect(() => { void loadLineups() }, [])

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section')
    if (section === 'campeonatos' || section === 'treinos' || section === 'lines' || section === 'jogadores' || section === 'convites' || section === 'staff' || section === 'config') {
      setTab(section)
    }
  }, [])

  useEffect(() => {
    if (props.managedTeams[0]?.id && !staffTeamId) setStaffTeamId(props.managedTeams[0].id)
  }, [props.managedTeams, staffTeamId])

  useEffect(() => {
    if (tab === 'staff' && staffTeamId) void loadStaff()
  }, [tab, staffTeamId])

  useEffect(() => {
    if (tab === 'treinos' && trainings.length === 0 && !trainingLoading) void loadTrainings()
  }, [tab])

  useEffect(() => {
    if (tab === 'staff' && !showStaffTools) setTab('campeonatos')
  }, [showStaffTools, tab])

  async function authToken() {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.')
    return data.session.access_token
  }

  async function loadStaff() {
    if (!staffTeamId) return
    setStaffLoading(true)
    setStaffError('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/equipes/${staffTeamId}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar staff.')
      setStaffList(json.staff || [])
      setStaffConvites(json.convites || [])
    } catch (err: any) {
      setStaffError(err?.message || 'Erro ao carregar staff.')
      setStaffList([])
      setStaffConvites([])
    } finally {
      setStaffLoading(false)
    }
  }

  async function searchStaffManagers() {
    setStaffError('')
    setStaffMsg('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/managers/busca?q=${encodeURIComponent(staffQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro na busca.')
      setStaffSearch(json.items || [])
      if (!(json.items || []).length) setStaffMsg('Nenhum manager encontrado.')
    } catch (err: any) {
      setStaffError(err?.message || 'Erro na busca.')
    }
  }

  async function sendStaffInvite() {
    if (!staffTeamId) return setStaffError('Selecione a equipe.')
    if (!staffSelected?.id && !staffQuery.trim()) return setStaffError('Busque e selecione um manager.')
    setStaffLoading(true)
    setStaffError('')
    setStaffMsg('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/equipes/${staffTeamId}/staff/convites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: staffSelected?.id || undefined,
          manager_username: staffSelected?.username || staffQuery,
          mensagem: staffMessage,
          validade_dias: staffValidade,
          ...staffPerms,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar convite.')
      setStaffMsg(json.mensagem || 'Convite enviado.')
      setStaffSelected(null)
      setStaffQuery('')
      setStaffSearch([])
      setStaffMessage('')
      setShowStaffInvite(false)
      await loadStaff()
    } catch (err: any) {
      setStaffError(err?.message || 'Erro ao enviar convite.')
    } finally {
      setStaffLoading(false)
    }
  }

  async function cancelStaffInvite(conviteId: string) {
    if (!staffTeamId) return
    setStaffLoading(true)
    setStaffError('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/equipes/${staffTeamId}/staff/convites`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ convite_id: conviteId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao cancelar.')
      await loadStaff()
    } catch (err: any) {
      setStaffError(err?.message || 'Erro ao cancelar.')
    } finally {
      setStaffLoading(false)
    }
  }

  async function removeStaff(managerId: string) {
    if (!staffTeamId) return
    if (!window.confirm('Remover este manager do staff?')) return
    setStaffBusy(true)
    setStaffError('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/equipes/${staffTeamId}/staff`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao remover.')
      setStaffDetail(null)
      await loadStaff()
    } catch (err: any) {
      setStaffError(err?.message || 'Erro ao remover.')
    } finally {
      setStaffBusy(false)
    }
  }

  function openStaffDetail(row: any) {
    setStaffDetail(row)
    setStaffDetailPerms({
      pode_ver: row.pode_ver !== false,
      pode_editar: Boolean(row.pode_editar),
      pode_escalar: Boolean(row.pode_escalar),
      pode_gerar_token: Boolean(row.pode_gerar_token),
    })
  }

  function openStaffInvite() {
    setShowStaffInvite(true)
    setStaffError('')
    setStaffMsg('')
    setStaffQuery('')
    setStaffSearch([])
    setStaffSelected(null)
    setStaffMessage('')
    setStaffValidade('7')
    setStaffPerms({
      pode_ver: true,
      pode_editar: false,
      pode_escalar: true,
      pode_gerar_token: false,
    })
  }

  async function saveStaffPerms() {
    if (!staffTeamId || !staffDetail?.manager_id) return
    setStaffBusy(true)
    setStaffError('')
    setStaffMsg('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/equipes/${staffTeamId}/staff`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: staffDetail.manager_id,
          ...staffDetailPerms,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar permissões.')
      setStaffMsg('Permissões atualizadas.')
      await loadStaff()
      // reabre com dados frescos
      setStaffDetail((current: any) =>
        current
          ? {
              ...current,
              ...staffDetailPerms,
            }
          : current,
      )
    } catch (err: any) {
      setStaffError(err?.message || 'Erro ao salvar permissões.')
    } finally {
      setStaffBusy(false)
    }
  }

  async function loadTrainings() {
    setTrainingLoading(true)
    setTrainingError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/treinos', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar treinos.')
      setTrainings(Array.isArray(json.treinos) ? json.treinos : [])
    } catch (error: any) {
      setTrainingError(error?.message || 'Erro ao carregar treinos.')
      setTrainings([])
    } finally {
      setTrainingLoading(false)
    }
  }

  function patchTrainingDrop(campeonatoEquipeId: string, partidaId: string, patch: Record<string, string>) {
    setTrainings((current) => current.map((training) => training.campeonato_equipe_id !== campeonatoEquipeId
      ? training
      : {
          ...training,
          quedas_detalhe: training.quedas_detalhe.map((drop) => drop.partida_id === partidaId ? { ...drop, ...patch } : drop),
        }))
    setTrainingDropSaved('')
  }

  async function saveTrainingDrop(training: TeamTraining, drop: TeamTraining['quedas_detalhe'][number]) {
    const key = `${training.campeonato_equipe_id}:${drop.partida_id}`
    setTrainingDropSaving(key)
    setTrainingDropSaved('')
    setTrainingError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/treinos', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campeonato_equipe_id: training.campeonato_equipe_id,
          partida_id: drop.partida_id,
          call_nome: drop.call_nome,
          primeira_safe: drop.primeira_safe,
          segunda_safe: drop.segunda_safe,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar análise da queda.')
      const saved = json.anotacao || {}
      patchTrainingDrop(training.campeonato_equipe_id, drop.partida_id, {
        call_nome: String(saved.call_nome || ''),
        primeira_safe: String(saved.primeira_safe || ''),
        segunda_safe: String(saved.segunda_safe || ''),
      })
      setTrainingDropSaved(key)
    } catch (error: any) {
      setTrainingError(error?.message || 'Erro ao salvar análise da queda.')
    } finally {
      setTrainingDropSaving('')
    }
  }

  async function loadLineups() {
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/escalacoes', { headers: { Authorization: `Bearer ${token}` } })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar escalações.')
      setLineups(json.escalacoes || [])
    } catch (error: any) {
      setLineupError(error?.message || 'Erro ao carregar escalações.')
    } finally {
      setLineupLoading(false)
    }
  }

  async function createRosterInvite(team: DropZoneRow) {
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipes/convites-elenco', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ equipe_id: team.id }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao criar convite de equipe.')
      setRosterInvite({ teamId: team.id, teamName: rowTitle(team), texto: String(json.texto || json.url || '') })
    } catch (error: any) { setLineupError(error?.message || 'Erro ao criar convite de equipe.') }
    finally { setLineupLoading(false) }
  }

  async function createLineupLink(lineup: Lineup) {
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/escalacoes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_equipe_id: lineup.campeonato_equipe_id, limite_jogadores: lineup.limite_jogadores }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao gerar link.')
      setGeneratedInvite({
        token: String(json.token || json.link?.token || ''),
        link: String(json.public_url || ''),
        texto: String(json.texto || ''),
      })
      await loadLineups()
    } catch (error: any) {
      setLineupError(error?.message || 'Erro ao gerar link.')
    } finally {
      setLineupLoading(false)
    }
  }

  function openInviteEditor(lineup: Lineup) {
    setEditingInvite(lineup)
    setInviteLimit(String(lineup.limite_jogadores || 6))
    // datetime-local espera horário local — toISOString().slice usava UTC e "encurtava" a validade
    if (lineup.link_expira_em) {
      const d = new Date(lineup.link_expira_em)
      const pad = (n: number) => String(n).padStart(2, '0')
      setInviteExpiresAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      )
    } else {
      setInviteExpiresAt('')
    }
  }

  async function updateLineupInvite() {
    if (!editingInvite?.link_id) return
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/escalacoes', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: editingInvite.link_id,
          limite_jogadores: Number(inviteLimit || editingInvite.limite_jogadores || 6),
          expira_em: inviteExpiresAt ? new Date(inviteExpiresAt).toISOString() : null,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao alterar token.')
      setEditingInvite(null)
      await loadLineups()
    } catch (error: any) {
      setLineupError(error?.message || 'Erro ao alterar token.')
    } finally {
      setLineupLoading(false)
    }
  }

  async function removeLineupInvite(lineup: Lineup) {
    if (!lineup.link_id || !window.confirm('Remover este token de escalação? O link deixará de funcionar.')) return
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch(`/api/equipe/escalacoes?link_id=${encodeURIComponent(lineup.link_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao remover token.')
      await loadLineups()
    } catch (error: any) {
      setLineupError(error?.message || 'Erro ao remover token.')
    } finally {
      setLineupLoading(false)
    }
  }

  async function removePlayer(playerId: string) {
    if (!window.confirm('Remover este jogador da escalação?')) return
    setLineupLoading(true)
    setLineupError('')
    try {
      const token = await authToken()
      const response = await fetch('/api/equipe/escalacoes', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogador_inscricao_id: playerId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao remover jogador.')
      setLineups((current) => current.map((lineup) => ({
        ...lineup,
        jogadores: lineup.jogadores.filter((player) => player.id !== playerId),
        jogadores_confirmados: lineup.jogadores.some((player) => player.id === playerId) ? Math.max(0, lineup.jogadores_confirmados - 1) : lineup.jogadores_confirmados,
        vagas_disponiveis: lineup.jogadores.some((player) => player.id === playerId) ? Math.min(lineup.limite_jogadores, lineup.vagas_disponiveis + 1) : lineup.vagas_disponiveis,
      })))
    } catch (error: any) {
      setLineupError(error?.message || 'Erro ao remover jogador.')
    } finally {
      setLineupLoading(false)
    }
  }

  async function copyLink(value: string, lineupId = '') {
    await navigator.clipboard.writeText(value)
    setCopiedLineupId(lineupId)
    window.setTimeout(() => setCopiedLineupId((current) => current === lineupId ? '' : current), 1800)
  }

  function shareText(lineup: Lineup) {
    const url = `${window.location.origin}/escala/${lineup.link_token}`
    const date = lineup.data_jogo ? new Date(`${lineup.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'a definir'
    const time = lineup.horario ? String(lineup.horario).slice(0, 5) : 'a definir'
    return `Você recebeu um convite para participar da escalação do campeonato ${lineup.campeonato_nome}.

Equipe: ${lineup.equipe_nome || 'Equipe'}
Line: ${lineup.line_nome}
Fase: ${lineup.fase_nome || 'a definir'}
Grupo: ${lineup.grupo_nome || 'a definir'}
Vagas disponíveis: ${lineup.vagas_disponiveis} de ${lineup.limite_jogadores}
Data do jogo: ${date}
Horário: ${time}

Este mesmo link pode ser usado por todos os jogadores até o limite de vagas.

Acesse: ${url}`
  }

  return (
    <div className="dashboard team-dashboard">
      <section className="panel span-3">
        <div className="section-head">
          <div><p className="eyebrow">{props.accountType === 'manager' ? 'Manager' : 'Equipe'}</p><h2>Painel da equipe</h2></div>
          <Shield />
        </div>
        <div className="team-command-center">
          <article>
            <span><Trophy size={18} /></span>
            <div><strong>{championshipStats.campeonatos}</strong><small>campeonato(s)</small></div>
          </article>
          <article>
            <span><Users size={18} /></span>
            <div><strong>{championshipStats.jogadores}</strong><small>jogadores no elenco</small></div>
          </article>
          <article className={championshipStats.incompletas ? 'needs-action' : ''}>
            <span><Medal size={18} /></span>
            <div><strong>{championshipStats.incompletas}</strong><small>escalação(ões) incompleta(s)</small></div>
          </article>
          <article>
            <span><Link2 size={18} /></span>
            <div><strong>{championshipStats.links}</strong><small>link(s) ativo(s)</small></div>
          </article>
        </div>
        <div className="team-next-game-card">
          <div>
            <p className="eyebrow">Próximo compromisso</p>
            <strong>{championshipStats.nextGame?.campeonato_nome || 'Nenhum jogo com data definida'}</strong>
            <span>
              {championshipStats.nextGame
                ? `${championshipStats.nextGame.line_nome} · ${championshipStats.nextGame.grupo_nome || 'grupo a definir'} · ${championshipStats.nextGame.data_jogo ? new Date(`${championshipStats.nextGame.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'data a definir'} ${championshipStats.nextGame.horario ? `às ${String(championshipStats.nextGame.horario).slice(0, 5)}` : ''}`
                : 'Quando um campeonato tiver jogo marcado, ele aparece aqui com ação rápida.'}
            </span>
          </div>
          {championshipStats.nextGame ? (
            <button type="button" className="button compact" onClick={() => { setTab('campeonatos'); setExpanded(championshipStats.nextGame?.campeonato_equipe_id || '') }}>
              Escalar elenco
            </button>
          ) : null}
        </div>
        <div className="tabs panel-tabs team-panel-tabs">
          <button className={`tab ${tab === 'campeonatos' ? 'active' : ''}`} onClick={() => setTab('campeonatos')}>Campeonatos</button>
          <button className={`tab ${tab === 'treinos' ? 'active' : ''}`} onClick={() => setTab('treinos')}>Treinos</button>
          <button className={`tab ${tab === 'lines' ? 'active' : ''}`} onClick={() => setTab('lines')}>Lines</button>
          <button className={`tab ${tab === 'jogadores' ? 'active' : ''}`} onClick={() => setTab('jogadores')}>Jogadores</button>
          <button className={`tab ${tab === 'convites' ? 'active' : ''}`} onClick={() => setTab('convites')}>Convites</button>
          {showStaffTools ? <button className={`tab ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>Staff</button> : null}
          <button className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>Configurações</button>
        </div>

        {lineupError ? <div className="message error">{lineupError}</div> : null}

        {tab === 'campeonatos' ? <div className="panel-tab-body">
          <div className="team-section-title"><div><p className="eyebrow">Participações</p><h3>Meus campeonatos</h3></div><button className="button secondary compact" onClick={() => void loadLineups()} disabled={lineupLoading}>Atualizar</button></div>
          {lineupLoading && lineups.length === 0 ? <p className="empty">Carregando campeonatos...</p> : null}
          {lineups.length === 0 && !lineupLoading ? <p className="empty">Esta equipe ainda não possui line inscrita em campeonato.</p> : null}
          <div className="team-championship-list">
            {lineups.map((lineup) => {
              const isOpen = expanded === lineup.campeonato_equipe_id
              const slots = Array.from({ length: Number(lineup.limite_jogadores || 0) }, (_, index) => lineup.jogadores.find((player) => Number(player.slot_numero) === index + 1))
              return <article className="team-championship-card" key={lineup.campeonato_equipe_id}>
                <button className="team-championship-head" onClick={() => {
                  setExpanded(isOpen ? '' : lineup.campeonato_equipe_id)
                }}>
                  <img src={lineup.line_logo_url || '/favicon.ico'} alt="" />
                  <div><strong>{lineup.campeonato_nome}</strong><span>{lineup.line_nome} · {lineup.fase_nome || 'Sem fase'} · {lineup.grupo_nome || 'Sem grupo'} · Slot {lineup.slot_equipe || '-'}</span></div>
                  <div className="team-championship-status"><b>{lineup.jogadores_confirmados}/{lineup.limite_jogadores}</b><span>escalação</span></div>
                  <ChevronDown className={isOpen ? 'rotated' : ''} />
                </button>
                <div className="team-championship-quick-actions">
                  <button type="button" onClick={() => setExpanded(isOpen ? '' : lineup.campeonato_equipe_id)}>
                    <Users size={14} /> Escalar elenco
                  </button>
                  {lineup.link_token ? (
                    <>
                      <button type="button" onClick={() => void copyLink(shareText(lineup), lineup.campeonato_equipe_id)}>
                        <Copy size={14} /> Copiar link
                      </button>
                      <button type="button" onClick={() => void copyLink(String(lineup.link_token), `token:${lineup.campeonato_equipe_id}`)}>
                        <Copy size={14} /> Copiar token
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void createLineupLink(lineup)} disabled={lineupLoading}>
                      <Link2 size={14} /> Gerar link
                    </button>
                  )}
                  <a href={`/campeonatos/${lineup.campeonato_id}`}>Ver campeonato <ChevronRight size={14} /></a>
                </div>
                {isOpen ? <div className="team-championship-body">
                  <div className="team-game-info">
                    <span><CalendarDays size={16}/>{lineup.data_jogo ? new Date(`${lineup.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'Data ainda não definida'}</span>
                    <span>{lineup.horario ? `${String(lineup.horario).slice(0, 5)}h` : 'Horário ainda não definido'}</span>
                  </div>
                  <div className="lineup-slots">{slots.map((player, index) => <div className={`lineup-slot ${player ? 'occupied' : ''}`} key={index}>
                    <b>{index + 1}</b>
                    {player ? <><img src={player.foto_url || '/favicon.ico'} alt=""/><div><strong>{player.nick}</strong><span>{player.funcao}{player.capitao ? ' · Capitão' : ''}</span></div><button className="icon-button danger" title="Remover jogador" onClick={() => void removePlayer(player.id)}><Trash2 size={15}/></button></> : <span>Slot disponível</span>}
                  </div>)}</div>
                  <div className="button-row lineup-actions">
                    {lineup.link_token ? <>
                      <button className={`button ${copiedLineupId === lineup.campeonato_equipe_id ? 'copied' : ''}`} onClick={() => void copyLink(shareText(lineup), lineup.campeonato_equipe_id)}><Copy size={15}/> {copiedLineupId === lineup.campeonato_equipe_id ? 'Link copiado' : 'Copiar link'}</button>
                      <button className={`button secondary ${copiedLineupId === `token:${lineup.campeonato_equipe_id}` ? 'copied' : ''}`} onClick={() => void copyLink(String(lineup.link_token), `token:${lineup.campeonato_equipe_id}`)}><Copy size={15}/> {copiedLineupId === `token:${lineup.campeonato_equipe_id}` ? 'Token copiado' : 'Copiar só token'}</button>
                      <button className="button secondary" onClick={() => openInviteEditor(lineup)}>Alterar</button>
                      <button className="button secondary danger" onClick={() => void removeLineupInvite(lineup)}><Trash2 size={15}/> Remover</button>
                    </> : <button className="button" onClick={() => void createLineupLink(lineup)} disabled={lineupLoading}><Link2 size={15}/> Criar link</button>}
                  </div>
                </div> : null}
              </article>
            })}
          </div>
        </div> : null}

        {tab === 'treinos' ? (
          <div className="panel-tab-body team-trainings-tab">
            <div className="team-section-title">
              <div>
                <p className="eyebrow">Desempenho competitivo</p>
                <h3>Treinos da equipe</h3>
                <small>Resultados gerais podem aparecer na tabela do treino. A análise detalhada abaixo é privada da própria equipe.</small>
              </div>
              <button className="button secondary compact" type="button" onClick={() => void loadTrainings()} disabled={trainingLoading}>
                {trainingLoading ? <Loader2 className="spin" size={14} /> : <Activity size={14} />} Atualizar
              </button>
            </div>

            <div className="team-training-privacy">
              <LockKeyhole size={17} />
              <div>
                <strong>Análise privada</strong>
                <span>Dano, assistências, revives e desempenho individual ficam visíveis somente para a própria equipe e usuários autorizados.</span>
              </div>
            </div>

            {trainingError ? <div className="message error">{trainingError}</div> : null}
            {trainingLoading && trainings.length === 0 ? <p className="empty">Carregando treinos...</p> : null}
            {!trainingLoading && trainings.length === 0 ? (
              <div className="team-training-empty">
                <Trophy size={21} />
                <div>
                  <strong>Nenhum Xtreino encontrado</strong>
                  <span>Quando a equipe participar de um campeonato do tipo Xtreino, ele aparecerá aqui automaticamente.</span>
                </div>
              </div>
            ) : null}

            <div className="team-training-list">
              {trainings.map((training) => {
                const isOpen = trainingExpanded === training.campeonato_equipe_id
                const analytics = buildTrainingAnalytics(training)
                const crossAnalytics = buildTrainingCrossAnalytics(training)
                return (
                  <article className={`team-training-row ${isOpen ? 'is-open' : ''}`} key={training.campeonato_equipe_id}>
                    <button
                      type="button"
                      className="team-training-summary"
                      onClick={() => setTrainingExpanded(isOpen ? '' : training.campeonato_equipe_id)}
                      aria-expanded={isOpen}
                    >
                      <img src={training.logo_url || '/favicon.ico'} alt="" />
                      <span className="team-training-identity">
                        <strong>{training.nome}</strong>
                        <small>{[training.line_nome, training.fase_nome, training.grupo_nome].filter(Boolean).join(' · ') || 'Xtreino'}</small>
                      </span>
                      <span className="team-training-metric"><b>{training.quedas}</b><small>quedas</small></span>
                      <span className="team-training-metric"><b>{training.abates}</b><small>abates</small></span>
                      <span className="team-training-metric"><b>{training.melhor_posicao ? `${training.melhor_posicao}º` : '—'}</b><small>melhor</small></span>
                      <ChevronDown className={isOpen ? 'rotated' : ''} size={18} />
                    </button>

                    {isOpen ? (
                      <div className="team-training-details">
                        <div className="team-training-private-head">
                          <div>
                            <span><LockKeyhole size={14} /> Privado da equipe</span>
                            <strong>Resumo de desempenho</strong>
                          </div>
                          <a href={`/campeonatos/${training.campeonato_id}`}>Ver Xtreino <ChevronRight size={14} /></a>
                        </div>

                        <div className="team-training-kpis">
                          <article><small>Colocação média</small><strong>{training.colocacao_media ? training.colocacao_media.toFixed(1) : '—'}</strong></article>
                          <article><small>Booyahs</small><strong>{training.booyahs}</strong></article>
                          <article><small>Pontos</small><strong>{training.pontos_total}</strong></article>
                          <article><small>Dano</small><strong>{Math.round(training.dano).toLocaleString('pt-BR')}</strong></article>
                          <article><small>Assistências</small><strong>{training.assistencias}</strong></article>
                          <article><small>Revives</small><strong>{training.revives}</strong></article>
                        </div>

                        <section className="team-training-analytics" aria-label="Gráficos privados de desempenho">
                          <div className="team-training-player-head">
                            <strong>Evolução do treino</strong>
                            <small>Leitura privada por queda. Os gráficos usam somente resultados e telemetria desta equipe.</small>
                          </div>
                          <div className="team-training-chart-grid">
                            <TrainingTrendChart
                              title="Colocação"
                              subtitle="posição por queda"
                              points={analytics.trend.map((point) => ({ label: point.label, value: point.colocacao }))}
                              format={(value) => `${Math.round(value)}º`}
                              lowerIsBetter
                            />
                            <TrainingTrendChart
                              title="Kills"
                              subtitle="abates por queda"
                              points={analytics.trend.map((point) => ({ label: point.label, value: point.abates }))}
                              format={(value) => String(Math.round(value))}
                            />
                            <TrainingTrendChart
                              title="Dano"
                              subtitle="dano da equipe por queda"
                              points={analytics.trend.map((point) => ({ label: point.label, value: point.dano }))}
                              format={(value) => Math.round(value).toLocaleString('pt-BR')}
                            />
                            <TrainingTrendChart
                              title="Sobrevivência"
                              subtitle="média dos jogadores"
                              points={analytics.trend.map((point) => ({ label: point.label, value: point.sobrevivencia }))}
                              format={(value) => `${Math.round(value / 60)} min`}
                            />
                          </div>

                          {analytics.mapas.length ? (
                            <div className="team-training-breakdown">
                              <div className="team-training-player-head">
                                <strong>Por mapa</strong>
                                <small>Comparação das quedas já processadas.</small>
                              </div>
                              <div className="team-training-breakdown-list">
                                {analytics.mapas.map((mapa) => (
                                  <article key={mapa.nome}>
                                    <strong>{mapa.nome}</strong>
                                    <span><b>{mapa.quedas}</b><small>quedas</small></span>
                                    <span><b>{mapa.colocacao_media ? mapa.colocacao_media.toFixed(1) : '—'}</b><small>posição média</small></span>
                                    <span><b>{mapa.abates_media.toFixed(1)}</b><small>kills/queda</small></span>
                                    <span><b>{Math.round(mapa.dano_media).toLocaleString('pt-BR')}</b><small>dano/queda</small></span>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {analytics.calls.length ? (
                            <div className="team-training-breakdown team-training-call-breakdown">
                              <div className="team-training-player-head">
                                <strong>Por call</strong>
                                <small>Somente calls anotadas pela própria equipe.</small>
                              </div>
                              <div className="team-training-breakdown-list">
                                {analytics.calls.map((call) => (
                                  <article key={call.nome}>
                                    <strong>{call.nome}</strong>
                                    <span><b>{call.quedas}</b><small>quedas</small></span>
                                    <span><b>{call.colocacao_media ? call.colocacao_media.toFixed(1) : '—'}</b><small>posição média</small></span>
                                    <span><b>{call.abates_media.toFixed(1)}</b><small>kills/queda</small></span>
                                    <span><b>{Math.round(call.dano_media).toLocaleString('pt-BR')}</b><small>dano/queda</small></span>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="team-training-cross">
                            <div className="team-training-player-head">
                              <strong>Leituras cruzadas</strong>
                              <small>Correlação entre quedas da própria equipe. Serve como pista de tendência, não como causa automática.</small>
                            </div>
                            <div className="team-training-cross-grid">
                              {crossAnalytics.insights.map((insight) => (
                                <article key={insight.titulo} className={insight.coeficiente === null ? 'is-empty' : ''}>
                                  <span><strong>{insight.titulo}</strong><small>{insight.descricao}</small></span>
                                  <b>{insight.coeficiente === null ? '—' : insight.coeficiente.toFixed(2)}</b>
                                  <p>{insight.leitura}</p>
                                  <small>{insight.amostras} quedas comparadas</small>
                                </article>
                              ))}
                            </div>
                          </div>

                          {crossAnalytics.jogadores.length ? (
                            <div className="team-training-player-performance">
                              <div className="team-training-player-head">
                                <strong>Desempenho por jogador</strong>
                                <small>Totais do treino e leitura por mapa usando somente a telemetria privada.</small>
                              </div>
                              <div className="team-training-player-performance-list">
                                {crossAnalytics.jogadores.map((player) => (
                                  <details key={player.chave}>
                                    <summary>
                                      <strong>{player.nick}</strong>
                                      <span><b>{player.abates}</b><small>kills</small></span>
                                      <span><b>{Math.round(player.dano).toLocaleString('pt-BR')}</b><small>dano</small></span>
                                      <span><b>{player.assistencias}</b><small>assist.</small></span>
                                      <span><b>{player.sobrevivencia_media ? `${Math.round(player.sobrevivencia_media / 60)} min` : '—'}</b><small>sobreviv.</small></span>
                                      <ChevronDown size={15} />
                                    </summary>
                                    <div className="team-training-player-map-list">
                                      {player.mapas.map((mapa) => (
                                        <article key={`${player.chave}:${mapa.nome}`}>
                                          <strong>{mapa.nome}</strong>
                                          <span><b>{mapa.quedas}</b><small>quedas</small></span>
                                          <span><b>{mapa.abates_media.toFixed(1)}</b><small>kills/queda</small></span>
                                          <span><b>{Math.round(mapa.dano_media).toLocaleString('pt-BR')}</b><small>dano/queda</small></span>
                                        </article>
                                      ))}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </section>

                        <div className="team-training-drops">\n                          <div className="team-training-player-head">
                            <strong>Análise por queda</strong>
                            <small>Call e leitura de safe ficam privadas para sua equipe.</small>
                          </div>

                          {training.quedas_detalhe.length === 0 ? (
                            <p className="empty">As quedas aparecerão aqui depois que o resultado for processado.</p>
                          ) : training.quedas_detalhe.map((drop) => {
                            const saveKey = `${training.campeonato_equipe_id}:${drop.partida_id}`
                            return (
                              <article className="team-training-drop" key={drop.partida_id}>
                                <header>
                                  <span><b>Q{drop.numero_partida || '?'}</b><strong>{drop.mapa_codigo || 'Mapa não definido'}</strong></span>
                                  <div>
                                    <span><b>{drop.posicao ? `${drop.posicao}º` : '—'}</b><small>posição</small></span>
                                    <span><b>{drop.abates}</b><small>kills</small></span>
                                    <span><b>{Math.round(drop.dano).toLocaleString('pt-BR')}</b><small>dano</small></span>
                                    <span><b>{drop.assistencias}</b><small>assist.</small></span>
                                    <span><b>{drop.revives}</b><small>revives</small></span>
                                  </div>
                                </header>

                                {drop.telemetria_garena ? (
                                  <details className="team-training-telemetry">
                                    <summary>
                                      <span><Activity size={14} /><strong>Telemetria Garena</strong></span>
                                      <small>{drop.jogadores_detalhados.length} jogador(es) · privado</small>
                                    </summary>
                                    <div className="team-training-telemetry-players">
                                      {drop.jogadores_detalhados.map((player) => {
                                        const minutes = Math.floor(player.sobrevivencia_segundos / 60)
                                        const seconds = player.sobrevivencia_segundos % 60
                                        return (
                                          <article className="team-training-telemetry-player" key={`${drop.partida_id}:${player.player_id}`}>
                                            <header>
                                              <strong>{player.nick}</strong>
                                              <span>{player.abates} K · {Math.round(player.dano).toLocaleString('pt-BR')} dano</span>
                                            </header>
                                            <div className="team-training-telemetry-metrics">
                                              <span><b>{player.assistencias}</b><small>assist.</small></span>
                                              <span><b>{player.headshots}</b><small>headshots</small></span>
                                              <span><b>{player.knockdowns}</b><small>knocks</small></span>
                                              <span><b>{player.precisao_percentual.toFixed(1)}%</b><small>precisão</small></span>
                                              <span><b>{minutes}:{String(seconds).padStart(2, '0')}</b><small>sobreviv.</small></span>
                                              <span><b>{player.revives}</b><small>revives</small></span>
                                            </div>
                                            {player.armas.length ? (
                                              <div className="team-training-telemetry-line">
                                                <small>Armas</small>
                                                <div>{player.armas.map((weapon, index) => (
                                                  <span key={`${player.player_id}:weapon:${index}`}>
                                                    <b>{weapon.arma}</b> {weapon.abates} K · {Math.round(weapon.dano).toLocaleString('pt-BR')} dano · {weapon.precisao_percentual.toFixed(1)}%
                                                  </span>
                                                ))}</div>
                                              </div>
                                            ) : null}
                                            {player.habilidades.length ? (
                                              <div className="team-training-telemetry-line">
                                                <small>Habilidades</small>
                                                <div>{player.habilidades.map((skill, index) => (
                                                  <span key={`${player.player_id}:skill:${index}`}>
                                                    <b>{skill.personagem || skill.habilidade || 'Habilidade'}</b>{skill.habilidade && skill.personagem ? ` · ${skill.habilidade}` : ''}<em>{skill.tipo}</em>
                                                  </span>
                                                ))}</div>
                                              </div>
                                            ) : null}
                                            <div className="team-training-telemetry-secondary">
                                              <span>Distância {Math.round(player.distancia_movida).toLocaleString('pt-BR')} m</span>
                                              <span>Maior abate {Math.round(player.distancia_max_abate).toLocaleString('pt-BR')} m</span>
                                              <span>Granadas {player.granadas_usadas}</span>
                                              <span>Gel {player.gel_usado}</span>
                                              <span>Kits {player.kits_medicos}</span>
                                            </div>
                                          </article>
                                        )
                                      })}
                                    </div>
                                  </details>
                                ) : (
                                  <div className="team-training-telemetry-waiting">
                                    <Activity size={14} />
                                    <span>Telemetria detalhada ainda não disponível para esta queda.</span>
                                  </div>
                                )}

                                {(training.configuracao_analise.call_fixa || training.configuracao_analise.primeira_safe || training.configuracao_analise.segunda_safe) ? (
                                  <div className="team-training-drop-notes">
                                    {training.configuracao_analise.call_fixa ? (
                                      <Field label="Call">
                                        <input
                                          value={drop.call_nome}
                                          onChange={(event) => patchTrainingDrop(training.campeonato_equipe_id, drop.partida_id, { call_nome: event.target.value })}
                                          placeholder="Ex.: Clock Tower"
                                        />
                                      </Field>
                                    ) : null}
                                    {training.configuracao_analise.primeira_safe ? (
                                      <Field label="1ª safe">
                                        <input
                                          value={drop.primeira_safe}
                                          onChange={(event) => patchTrainingDrop(training.campeonato_equipe_id, drop.partida_id, { primeira_safe: event.target.value })}
                                          placeholder="Anote a leitura da 1ª safe"
                                        />
                                      </Field>
                                    ) : null}
                                    {training.configuracao_analise.segunda_safe ? (
                                      <Field label="2ª safe">
                                        <input
                                          value={drop.segunda_safe}
                                          onChange={(event) => patchTrainingDrop(training.campeonato_equipe_id, drop.partida_id, { segunda_safe: event.target.value })}
                                          placeholder="Anote a leitura da 2ª safe"
                                        />
                                      </Field>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="button secondary compact"
                                      disabled={trainingDropSaving === saveKey}
                                      onClick={() => void saveTrainingDrop(training, drop)}
                                    >
                                      {trainingDropSaving === saveKey ? 'Salvando...' : trainingDropSaved === saveKey ? 'Salvo' : 'Salvar análise'}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="team-training-drop-disabled">Este XTreino não foi configurado para registrar call ou safes.</p>
                                )}
                              </article>
                            )
                          })}
                        </div>

                        <div className="team-training-player-list">
                          <div className="team-training-player-head">
                            <strong>Jogadores</strong>
                            <small>Dados agregados das quedas disponíveis</small>
                          </div>
                          {training.jogadores.length === 0 ? <p className="empty">Ainda não há estatísticas individuais processadas.</p> : null}
                          {training.jogadores.map((player) => (
                            <div className="team-training-player" key={player.campeonato_jogador_id}>
                              <img src={player.foto_url || '/favicon.ico'} alt="" />
                              <span><strong>{player.nick}</strong><small>{player.id_jogo ? `ID ${player.id_jogo}` : `${player.quedas} queda(s)`}</small></span>
                              <span><b>{player.abates}</b><small>Kills</small></span>
                              <span><b>{Math.round(player.dano).toLocaleString('pt-BR')}</b><small>Dano</small></span>
                              <span><b>{player.assistencias}</b><small>Assist.</small></span>
                              <span><b>{player.revives}</b><small>Revives</small></span>
                            </div>
                          ))}
                        </div>

                        <p className="team-training-next-note">
                          Call, safes, telemetria e gráficos de desempenho ficam privados para a própria equipe.
                        </p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </div>
        ) : null}

        {tab === 'lines' ? (
          <EquipeLinesEditor
            teams={props.managedTeams}
            uploadPublicFile={props.uploadPublicFile}
            lineups={lineups}
          />
        ) : null}

        {tab === 'jogadores' ? <div className="panel-tab-body"><div className="team-section-title"><div><p className="eyebrow">Elenco</p><h3>Jogadores da equipe</h3></div><span className="count-pill"><Users size={14}/>{teamPlayers.length}</span></div>{teamPlayers.length === 0 ? <p className="empty">Nenhum jogador vinculado ao elenco.</p> : null}<div className="team-player-grid">{teamPlayers.map((row) => <article className="team-player-card" key={row.id}><img src={dataText(row, 'foto_url') || '/favicon.ico'} alt=""/><div><strong>{dataText(row, 'nick') || rowTitle(row)}</strong><span>ID {dataText(row, 'id_jogo') || '-'}</span><small>{dataText(row, 'funcao') || 'Função não informada'}</small></div></article>)}</div></div> : null}

        {tab === 'convites' ? <div className="panel-tab-body"><div className="panel-soft"><h3>Convidar jogador para a equipe</h3><p>Envie diretamente pelo correio ou gere um link compartilhável. O jogador pode aceitar ou recusar.</p>{props.managedTeams.map((team) => <PlayerTeamRequest key={team.id} mode="invite_player" equipeId={team.id}/>)}<div className="token-list">{props.managedTeams.map((team) => <button key={team.id} className="token-card" onClick={() => void createRosterInvite(team)} disabled={lineupLoading}><span>{rowTitle(team)}</span><strong>Criar link de convite</strong><Link2 size={15}/></button>)}</div></div><div className="panel-soft"><h3>Links ativos de escalação</h3>{lineups.filter((lineup) => lineup.link_token).length === 0 ? <p className="empty">Nenhum link gerado.</p> : null}<div className="lineup-token-list">{lineups.filter((lineup) => lineup.link_token).map((lineup) => <article className="lineup-token-card" key={lineup.campeonato_equipe_id}><div><span>{lineup.campeonato_nome}</span><strong>{lineup.line_nome}</strong><small>Link ativo e protegido.</small></div><div className="button-row"><button className={`button compact ${copiedLineupId === lineup.campeonato_equipe_id ? 'copied' : ''}`} onClick={() => void copyLink(shareText(lineup), lineup.campeonato_equipe_id)}><Copy size={15}/>{copiedLineupId === lineup.campeonato_equipe_id ? 'Convite copiado' : 'Copiar convite'}</button><button className={`button secondary compact ${copiedLineupId === `token:${lineup.campeonato_equipe_id}` ? 'copied' : ''}`} onClick={() => void copyLink(String(lineup.link_token), `token:${lineup.campeonato_equipe_id}`)}><Copy size={15}/>{copiedLineupId === `token:${lineup.campeonato_equipe_id}` ? 'Token copiado' : 'Copiar só token'}</button></div></article>)}</div></div></div> : null}

        {tab === 'staff' ? (
          <div className="panel-tab-body staff-tab">
            <div className="subtab-actionbar">
              <div>
                <p className="eyebrow">Managers</p>
                <h3>Staff da equipe</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {props.managedTeams.length > 1 ? (
                  <select value={staffTeamId} onChange={(e) => { setStaffTeamId(e.target.value); setStaffDetail(null) }}>
                    {props.managedTeams.map((team) => (
                      <option key={team.id} value={team.id}>{rowTitle(team)}</option>
                    ))}
                  </select>
                ) : null}
                <button type="button" className="button" onClick={openStaffInvite}>
                  <Plus size={16} /> Convidar
                </button>
              </div>
            </div>

            {staffError ? <div className="message error">{staffError}</div> : null}
            {staffMsg ? <div className="message success">{staffMsg}</div> : null}

            {staffLoading && staffList.length === 0 ? (
              <p className="empty">Carregando...</p>
            ) : null}

            {!staffLoading && staffList.length === 0 && staffConvites.filter((c) => c.status === 'pendente').length === 0 ? (
              <div className="vagas-empty-filter">
                Nenhum manager no staff. Use <strong>Convidar</strong> para enviar pelo correio.
              </div>
            ) : null}

            <div className="championship-vagas-list seller-managers-list">
              {staffList.map((row, index) => {
                const aberta = staffDetail?.id === row.id
                const permsLine = [
                  row.pode_ver ? 'ver' : null,
                  row.pode_editar ? 'editar' : null,
                  row.pode_escalar ? 'escalar' : null,
                  row.pode_gerar_token ? 'tokens' : null,
                ].filter(Boolean).join(' · ')
                return (
                  <article
                    key={row.id}
                    className={`championship-vaga-row status-ocupada ${aberta ? 'is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="vaga-row-summary"
                      onClick={() => (aberta ? setStaffDetail(null) : openStaffDetail(row))}
                      aria-expanded={aberta}
                    >
                      <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="vaga-row-avatar status-ocupada" aria-hidden>
                        {row.manager?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.manager.avatar_url} alt="" />
                        ) : (
                          <Users size={18} />
                        )}
                      </span>
                      <span className="vaga-row-identity">
                        <strong>@{row.manager?.username || '—'}</strong>
                        <small>
                          {row.manager?.nome || 'Manager'}
                          {permsLine ? ` · ${permsLine}` : ''}
                        </small>
                      </span>
                      <span className="vaga-row-meta">
                        <span className="vaga-status-pill status-ocupada">Ativo</span>
                      </span>
                      <span className="vaga-row-chevron">
                        {aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </span>
                    </button>

                    {aberta ? (
                      <div className="vaga-row-details seller-row-details">
                        <div className="seller-row-edit">
                          <div className="seller-perm-grid compact">
                            {([
                              ['pode_ver', 'Ver painel'],
                              ['pode_editar', 'Editar elenco/lines'],
                              ['pode_escalar', 'Escalar / links'],
                              ['pode_gerar_token', 'Gerar tokens'],
                            ] as const).map(([key, label]) => (
                              <label key={key} className="seller-perm-item">
                                <input
                                  type="checkbox"
                                  checked={Boolean(staffDetailPerms[key])}
                                  onChange={(e) =>
                                    setStaffDetailPerms((c) => ({ ...c, [key]: e.target.checked }))
                                  }
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="vaga-row-actions">
                            <button type="button" disabled={staffBusy} onClick={() => void saveStaffPerms()}>
                              {staffBusy ? 'Salvando...' : 'Salvar funções'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              disabled={staffBusy}
                              onClick={() => void removeStaff(row.manager_id)}
                            >
                              <Trash2 size={14} /> Remover
                            </button>
                            <button type="button" onClick={() => setStaffDetail(null)}>
                              Fechar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}

              {staffConvites.filter((c) => c.status === 'pendente').map((c) => (
                <article key={c.id} className="championship-vaga-row status-reservada">
                  <div className="vaga-row-summary" style={{ cursor: 'default' }}>
                    <span className="vaga-row-number">…</span>
                    <span className="vaga-row-avatar status-reservada" aria-hidden>
                      <UserPlus size={16} />
                    </span>
                    <span className="vaga-row-identity">
                      <strong>@{c.manager?.username || c.manager_username || '—'}</strong>
                      <small>
                        Convite pendente · expira {new Date(c.expira_em).toLocaleDateString('pt-BR')}
                        {c.mensagem ? ` · ${c.mensagem}` : ''}
                      </small>
                    </span>
                    <span className="vaga-row-meta">
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={staffLoading}
                        onClick={() => void cancelStaffInvite(c.id)}
                      >
                        Cancelar
                      </button>
                    </span>
                    <span className="vaga-row-chevron" aria-hidden />
                  </div>
                </article>
              ))}
            </div>

            <SystemModal
              open={showStaffInvite}
              title="Convidar manager"
              description="O manager recebe no correio do app (sininho)."
              onClose={() => setShowStaffInvite(false)}
              size="medium"
            >
              <div className="seller-invite-modal">
                <div className="mini-grid two">
                  <Field label="Buscar @username ou ID">
                    <div className="staff-search-row">
                      <input
                        value={staffQuery}
                        onChange={(e) => setStaffQuery(e.target.value)}
                        placeholder="@username ou 123"
                        onKeyDown={(e) => { if (e.key === 'Enter') void searchStaffManagers() }}
                      />
                      <button
                        type="button"
                        className="button secondary"
                        disabled={staffLoading}
                        onClick={() => void searchStaffManagers()}
                      >
                        Buscar
                      </button>
                    </div>
                  </Field>
                  <Field label="Validade (dias)">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={staffValidade}
                      onChange={(e) => setStaffValidade(e.target.value)}
                    />
                  </Field>
                </div>

                {staffSearch.length > 0 ? (
                  <div className="staff-search-results">
                    {staffSearch.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`staff-search-card ${staffSelected?.id === m.id ? 'selected' : ''}`}
                        onClick={() => { setStaffSelected(m); setStaffQuery(m.username) }}
                      >
                        <strong>@{m.username}</strong>
                        <span>{m.nome}</span>
                        <small>{m.public_id_prefix || 'MN'}{m.public_id}</small>
                      </button>
                    ))}
                  </div>
                ) : null}

                <Field label="Mensagem (opcional)">
                  <input
                    value={staffMessage}
                    onChange={(e) => setStaffMessage(e.target.value)}
                    placeholder="Ex.: Preciso de alguém para escalar e organizar lines."
                  />
                </Field>

                <div className="seller-perm-grid compact">
                  {([
                    ['pode_ver', 'Ver painel'],
                    ['pode_editar', 'Editar elenco/lines'],
                    ['pode_escalar', 'Escalar / links'],
                    ['pode_gerar_token', 'Gerar tokens'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="seller-perm-item">
                      <input
                        type="checkbox"
                        checked={Boolean(staffPerms[key])}
                        onChange={(e) => setStaffPerms((c) => ({ ...c, [key]: e.target.checked }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="modal-form-actions">
                  <button type="button" className="button secondary" onClick={() => setShowStaffInvite(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={staffLoading}
                    onClick={() => void sendStaffInvite()}
                  >
                    <UserPlus size={16} />
                    {staffLoading ? 'Enviando...' : 'Enviar no correio'}
                  </button>
                </div>
              </div>
            </SystemModal>
          </div>
        ) : null}

        {tab === 'config' ? (
          <div className="panel-tab-body">
            <div className="team-section-title">
              <div>
                <p className="eyebrow">Perfil</p>
                <h3>Editar equipe</h3>
              </div>
            </div>
            {props.managedTeams.map((team) => (
              <div key={team.id} style={{ marginBottom: 16 }}>
                <ProfileEditForm
                  profileType="equipe"
                  profileId={team.id}
                  initial={{
                    nome: rowTitle(team),
                    logo_url: dataText(team, 'logo_url'),
                    tag: dataText(team, 'tag'),
                    bio: dataText(team, 'bio'),
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <SystemModal
        open={Boolean(rosterInvite)}
        title="Convite para entrar na equipe"
        description="O jogador precisa acessar o link usando seu perfil de jogador."
        size="medium"
        onClose={() => setRosterInvite(null)}
      >
        {rosterInvite ? <div className="lineup-invite-result"><strong>{rosterInvite.teamName}</strong><p>Convite privado pronto para compartilhar.</p><div className="button-row"><button className="button" onClick={() => void copyLink(rosterInvite.texto, 'roster')}><Copy size={15}/> {copiedLineupId === 'roster' ? 'Link copiado' : 'Copiar convite'}</button><button className="button secondary" onClick={() => setRosterInvite(null)}>Fechar</button></div></div> : null}
      </SystemModal>

      <SystemModal
        open={Boolean(generatedInvite)}
        title="Link de escalação criado"
        description="Ao copiar, a mensagem informativa e o link são copiados juntos."
        size="medium"
        onClose={() => setGeneratedInvite(null)}
      >
        {generatedInvite ? <div className="lineup-invite-result">
          <div className="lineup-invite-token">
            <div><span>Token de escalação</span><strong>{generatedInvite.token}</strong></div>
            <div><span>Link de escalação</span><strong>Pronto para copiar</strong></div>
          </div>
          <p>O convite contém o link e as instruções para o jogador.</p>
          <div className="button-row">
            <button className="button" type="button" onClick={() => void copyLink(generatedInvite.texto, 'modal')}><Copy size={15}/> {copiedLineupId === 'modal' ? 'Link copiado' : 'Copiar convite'}</button>
            <button className={`button secondary ${copiedLineupId === 'modal-token' ? 'copied' : ''}`} type="button" onClick={() => void copyLink(generatedInvite.token, 'modal-token')}><Copy size={15}/> {copiedLineupId === 'modal-token' ? 'Token copiado' : 'Copiar só token'}</button>
            <button className="button secondary" type="button" onClick={() => setGeneratedInvite(null)}>Fechar</button>
          </div>
        </div> : null}
      </SystemModal>

      <SystemModal
        open={Boolean(editingInvite)}
        title="Alterar link da escalação"
        description="Ajuste o limite de jogadores e a validade sem trocar o link atual."
        size="medium"
        onClose={() => setEditingInvite(null)}
      >
        <div className="form-grid">
          <Field label="Limite de jogadores">
            <input type="number" min="1" value={inviteLimit} onChange={(event) => setInviteLimit(event.target.value)} />
          </Field>
          <Field label="Validade do link">
            <input type="datetime-local" value={inviteExpiresAt} onChange={(event) => setInviteExpiresAt(event.target.value)} />
          </Field>
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={() => void updateLineupInvite()} disabled={lineupLoading}>Salvar alterações</button>
          <button className="button secondary" type="button" onClick={() => setEditingInvite(null)}>Cancelar</button>
        </div>
      </SystemModal>
    </div>
  )
}

function EquipeLinesEditor(props: {
  teams: DropZoneRow[]
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
  lineups: Lineup[]
}) {
  const teamId = props.teams[0]?.id || ''
  const teamLogo = dataText(props.teams[0], 'logo_url')
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [nome, setNome] = useState('')
  const [tag, setTag] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [transferLine, setTransferLine] = useState<any>(null)
  const [transferInfo, setTransferInfo] = useState<any>(null)
  const [transferQuery, setTransferQuery] = useState('')
  const [transferTeams, setTransferTeams] = useState<any[]>([])
  const [transferTarget, setTransferTarget] = useState<any>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferSearching, setTransferSearching] = useState(false)
  const [lineDetail, setLineDetail] = useState<any | null>(null)
  const [lineDetailToken, setLineDetailToken] = useState('')

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const resolvedLogoUrl = await resolvePendingImageUpload(logoUrl)
      if (resolvedLogoUrl !== logoUrl) setLogoUrl(resolvedLogoUrl)
      const res = await fetch(`/api/equipes/${teamId}/lines`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar lines.')
      setLines(json.lines || [])
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar lines.')
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { void load() }, [load])

  function startCreate() {
    setEditingId('')
    setNome('')
    setTag(dataText(props.teams[0], 'tag') || '')
    setLogoUrl(teamLogo || '')
    setShowForm(true)
  }

  function startEdit(line: any) {
    setEditingId(line.id)
    setNome(line.nome || '')
    setTag(line.tag || '')
    setLogoUrl(line.logo_url || teamLogo || '')
    setShowForm(true)
  }

  async function save() {
    if (!nome.trim()) return setError('Informe o nome da line.')
    setBusy(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const resolvedLogoUrl = await resolvePendingImageUpload(logoUrl)
      if (resolvedLogoUrl !== logoUrl) setLogoUrl(resolvedLogoUrl)
      const res = await fetch(`/api/equipes/${teamId}/lines`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? { line_id: editingId, nome: nome.trim(), tag: tag.trim() || null, logo_url: resolvedLogoUrl.trim() || null }
            : { nome: nome.trim(), tag: tag.trim() || null, logo_url: resolvedLogoUrl.trim() || teamLogo || null },
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar.')
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(lineId: string) {
    if (!window.confirm('Apagar esta line?')) return
    setBusy(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const res = await fetch(`/api/equipes/${teamId}/lines?line_id=${encodeURIComponent(lineId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao apagar.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao apagar.')
    } finally {
      setBusy(false)
    }
  }


  async function openTransfer(line: any) {
    setTransferLine(line)
    setTransferInfo(null)
    setTransferQuery('')
    setTransferTeams([])
    setTransferTarget(null)
    setTransferLoading(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const res = await fetch(`/api/equipes/${teamId}/lines/${line.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao verificar a transferência.')
      setTransferInfo(json.transfer || null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao verificar a transferência.')
      setTransferLine(null)
    } finally {
      setTransferLoading(false)
    }
  }

  async function openLineDetail(line: any) {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      setLineDetailToken(token)
      setLineDetail((current: any) => current?.id === line.id ? null : line)
    } catch (err: any) {
      setError(err?.message || 'Erro ao abrir jogadores da line.')
    }
  }

  async function searchTransferTeams() {
    const query = transferQuery.trim()
    if (query.length < 2) return setTransferTeams([])
    setTransferSearching(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const res = await fetch(`/api/equipes/busca-publica?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar equipes.')
      setTransferTeams((json.items || []).filter((team: any) => String(team.id) !== String(teamId)))
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar equipes.')
    } finally {
      setTransferSearching(false)
    }
  }

  async function confirmTransfer() {
    if (!transferLine?.id || !transferTarget?.id) return
    setBusy(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const res = await fetch(`/api/equipes/${teamId}/lines/${transferLine.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer_line', equipe_destino_id: transferTarget.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao transferir a line.')
      setTransferLine(null)
      setTransferInfo(null)
      setTransferTarget(null)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao transferir a line.')
    } finally {
      setBusy(false)
    }
  }

  if (!teamId) return <div className="panel-tab-body"><p className="empty">Nenhuma equipe.</p></div>

  return (
    <div className="panel-tab-body">
      <div className="subtab-actionbar">
        <div>
          <p className="eyebrow">Lines</p>
          <h3>{lines.length} line(s)</h3>
        </div>
        <button type="button" className="button" onClick={startCreate}>
          <Plus size={16} /> Nova line
        </button>
      </div>
      <p className="empty" style={{ marginBottom: 10 }}>
        Toda line nasce com a logo da equipe e pode trocar a logo depois.
      </p>
      {error ? <div className="message error">{error}</div> : null}
      {showForm ? (
        <div className="inline-action-panel">
          <div className="mini-grid two">
            <Field label="Nome">
              <input value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field label="Tag">
              <input value={tag} onChange={(e) => setTag(e.target.value)} />
            </Field>
          </div>
          <UploadField
            label="Logo da line"
            value={logoUrl}
            bucket="equipe"
            onChange={setLogoUrl}
            onUpload={props.uploadPublicFile}
          />
          <div className="button-row">
            <button type="button" className="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </button>
            <button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {loading ? <p className="empty">Carregando...</p> : null}
      <div className="championship-vagas-list">
        {lines.map((line, index) => {
          const lineLineups = props.lineups.filter((lineup) => String(lineup.line_id || '') === String(line.id))
          const linePlayers = new Set(lineLineups.flatMap((lineup) => (lineup.jogadores || []).map((player) => String(player.id || player.nick))).filter(Boolean))
          return (
          <article key={line.id} className={`championship-vaga-row status-ocupada ${lineDetail?.id === line.id ? 'is-open' : ''}`}>
            <div className="vaga-row-summary" style={{ cursor: 'default' }}>
              <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="vaga-row-avatar status-ocupada">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={line.logo_url || teamLogo || '/favicon.ico'} alt="" />
              </span>
              <span className="vaga-row-identity">
                <strong>{line.nome}</strong>
                <small>
                  {line.tag || 'Sem tag'} · {(line.campeonatos || []).length} campeonato(s)
                </small>
                {linePlayers.size ? <small>{linePlayers.size} jogador(es) escalado(s) nesta line</small> : null}
              </span>
              <span className="vaga-row-meta">
                <button type="button" className="button small secondary" title="Ver jogadores da line" onClick={() => void openLineDetail(line)}>
                  <Users size={14} /> Jogadores
                </button>
                <button type="button" className="button small secondary" title="Editar line" onClick={() => startEdit(line)}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="button small secondary" title="Transferir line para equipe real" disabled={busy || transferLoading} onClick={() => void openTransfer(line)}>
                  <Send size={14} />
                </button>
                <button type="button" className="button small secondary" title="Excluir line" disabled={busy} onClick={() => void remove(line.id)}>
                  <Trash2 size={14} />
                </button>
              </span>
              <span className="vaga-row-chevron" aria-hidden />
            </div>
            {lineDetail?.id === line.id && lineDetailToken ? (
              <div className="team-line-inline-detail">
                <LineRosterManager
                  accessToken={lineDetailToken}
                  equipeId={teamId}
                  line={line}
                  compact
                  onBack={() => setLineDetail(null)}
                  onChanged={() => { void load() }}
                />
              </div>
            ) : null}
          </article>
          )
        })}
      </div>

      <SystemModal
        open={Boolean(transferLine)}
        title="Transferir line para equipe real"
        description="A mesma line será mantida, incluindo campeonatos, grupos, slots, resultados, estatísticas e MVP."
        size="medium"
        onClose={() => { if (!busy) { setTransferLine(null); setTransferTarget(null) } }}
      >
        {transferLoading ? <p className="empty"><Loader2 className="spin" size={16} /> Verificando transferência...</p> : transferInfo?.allowed ? (
          <div className="line-transfer-inline">
            <div className="message">
              <strong>{transferLine?.nome}</strong>
              <span>{transferInfo.championships?.length || 0} campeonato(s) serão preservados.</span>
              {transferInfo.championships?.length ? <small>{transferInfo.championships.map((item: any) => item.nome).join(' · ')}</small> : null}
            </div>
            <Field label="Buscar equipe real">
              <div className="inline-search-row">
                <input value={transferQuery} onChange={(event) => setTransferQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchTransferTeams() } }} placeholder="Nome ou tag da equipe" />
                <button type="button" className="button secondary" disabled={transferSearching || transferQuery.trim().length < 2} onClick={() => void searchTransferTeams()}>
                  {transferSearching ? <Loader2 className="spin" size={15} /> : <Search size={15} />} Buscar
                </button>
              </div>
            </Field>
            <div className="transfer-team-results">
              {transferTeams.map((team: any) => (
                <button key={team.id} type="button" className={transferTarget?.id === team.id ? 'selected' : ''} onClick={() => setTransferTarget(team)}>
                  <span>{team.logo_url ? <img src={team.logo_url} alt="" /> : String(team.tag || team.nome || 'E').slice(0, 2)}</span>
                  <div><strong>{team.nome}</strong><small>{team.tag || 'Sem tag'}</small></div>
                </button>
              ))}
            </div>
            {transferTarget ? <div className="message"><span>Destino selecionado:</span><strong>{transferTarget.nome} {transferTarget.tag ? `(${transferTarget.tag})` : ''}</strong></div> : null}
            <div className="button-row">
              <button type="button" className="button" disabled={busy || !transferTarget} onClick={() => void confirmTransfer()}>{busy ? 'Transferindo...' : 'Confirmar transferência'}</button>
              <button type="button" className="button secondary" disabled={busy} onClick={() => setTransferLine(null)}>Cancelar</button>
            </div>
          </div>
        ) : <div className="message error">{transferInfo?.reason || 'Esta line não pode ser transferida.'}</div>}
      </SystemModal>
    </div>
  )
}
