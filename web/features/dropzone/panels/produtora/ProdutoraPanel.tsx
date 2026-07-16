'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Folder, FolderOpen, Link2, Loader2, MessageCircle, Pause, Pencil, Play, Plus, Trash2, Trophy, UserPlus, Users } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import { CHAMPIONSHIP_TYPE_LABELS, CHAMPIONSHIP_TYPES, DAILY_HOURS, GROUP_LETTERS } from '@/lib/dropzone-constants'
import { Field } from '../../components/form-fields'
import { CampeonatoForm, emptyCampeonatoForm, type CampeonatoFormValue } from '@/components/forms/campeonato'
import { SystemModal } from '@/components/layout/SystemModal'
import { CampeonatoEquipesTab } from '@/features/campeonatos/equipes'
import { CampeonatoJogadoresTab } from '@/features/campeonatos/jogadores'
import { CampeonatoEstatisticasTab } from '@/features/campeonatos/estatisticas'
import { dataText, rowTitle } from '../../utils'
import { producerTabs, type ProducerTab } from './producer-tabs'

const TEAM_INVITE_TYPES = new Set(['convite_equipe_campeonato', 'team_invite'])

export function ProdutoraPanel(props: {
  championships: DropZoneRow[]
  teams: DropZoneRow[]
  phases: DropZoneRow[]
  groups: DropZoneRow[]
  groupSlots: DropZoneRow[]
  games: DropZoneRow[]
  tokens: DropZoneRow[]
  registrationLinks: DropZoneRow[]
  lineupRules: DropZoneRow[]
  registrationLink: {
    grupo_id: string
    nome_interno: string
    limite_vagas: string
    equipes_esperadas_texto: string
    encerra_em: string
    descricao: string
  }
  setRegistrationLink: (value: any) => void
  createRegistrationLink: (overrides?: {
    grupo_id?: string
    nome_interno?: string
    limite_vagas?: string | number
    equipes_esperadas_texto?: string
    encerra_em?: string
    descricao?: string
  }) => void
  selectedChamp?: DropZoneRow
  selectedChampTeams: DropZoneRow[]
  selectedChampId: string
  setSelectedChampId: (value: string) => void
  selectedTeamId: string
  setSelectedTeamId: (value: string) => void
  championship: CampeonatoFormValue
  setChampionship: (value: any) => void
  team: { nome: string; tag: string; logo_url: string; senha_dono: string }
  setTeam: (value: any) => void
  phase: { nome: string; campeonato_id: string; ordem: string }
  setPhase: (value: any) => void
  group: { nome: string; campeonato_id: string; fase_id: string; slots: string; whatsapp_url: string }
  setGroup: (value: any) => void
  slotAssignment: { slot_id: string; fase_id: string; grupo_id: string; equipe_id: string; line_id: string; campeonato_equipe_id: string; slot_numero: string }
  setSlotAssignment: (value: any) => void
  game: { nome: string; campeonato_id: string; fase_id: string; data_jogo: string; horario: string; numero_partidas: string; mapas: string[]; grupos_ids: string[] }
  setGame: (value: any) => void
  createChampionship: () => Promise<boolean>
  updateChampionship: (id: string, data: CampeonatoFormValue) => Promise<DropZoneRow | undefined>
  deleteChampionship: (id: string) => Promise<void>
  updateStructure: (entityType: 'phase' | 'group' | 'group_slot' | 'registration_link', id: string, data: Record<string, unknown>) => Promise<void>
  deleteStructure: (entityType: 'phase' | 'group' | 'group_slot' | 'registration_link', id: string) => Promise<void>
  createTeam: () => void
  createPhase: () => Promise<boolean>
  createGroup: () => Promise<boolean>
  assignTeamToSlot: () => void
  createGame: () => Promise<boolean>
  updateGame: (id: string) => Promise<boolean>
  deleteGame: (id: string) => Promise<boolean>
  addTeamToChamp: () => void
  generateTeamInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  pendingCreate: string | null
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [showCreateChamp, setShowCreateChamp] = useState(false)
  const [editingChampId, setEditingChampId] = useState('')
  const [editingChamp, setEditingChamp] = useState<CampeonatoFormValue>(emptyCampeonatoForm)
  const [typeFilter, setTypeFilter] = useState('todos')
  const [tab, setTab] = useState<ProducerTab>('equipes')
  const [openAction, setOpenAction] = useState<'team_add' | 'team_token' | 'phase' | 'group' | 'slot' | 'game' | 'link' | ''>('')
  const [openLinkIds, setOpenLinkIds] = useState<Record<string, boolean>>({})
  const [linkStatusFilter, setLinkStatusFilter] = useState<'todos' | 'ativo' | 'pausado' | 'esgotado' | 'expirado' | 'grupo_cheio'>('todos')
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [slotModal, setSlotModal] = useState<{ id: string; fase_id: string; grupo_id: string; slot_numero: string; letra: string; whatsapp_url: string } | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<{ id: string; nome: string; ordem: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; nome: string; slots: string; whatsapp_url: string } | null>(null)
  const [mapCatalog, setMapCatalog] = useState<Array<{ codigo: string; nome: string; imagem_url: string | null; mapa_misterioso: boolean }>>([])
  const [mapsLoading, setMapsLoading] = useState(false)
  const [editingGameId, setEditingGameId] = useState('')
  const [openGamePhases, setOpenGamePhases] = useState<Record<string, boolean>>({})
  const [openGames, setOpenGames] = useState<Record<string, boolean>>({})
  const [sellerRows, setSellerRows] = useState<any[]>([])
  const [sellerLink, setSellerLink] = useState('')
  const [sellerWhatsappLink, setSellerWhatsappLink] = useState('')
  const [sellerLoading, setSellerLoading] = useState(false)
  const [sellerError, setSellerError] = useState('')
  const [sellerSelected, setSellerSelected] = useState<any | null>(null)
  const [sellerLimite, setSellerLimite] = useState('')
  const [sellerBusy, setSellerBusy] = useState(false)
  const [sellerPerms, setSellerPerms] = useState({
    adicionar_equipes: true,
    gerar_convites_equipe: true,
    remover_equipes: true,
    ver_estrutura: true,
    organizar_grupos: true,
    gerenciar_jogos: true,
    pontuar_tabela: true,
  })
  // Convite por pesquisa (correio) — por campeonato
  const [mgrQuery, setMgrQuery] = useState('')
  const [mgrSearch, setMgrSearch] = useState<any[]>([])
  const [mgrSelected, setMgrSelected] = useState<any | null>(null)
  const [mgrMessage, setMgrMessage] = useState('')
  const [mgrValidade, setMgrValidade] = useState('7')
  const [mgrLimite, setMgrLimite] = useState('')
  const [mgrPerms, setMgrPerms] = useState({
    adicionar_equipes: true,
    gerar_convites_equipe: true,
    remover_equipes: true,
    ver_estrutura: true,
    organizar_grupos: true,
    gerenciar_jogos: true,
    pontuar_tabela: true,
  })
  const [mgrInvites, setMgrInvites] = useState<any[]>([])
  const [mgrInviteMsg, setMgrInviteMsg] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)

  useEffect(() => {
    let active = true
    setMapsLoading(true)
    fetch('/api/mapas')
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar mapas.')
        if (active) setMapCatalog(Array.isArray(json.mapas) ? json.mapas : [])
      })
      .catch(() => {
        if (active) setMapCatalog([])
      })
      .finally(() => {
        if (active) setMapsLoading(false)
      })
    return () => { active = false }
  }, [])

  async function sellerRequest(path: string, options?: RequestInit) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || 'Não foi possível concluir a operação.')
    return json
  }

  async function loadSellers(championshipId?: string) {
    setSellerLoading(true)
    setSellerError('')
    try {
      const qs = championshipId ? `?campeonato_id=${encodeURIComponent(championshipId)}` : ''
      const json = await sellerRequest(`/api/produtora/vendedores${qs}`)
      const rows = json.vendedores || []
      setSellerRows(rows)
      return rows as any[]
    } catch (error) {
      // fallback legado por campeonato
      try {
        if (championshipId) {
          const json = await sellerRequest(`/api/campeonatos/${championshipId}/vendedores`)
          const rows = (json.vendedores || []).map((row: any) => ({
            ...row,
            no_campeonato: row.status === 'ativo' && Boolean(row.manager_id),
            vinculo_atual: row.manager_id ? { limite_vagas: row.limite_vagas, status: row.status, permissoes: row.permissoes } : null,
            campeonatos: [],
            public_url: row.manager_id ? `/vendedores/${row.manager_id}` : null,
          }))
          setSellerRows(rows)
          return rows as any[]
        }
        setSellerRows([])
        return [] as any[]
      } catch (err2) {
        setSellerError(err2 instanceof Error ? err2.message : 'Erro ao carregar vendedores.')
        setSellerRows([])
        return [] as any[]
      }
    } finally {
      setSellerLoading(false)
    }
  }

  /** Convite único da produtora (não por campeonato). */
  async function createSellerInvite() {
    setSellerLoading(true)
    setSellerError('')
    setSellerLink('')
    setSellerWhatsappLink('')
    try {
      const json = await sellerRequest('/api/produtora/vendedores', {
        method: 'POST',
        body: JSON.stringify({ action: 'invite' }),
      })
      setSellerLink(json.link)
      setSellerWhatsappLink(json.whatsapp_url || '')
      await loadSellers(selectedChamp?.id)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao gerar convite.')
    } finally {
      setSellerLoading(false)
    }
  }

  function openSellerEditor(seller: any) {
    const perms = seller?.vinculo_atual?.permissoes || seller?.permissoes || {}
    setSellerSelected(seller)
    setSellerLimite(
      seller?.limite_vagas_atual != null && seller.limite_vagas_atual !== ''
        ? String(seller.limite_vagas_atual)
        : seller?.vinculo_atual?.limite_vagas != null
          ? String(seller.vinculo_atual.limite_vagas)
          : '',
    )
    setSellerPerms({
      adicionar_equipes: perms.adicionar_equipes !== false,
      gerar_convites_equipe: perms.gerar_convites_equipe !== false,
      remover_equipes:
        perms.remover_equipes !== false
        && (perms.remover_equipes !== undefined || perms.remover_proprias_equipes !== false),
      ver_estrutura: perms.ver_estrutura !== false,
      organizar_grupos: perms.organizar_grupos !== false,
      gerenciar_jogos: perms.gerenciar_jogos !== false,
      pontuar_tabela: perms.pontuar_tabela !== false,
    })
  }

  /** Adiciona vendedor já da produtora neste campeonato e define limite/funções. */
  async function attachSellerToChampionship() {
    if (!sellerSelected?.manager_id || !selectedChamp?.id) return
    const managerId = sellerSelected.manager_id
    setSellerBusy(true)
    setSellerError('')
    try {
      await sellerRequest('/api/produtora/vendedores', {
        method: 'POST',
        body: JSON.stringify({
          action: 'attach',
          manager_id: managerId,
          campeonato_id: selectedChamp.id,
          limite_vagas: sellerLimite,
          permissoes: sellerPerms,
        }),
      })
      const rows = await loadSellers(selectedChamp.id)
      await loadChampManagerInvites(selectedChamp.id)
      const fresh = (rows || []).find((r) => r.manager_id === managerId)
      if (fresh) openSellerEditor(fresh)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao adicionar no campeonato.')
    } finally {
      setSellerBusy(false)
    }
  }

  async function detachSellerFromChampionship(managerId: string) {
    if (!selectedChamp?.id) return
    if (!window.confirm('Encerrar vendas deste manager neste campeonato? Ele deixa de vender vagas neste evento.')) return
    setSellerBusy(true)
    setSellerError('')
    try {
      await sellerRequest('/api/produtora/vendedores', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detach',
          manager_id: managerId,
          campeonato_id: selectedChamp.id,
        }),
      })
      setSellerSelected(null)
      await loadSellers(selectedChamp.id)
      await loadChampManagerInvites(selectedChamp.id)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao remover do campeonato.')
    } finally {
      setSellerBusy(false)
    }
  }

  function openInviteForm() {
    setShowInviteForm(true)
    setSellerError('')
    setMgrInviteMsg('')
    setMgrQuery('')
    setMgrSearch([])
    setMgrSelected(null)
    setMgrMessage('')
    setMgrValidade('7')
    setMgrLimite('')
    setMgrPerms({
      adicionar_equipes: true,
      gerar_convites_equipe: true,
      remover_equipes: true,
      ver_estrutura: true,
      organizar_grupos: true,
      gerenciar_jogos: true,
      pontuar_tabela: true,
    })
  }

  function closeInviteForm() {
    setShowInviteForm(false)
    setMgrSearch([])
    setMgrSelected(null)
  }

  async function loadChampManagerInvites(championshipId?: string) {
    if (!championshipId) {
      setMgrInvites([])
      return
    }
    try {
      const json = await sellerRequest(`/api/campeonatos/${championshipId}/managers/convites`)
      setMgrInvites(Array.isArray(json.convites) ? json.convites : [])
    } catch {
      setMgrInvites([])
    }
  }

  async function searchManagersForChamp() {
    setSellerError('')
    setMgrInviteMsg('')
    try {
      const json = await sellerRequest(`/api/managers/busca?q=${encodeURIComponent(mgrQuery)}`)
      setMgrSearch(json.items || json.managers || [])
      if (!(json.items || json.managers || []).length) setSellerError('Nenhum manager encontrado.')
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro na busca.')
      setMgrSearch([])
    }
  }

  async function sendChampManagerInvite() {
    if (!selectedChamp?.id) return
    if (!mgrSelected?.id && !mgrQuery.trim()) {
      setSellerError('Busque e selecione um manager.')
      return
    }
    setSellerBusy(true)
    setSellerError('')
    setMgrInviteMsg('')
    try {
      const json = await sellerRequest(`/api/campeonatos/${selectedChamp.id}/managers/convites`, {
        method: 'POST',
        body: JSON.stringify({
          manager_id: mgrSelected?.id || undefined,
          manager_username: mgrSelected?.username || mgrQuery,
          mensagem: mgrMessage,
          validade_dias: mgrValidade,
          limite_vagas: mgrLimite,
          permissoes: mgrPerms,
        }),
      })
      setMgrInviteMsg(json.mensagem || 'Convite enviado no correio.')
      setMgrQuery('')
      setMgrSearch([])
      setMgrSelected(null)
      setMgrMessage('')
      closeInviteForm()
      await loadChampManagerInvites(selectedChamp.id)
      await loadSellers(selectedChamp.id)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao enviar convite.')
    } finally {
      setSellerBusy(false)
    }
  }

  async function cancelChampManagerInvite(conviteId: string) {
    if (!selectedChamp?.id) return
    setSellerBusy(true)
    setSellerError('')
    try {
      await sellerRequest(`/api/campeonatos/${selectedChamp.id}/managers/convites`, {
        method: 'DELETE',
        body: JSON.stringify({ convite_id: conviteId }),
      })
      await loadChampManagerInvites(selectedChamp.id)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao cancelar.')
    } finally {
      setSellerBusy(false)
    }
  }

  const selectedChamp = props.selectedChamp
  const selectedChampType = String(dataText(selectedChamp, 'tipo') || 'copa')
  const filteredChampionships = typeFilter === 'todos'
    ? props.championships
    : props.championships.filter((champ) => String(dataText(champ, 'tipo') || 'copa') === typeFilter)

  function toInputDate(value: unknown) {
    if (!value) return ''
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  }

  function championshipToForm(champ: DropZoneRow): CampeonatoFormValue {
    return {
      nome: rowTitle(champ),
      tipo: String(dataText(champ, 'tipo') || 'copa'),
      logo_url: String(dataText(champ, 'logo_url') || ''),
      banner_url: String(dataText(champ, 'banner_url') || ''),
      premiacao: String(dataText(champ, 'premiacao') || ''),
      valor_inscricao: String(dataText(champ, 'valor_inscricao') || ''),
      descricao_premiacao: String(dataText(champ, 'descricao_premiacao') || ''),
      divisao_premiacao: String(dataText(champ, 'divisao_premiacao') || ''),
      numero_vagas: String(dataText(champ, 'numero_vagas') || ''),
      formato: String(dataText(champ, 'formato') || ''),
      plataforma: String(dataText(champ, 'plataforma') || ''),
      servidor: String(dataText(champ, 'servidor') || ''),
      tipo_premiacao: String(dataText(champ, 'tipo_premiacao') || ''),
      tem_trofeu: Boolean(champ.data?.tem_trofeu),
      tem_live: Boolean(champ.data?.tem_live),
      vagas_por_equipe: String(dataText(champ, 'vagas_por_equipe') || ''),
      jogadores_por_vaga: String(dataText(champ, 'jogadores_por_vaga') || ''),
      permite_jogador_multiplas_equipes: Boolean(champ.data?.permite_jogador_multiplas_equipes),
      permite_troca_jogadores: Boolean(champ.data?.permite_troca_jogadores),
      data_limite_trocas: toInputDate(champ.data?.data_limite_trocas),
      data_limite_inscricao: toInputDate(champ.data?.data_limite_inscricao),
      aceita_novas_inscricoes_equipes: champ.data?.aceita_novas_inscricoes_equipes !== false,
      contatos_whatsapp: Array.isArray(champ.data?.contatos_whatsapp) ? champ.data.contatos_whatsapp : [],
    }
  }

  function startEditChampionship(champ: DropZoneRow) {
    setEditingChampId(champ.id)
    setEditingChamp(championshipToForm(champ))
    setShowCreateChamp(false)
  }
  const isDailyChamp = selectedChampType === 'diario'
  const champPhases = props.phases.filter((row) => row.parent_id === selectedChamp?.id)
  const champGroups = props.groups.filter((row) => row.parent_id === selectedChamp?.id)
  const champGames = props.games.filter((row) => row.parent_id === selectedChamp?.id)
  const champSlots = props.groupSlots.filter((row) => row.parent_id === selectedChamp?.id)
  const champRegistrationLinks = props.registrationLinks.filter((row) => row.parent_id === selectedChamp?.id)
  const teamInvites = props.tokens.filter((row) => TEAM_INVITE_TYPES.has(String(row.data?.token_kind || '')) && row.parent_id === selectedChamp?.id)

  useEffect(() => {
    if (tab === 'vendedores') {
      setSellerSelected(null)
      setShowInviteForm(false)
      void loadSellers(selectedChamp?.id)
      void loadChampManagerInvites(selectedChamp?.id)
    }
  }, [tab, selectedChamp?.id])

  useEffect(() => {
    setLinkStatusFilter('todos')
    setOpenLinkIds({})
  }, [selectedChamp?.id])

  function toggleAction(value: typeof openAction) {
    setOpenAction((current) => current === value ? '' : value)
  }

  function groupName(id?: string | null) {
    return rowTitle(champGroups.find((row) => row.id === id)) || 'Sem grupo'
  }

  function phaseName(id?: string | null) {
    return rowTitle(champPhases.find((row) => row.id === id)) || 'Sem fase'
  }

  function formatDateTime(value?: string | null) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }

  function freeSlotsInGroup(grupoId: string) {
    return champSlots.filter((slot) => {
      if (String(slot.data?.grupo_id || slot.data?.group_id || '') !== grupoId) return false
      return !slot.data?.line_id && !slot.data?.equipe_id && !slot.data?.team_id
    }).length
  }

  function buildShareFromLink(params: {
    campeonatoNome: string
    grupoNome: string
    limite: number
    teams: string[]
    url: string
    expiraEm?: string | null
    titulo?: string | null
  }) {
    const validade = params.expiraEm
      ? `\nValidade: ${formatDateTime(params.expiraEm)}`
      : ''
    const tituloLine = params.titulo ? `\nLink: ${params.titulo}` : ''
    return `🏆 DropZone — Convite de inscrição

Campeonato: ${params.campeonatoNome}
Grupo: ${params.grupoNome}${tituloLine}
Vagas neste link: ${params.limite}${validade}

Abra o link, entre com a conta da equipe, escolha a line e confirme a inscrição.

${params.url}`
  }

  type LinkUiStatus = 'ativo' | 'esgotado' | 'expirado' | 'pausado' | 'grupo_cheio' | 'excluido'

  function linkStatusInfo(link: DropZoneRow) {
    const data = link.data || {}
    const limite = Number(data.limite_vagas || data.metadata?.limite_vagas || 0) || null
    const usos = Number(data.usos ?? data.metadata?.usos ?? 0)
    const restantes = data.restantes != null
      ? Number(data.restantes)
      : limite != null
        ? Math.max(0, limite - usos)
        : null
    const expiraEm = data.expira_em ? new Date(String(data.expira_em)) : null
    const expiredByDate = Boolean(expiraEm && !Number.isNaN(expiraEm.getTime()) && expiraEm.getTime() <= Date.now())
    const closedReason = String(data.closed_reason || data.metadata?.closed_reason || '')
    const statusFromApi = String(data.status || '')
    let status: LinkUiStatus = 'ativo'
    if (statusFromApi === 'excluido' || closedReason === 'excluido' || data.deleted_at) status = 'excluido'
    else if (statusFromApi === 'expirado' || expiredByDate) status = 'expirado'
    else if (statusFromApi === 'esgotado' || (limite != null && usos >= limite) || closedReason === 'limite_atingido') status = 'esgotado'
    else if (statusFromApi === 'grupo_cheio' || closedReason === 'grupo_cheio') status = 'grupo_cheio'
    else if (statusFromApi === 'pausado' || data.ativo === false) status = 'pausado'

    const statusLabel =
      status === 'ativo' ? 'Ativo'
        : status === 'esgotado' ? 'Esgotado'
          : status === 'expirado' ? 'Expirado'
            : status === 'grupo_cheio' ? 'Grupo cheio'
              : status === 'excluido' ? 'Excluído'
                : 'Pausado'

    const entradas = Array.isArray(data.entradas)
      ? data.entradas
      : Array.isArray(data.metadata?.entradas)
        ? data.metadata.entradas
        : []

    const expected = Array.isArray(data.expected_teams) ? data.expected_teams : []
    const controle = Array.isArray(data.vagas_controle) ? data.vagas_controle : []
    const pendentes = controle.length
      ? controle.filter((item: any) => item.status === 'pendente').length
      : Math.max(0, expected.length - entradas.filter((e: any) => e.referencia_lista).length)
    const inscritosLista = controle.length
      ? controle.filter((item: any) => item.status === 'inscrita').length
      : entradas.length

    return {
      limite,
      usos,
      restantes,
      status,
      statusLabel,
      expiraEm,
      entradas,
      pendentes,
      inscritosLista,
      temListaEsperada: expected.length > 0 || controle.length > 0,
    }
  }

  const groupInviteLinks = useMemo(
    () =>
      champRegistrationLinks
        .filter((link) => link.data?.tipo === 'inscricao_equipes_grupo' || !link.data?.tipo || link.data?.tipo === 'equipes')
        .slice()
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [champRegistrationLinks],
  )

  const linkFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      todos: groupInviteLinks.length,
      ativo: 0,
      pausado: 0,
      esgotado: 0,
      expirado: 0,
      grupo_cheio: 0,
    }
    for (const link of groupInviteLinks) {
      const status = linkStatusInfo(link).status
      if (status in counts) counts[status] += 1
    }
    return counts
  }, [groupInviteLinks])

  const filteredGroupInviteLinks = useMemo(() => {
    if (linkStatusFilter === 'todos') return groupInviteLinks
    return groupInviteLinks.filter((link) => linkStatusInfo(link).status === linkStatusFilter)
  }, [groupInviteLinks, linkStatusFilter])

  function slotLineEntry(slot?: DropZoneRow) {
    if (!slot) return null
    const lineId = String(slot.data?.line_id || '')
    const equipeId = String(slot.data?.equipe_id || '')
    const campeonatoEquipeId = String(slot.data?.campeonato_equipe_id || '')
    if (!lineId && !equipeId && !campeonatoEquipeId) return null

    if (campeonatoEquipeId) {
      const byParticipation = props.selectedChampTeams.find(
        (item) => String(item.data?.campeonato_equipe_id || item.id.split(':')[0] || '') === campeonatoEquipeId
          && (!lineId || String(item.data?.line_id || '') === lineId),
      )
      if (byParticipation) return byParticipation
    }

    if (lineId) {
      const byLine = props.selectedChampTeams.find((item) => String(item.data?.line_id || '') === lineId)
      if (byLine) return byLine
    }

    if (equipeId) {
      return (
        props.selectedChampTeams.find(
          (item) => item.ref_id === equipeId && (!lineId || String(item.data?.line_id || '') === lineId),
        ) || null
      )
    }

    return null
  }

  function lineAvatar(entry?: DropZoneRow | null, slot?: DropZoneRow | null) {
    return String(
      dataText(entry ?? undefined, 'logo_url')
      || dataText(slot ?? undefined, 'line_logo_url')
      || dataText(slot ?? undefined, 'logo_url')
      || dataText(slot ?? undefined, 'equipe_logo_url')
      || '',
    )
  }

  function slotStatus(slot?: DropZoneRow, entry?: DropZoneRow | null) {
    if (entry || slot?.data?.line_id || slot?.data?.equipe_id || slot?.data?.campeonato_equipe_id) {
      return 'ocupada' as const
    }
    const raw = String(slot?.status || slot?.data?.status || '').toLowerCase()
    if (raw === 'reservado' || raw === 'reservada') return 'reservada' as const
    return 'livre' as const
  }

  function slotLineName(slot: DropZoneRow, entry: DropZoneRow | null, status: 'livre' | 'reservada' | 'ocupada', letter: string) {
    if (status === 'reservada') {
      return String(
        slot.data?.nome_line_reservada
        || slot.data?.nome_equipe_reservada
        || 'Convite reservado',
      )
    }
    if (status === 'ocupada') {
      return String(
        (entry ? rowTitle(entry) : '')
        || dataText(entry ?? undefined, 'line_name')
        || slot.data?.line_name
        || slot.data?.line_nome
        || slot.data?.nome_exibicao
        || 'Line inscrita',
      )
    }
    return `Slot ${letter}`
  }

  function slotDetail(slot: DropZoneRow, entry: DropZoneRow | null, status: 'livre' | 'reservada' | 'ocupada', group: DropZoneRow, phase: DropZoneRow) {
    if (status === 'reservada') {
      return [
        slot.data?.nome_equipe_reservada,
        rowTitle(group),
        slot.data?.reserva_expira_em ? 'Aguardando aceite' : null,
      ].filter(Boolean).join(' · ') || 'Aguardando aceite do convite'
    }
    if (status === 'ocupada') {
      return [
        dataText(entry ?? undefined, 'team_name')
          || dataText(entry ?? undefined, 'tag')
          || slot.data?.equipe_nome
          || slot.data?.team_name
          || '',
        rowTitle(group),
        entry?.data?.origem_entrada
          ? `via ${entry.data.origem_entrada}`
          : slot.data?.origem_entrada
            ? `via ${slot.data.origem_entrada}`
            : null,
      ].filter(Boolean).join(' · ') || 'Line no campeonato'
    }
    const phaseLabel = phase.id === 'sem-fase' ? '' : rowTitle(phase)
    return [phaseLabel, rowTitle(group)].filter(Boolean).join(' · ') || 'Disponível'
  }

  const totalPlayers = 0
  const stats = [
    { label: 'Equipes', value: props.selectedChampTeams.length },
    { label: 'Jogadores', value: totalPlayers },
    { label: 'Fases', value: champPhases.length },
    { label: 'Grupos', value: champGroups.length },
    { label: 'Jogos', value: champGames.length },
  ]

  return (
    <div className="producer-layout-ref">
      <aside className="championship-nav-card panel">
        <div className="section-head compact-head">
          <div>
            <p className="eyebrow">Produtora</p>
            <h2>Campeonatos</h2>
          </div>
          <Trophy />
        </div>

        <div className="championship-type-filter" role="tablist" aria-label="Filtrar campeonatos por tipo">
          <button className={typeFilter === 'todos' ? 'active' : ''} onClick={() => setTypeFilter('todos')}>Todos</button>
          {CHAMPIONSHIP_TYPES.map((type) => <button key={type} className={typeFilter === type ? 'active' : ''} onClick={() => setTypeFilter(type)}>{CHAMPIONSHIP_TYPE_LABELS[type]}</button>)}
        </div>

        <div className="championship-list ref-list">
          {filteredChampionships.length === 0 ? <p className="empty">Nenhum campeonato neste tipo.</p> : null}
          {filteredChampionships.map((champ) => {
            const logo = dataText(champ, 'logo_url')
            return (
              <button
                key={champ.id}
                className={`champ-list-item ref-champ-item ${selectedChamp?.id === champ.id ? 'active' : ''}`}
                onClick={() => {
                  props.setSelectedChampId(champ.id)
                  setShowCreateChamp(false)
                }}
              >
                <span className="champ-thumb">{logo ? <img src={logo} alt="" /> : <Trophy size={18} />}</span>
                <span>
                  <strong>{rowTitle(champ)}</strong>
                  <small>{dataText(champ, 'premiacao') || 'PremiaÃ§Ã£o nÃ£o informada'}</small>
                </span>
              </button>
            )
          })}
        </div>

        <button className="button full" onClick={() => setShowCreateChamp(true)}>
          Novo campeonato
        </button>
      </aside>

      <SystemModal
        open={showCreateChamp}
        title="Novo campeonato"
        description="Cadastre os dados bÃ¡sicos, informaÃ§Ãµes e controles do campeonato."
        onClose={() => setShowCreateChamp(false)}
        size="wide"
      >
        <CampeonatoForm
          value={props.championship}
          onChange={props.setChampionship}
          onSubmit={async () => {
            const created = await props.createChampionship()
            if (created) setShowCreateChamp(false)
          }}
          onCancel={() => setShowCreateChamp(false)}
          loading={props.loading}
          uploadPublicFile={props.uploadPublicFile}
        />
      </SystemModal>

      <SystemModal
        open={Boolean(editingChampId)}
        title="Editar campeonato"
        description="Altere os dados e salve para atualizar o campeonato selecionado."
        onClose={() => setEditingChampId('')}
        size="wide"
      >
        <CampeonatoForm
          mode="edit"
          value={editingChamp}
          onChange={setEditingChamp}
          onSubmit={async () => {
            const updated = await props.updateChampionship(editingChampId, editingChamp)
            if (updated) setEditingChampId('')
          }}
          onCancel={() => setEditingChampId('')}
          loading={props.loading}
          uploadPublicFile={props.uploadPublicFile}
        />
      </SystemModal>

      <SystemModal
        open={Boolean(slotModal)}
        title={slotModal ? `Slot ${slotModal.letra}` : 'Gerenciar slot'}
        description="Selecione uma das lines já inscritas neste campeonato para ocupar o slot."
        onClose={() => setSlotModal(null)}
      >
        {slotModal ? (
          <div className="slot-assignment-modal">
            <div className={slotModal.whatsapp_url ? 'slot-whatsapp-info ready' : 'slot-whatsapp-info'}>
              <MessageCircle size={18} />
              <span>{slotModal.whatsapp_url ? 'Este grupo já possui link do WhatsApp configurado.' : 'Este grupo ainda não possui link do WhatsApp.'}</span>
            </div>
            <div className="line-picker-list">
              <p className="eyebrow">Line inscrita no campeonato</p>
              {props.selectedChampTeams.filter((entry) => {
                const lineId = String(entry.data?.line_id || '')
                if (!lineId) return true
                return !champSlots.some((slot) => slot.id !== slotModal.id && String(slot.data?.fase_id || '') === slotModal.fase_id && String(slot.data?.line_id || '') === lineId)
              }).map((entry) => {
                const selected = props.slotAssignment.campeonato_equipe_id === String(entry.data?.campeonato_equipe_id || '')
                return (
                  <button
                    type="button"
                    key={entry.id}
                    className={`line-picker-card ${selected ? 'selected' : ''}`}
                    onClick={() => props.setSlotAssignment({
                      ...props.slotAssignment,
                      slot_id: slotModal.id,
                      fase_id: slotModal.fase_id,
                      grupo_id: slotModal.grupo_id,
                      slot_numero: slotModal.slot_numero,
                      campeonato_equipe_id: String(entry.data?.campeonato_equipe_id || ''),
                      equipe_id: String(entry.ref_id || ''),
                      line_id: String(entry.data?.line_id || ''),
                    })}
                  >
                    <img className="line-picker-logo" src={lineAvatar(entry) || '/favicon.ico'} alt="" />
                    <span className="line-picker-copy">
                      <strong>{rowTitle(entry)}</strong>
                      <small>{dataText(entry, 'team_name') || 'Sem organização'}</small>
                    </span>
                  </button>
                )
              })}
            </div>
            {props.selectedChampTeams.length === 0 ? <p className="empty"><Users size={18}/> Nenhuma line inscrita no campeonato.</p> : null}
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setSlotModal(null)}>Cancelar</button>
              <button className="button secondary danger" disabled={props.loading} onClick={async () => { await props.updateStructure('group_slot', slotModal.id, { equipe_id: null, line_id: null, campeonato_equipe_id: null }); setSlotModal(null) }}>Remover line</button>
              <button className="button" disabled={!props.slotAssignment.campeonato_equipe_id || props.loading} onClick={async () => { await props.assignTeamToSlot(); setSlotModal(null) }}>Adicionar ao slot</button>
            </div>
          </div>
        ) : null}
      </SystemModal>

      <section className="championship-detail-card panel">
        {selectedChamp ? (
          <>
            <header className="detail-hero-ref">
              <div className="detail-logo-ref">
                {dataText(selectedChamp, 'logo_url') ? <img src={dataText(selectedChamp, 'logo_url')} alt="" /> : <Trophy size={28} />}
              </div>
              <div className="detail-title-ref">
                <p className="eyebrow">Campeonato selecionado</p>
                <h2>{rowTitle(selectedChamp)}</h2>
                <p>{CHAMPIONSHIP_TYPE_LABELS[selectedChampType as keyof typeof CHAMPIONSHIP_TYPE_LABELS] || 'Copa'} Â· {dataText(selectedChamp, 'premiacao') ? `PremiaÃ§Ã£o: ${dataText(selectedChamp, 'premiacao')}` : 'PremiaÃ§Ã£o nÃ£o informada'}</p>
                {dataText(selectedChamp, 'regras_url') ? <small>Regulamento: {dataText(selectedChamp, 'regras_url')}</small> : null}
              </div>
              <div className="championship-admin-actions">
                <button className="icon-action-button" onClick={() => startEditChampionship(selectedChamp)} title="Editar campeonato"><Pencil size={16} /> Editar</button>
                <button className="icon-action-button danger" onClick={() => {
                  if (window.confirm(`Excluir o campeonato ${rowTitle(selectedChamp)}? Ele ficarÃ¡ oculto, mas os dados serÃ£o preservados.`)) props.deleteChampionship(selectedChamp.id)
                }} title="Excluir campeonato"><Trash2 size={16} /> Excluir</button>
              </div>
              <div className="detail-stats-ref">
                {stats.map((item) => (
                  <div className="detail-stat" key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </header>

            <nav className="champ-subtabs-ref" aria-label="Abas do campeonato">
              {producerTabs.map((item) => (
                <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
              ))}
            </nav>

            <div className="champ-tab-body-ref">
              {tab === 'equipes' ? <CampeonatoEquipesTab campeonatoId={selectedChamp.id} /> : null}

              {tab === 'jogadores' ? <CampeonatoJogadoresTab campeonatoId={selectedChamp.id} /> : null}

              {tab === 'grupos' ? (
                <div className="ref-section-stack">
                  <div className="structure-quick-create">
                    <button
                      className="structure-plus-button"
                      type="button"
                      title="Adicionar fase ou grupo"
                      aria-label="Adicionar fase ou grupo"
                      aria-expanded={createMenuOpen}
                      onClick={() => setCreateMenuOpen((value) => !value)}
                    >
                      <Plus size={20} />
                    </button>
                    {createMenuOpen ? (
                      <div className="structure-create-menu">
                        <button type="button" onClick={() => { setOpenAction('phase'); setCreateMenuOpen(false) }}>
                          <FolderOpen size={17} />
                          <span><strong>Criar fase</strong><small>Nova etapa do campeonato</small></span>
                        </button>
                        <button
                          type="button"
                          disabled={!champPhases.length}
                          onClick={() => {
                            const phaseId = props.group.fase_id || champPhases[0]?.id || ''
                            if (!phaseId) return
                            props.setGroup({ ...props.group, fase_id: phaseId, campeonato_id: selectedChamp.id })
                            setOpenPhases((value) => ({ ...value, [phaseId]: true }))
                            setOpenAction('group')
                            setCreateMenuOpen(false)
                          }}
                        >
                          <Folder size={17} />
                          <span><strong>Criar grupo</strong><small>{champPhases.length ? 'Dentro de uma fase' : 'Crie uma fase primeiro'}</small></span>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {openAction === 'phase' ? (
                    <div className="inline-action-panel structure-phase-form mini-grid">
                      <Field label="Nome da fase"><input value={props.phase.nome} onChange={(e) => props.setPhase({ ...props.phase, nome: e.target.value, campeonato_id: selectedChamp.id })} placeholder="Fase de grupos" /></Field>
                      <Field label="Ordem"><input type="number" value={props.phase.ordem} onChange={(e) => props.setPhase({ ...props.phase, ordem: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                      <div className="button-row">
                        <button
                          className="button"
                          type="button"
                          disabled={Boolean(props.pendingCreate)}
                          onClick={async () => {
                            const created = await props.createPhase()
                            if (created) setOpenAction('')
                          }}
                        >
                          {props.pendingCreate === 'phase' ? <><Loader2 size={15} className="button-spinner" /> Criando fase...</> : 'Criar fase'}
                        </button>
                        <button className="button secondary" type="button" onClick={() => setOpenAction('')}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                  <div className="phase-folder-tree">
                    {(champPhases.length ? [...champPhases].sort((a,b) => Number(a.data?.ordem || 0)-Number(b.data?.ordem || 0)) : [{ id: 'sem-fase', name: 'Sem fase', data: {} } as DropZoneRow]).map((phase) => {
                      const groupsOfPhase = phase.id === 'sem-fase' ? champGroups.filter((group) => !group.data?.fase_id) : champGroups.filter((group) => group.data?.fase_id === phase.id)
                      if (phase.id === 'sem-fase' && groupsOfPhase.length === 0 && champPhases.length > 0) return null
                      const phaseOpen = openPhases[phase.id] !== false
                      return <section className="phase-folder" key={phase.id}>
                        <header className="folder-row phase-folder-row">
                          <button className="folder-toggle" onClick={() => setOpenPhases((v) => ({...v, [phase.id]: !phaseOpen}))}>{phaseOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>} {phaseOpen ? <FolderOpen size={20}/> : <Folder size={20}/>}<span><strong>{rowTitle(phase)}</strong><small>{groupsOfPhase.length} grupos</small></span></button>
                          {phase.id !== 'sem-fase' ? <div className="folder-actions"><button title="Adicionar grupo" className="phase-add-group" onClick={() => { setEditingGroup(null); props.setGroup({...props.group, fase_id: phase.id, campeonato_id: selectedChamp.id}); setOpenPhases((value) => ({ ...value, [phase.id]: true })); setOpenAction('group') }}><Plus size={16}/></button><button title="Editar fase" onClick={() => { setEditingGroup(null); setEditingPhase({ id: phase.id, nome: rowTitle(phase), ordem: String(phase.data?.ordem || 1) }); setOpenPhases((value) => ({ ...value, [phase.id]: true })) }}><Pencil size={15}/></button><button title="Excluir fase" className="danger" onClick={() => { if(window.confirm(`Excluir ${rowTitle(phase)} e todos os grupos dela?`)) props.deleteStructure('phase', phase.id) }}><Trash2 size={15}/></button></div> : null}
                        </header>
                        {phaseOpen ? <div className="phase-folder-content">{editingPhase?.id === phase.id ? (
                          <div className="inline-action-panel structure-edit-form mini-grid">
                            <Field label="Nome da fase"><input value={editingPhase.nome} onChange={(event) => setEditingPhase({ ...editingPhase, nome: event.target.value })} /></Field>
                            <Field label="Ordem"><input type="number" min="1" value={editingPhase.ordem} onChange={(event) => setEditingPhase({ ...editingPhase, ordem: event.target.value })} /></Field>
                            <div className="button-row structure-edit-actions">
                              <button className="button" type="button" onClick={async () => { await props.updateStructure('phase', phase.id, { nome: editingPhase.nome.trim(), ordem: Number(editingPhase.ordem || 1) }); setEditingPhase(null) }}>Salvar alteraÃ§Ãµes</button>
                              <button className="button secondary" type="button" onClick={() => setEditingPhase(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : null}{openAction === 'group' && props.group.fase_id === phase.id ? (
                          <div className="inline-action-panel phase-inline-group-form mini-grid three">
                            <Field label={isDailyChamp ? 'HorÃ¡rio' : 'Letra do grupo'}>
                              {isDailyChamp ? (
                                <select value={props.group.nome} onChange={(e) => props.setGroup({ ...props.group, nome: e.target.value, campeonato_id: selectedChamp.id, fase_id: phase.id })}>
                                  {DAILY_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                                </select>
                              ) : (
                                <select value={props.group.nome.replace(/^Grupo\s+/i, '').trim() || 'A'} onChange={(e) => props.setGroup({ ...props.group, nome: `Grupo ${e.target.value}`, campeonato_id: selectedChamp.id, fase_id: phase.id })}>
                                  {GROUP_LETTERS.map((letter) => <option key={letter} value={letter}>Grupo {letter}</option>)}
                                </select>
                              )}
                            </Field>
                            <Field label="Slots"><input type="number" min="1" max="52" value={props.group.slots} onChange={(e) => props.setGroup({ ...props.group, slots: e.target.value, campeonato_id: selectedChamp.id, fase_id: phase.id })} placeholder="12" /></Field>
                            <Field label="Link do WhatsApp"><input value={props.group.whatsapp_url} onChange={(e) => props.setGroup({ ...props.group, whatsapp_url: e.target.value, campeonato_id: selectedChamp.id, fase_id: phase.id })} placeholder="https://chat.whatsapp.com/..." /></Field>
                            <div className="button-row phase-group-form-actions">
                              <button
                                className="button"
                                type="button"
                                disabled={Boolean(props.pendingCreate)}
                                onClick={async () => {
                                  const created = await props.createGroup()
                                  if (created) setOpenAction('')
                                }}
                              >
                                {props.pendingCreate === 'group' ? <><Loader2 size={15} className="button-spinner" /> Criando grupo...</> : 'Criar grupo'}
                              </button>
                              <button className="button secondary" type="button" onClick={() => setOpenAction('')}>Cancelar</button>
                            </div>
                          </div>
                        ) : null}{groupsOfPhase.map((group) => {
                          const slotsOfGroup = champSlots.filter((slot) => slot.data?.grupo_id === group.id).sort((a,b)=>Number(a.data?.slot_numero||0)-Number(b.data?.slot_numero||0))
                          const groupOpen = openGroups[group.id] !== false
                          const slotCount = Number(group.data?.slots || 12)
                          return <article className="group-folder" key={group.id}>
                            <header className="folder-row group-folder-row">
                              <button className="folder-toggle" onClick={() => setOpenGroups((v)=>({...v,[group.id]:!groupOpen}))}>{groupOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<Folder size={18}/><span><strong>{rowTitle(group)}</strong><small className={group.data?.whatsapp_url ? 'whatsapp-ready' : 'whatsapp-missing'}>{group.data?.whatsapp_url ? <><CheckCircle2 size={13}/> WhatsApp configurado</> : <>WhatsApp não configurado</>} · {slotCount} slots</small></span></button>
                              <div className="folder-actions"><button title="Editar grupo" onClick={() => { setEditingPhase(null); setEditingGroup({ id: group.id, nome: rowTitle(group), slots: String(slotCount), whatsapp_url: String(group.data?.whatsapp_url || '') }); setOpenGroups((value) => ({ ...value, [group.id]: true })) }}><Pencil size={15}/></button><button title="Excluir grupo" className="danger" onClick={() => { if(window.confirm(`Excluir ${rowTitle(group)} e seus slots?`)) props.deleteStructure('group', group.id) }}><Trash2 size={15}/></button></div>
                            </header>
                            {groupOpen ? <>{editingGroup?.id === group.id ? (
                              <div className="inline-action-panel group-edit-form mini-grid three">
                                <Field label={isDailyChamp ? 'HorÃ¡rio' : 'Nome do grupo'}><input value={editingGroup.nome} onChange={(event) => setEditingGroup({ ...editingGroup, nome: event.target.value })} /></Field>
                                <Field label="NÃºmero de slots"><input type="number" min="1" max="52" value={editingGroup.slots} onChange={(event) => setEditingGroup({ ...editingGroup, slots: event.target.value })} /></Field>
                                <Field label="Link do WhatsApp"><input value={editingGroup.whatsapp_url} onChange={(event) => setEditingGroup({ ...editingGroup, whatsapp_url: event.target.value })} placeholder="https://chat.whatsapp.com/..." /></Field>
                                <div className="button-row structure-edit-actions">
                                  <button className="button" type="button" onClick={async () => { await props.updateStructure('group', group.id, { nome: editingGroup.nome.trim(), slots: Number(editingGroup.slots || 1), whatsapp_url: editingGroup.whatsapp_url.trim() }); setEditingGroup(null) }}>Salvar alteraÃ§Ãµes</button>
                                  <button className="button secondary" type="button" onClick={() => setEditingGroup(null)}>Cancelar</button>
                                </div>
                              </div>
                            ) : null}
                            <div className="championship-vagas-list group-slots-list">
                              {slotsOfGroup.length === 0 ? (
                                <div className="vagas-empty-filter">
                                  Nenhum slot criado neste grupo. Edite o grupo e salve o número de slots, ou recarregue o painel.
                                </div>
                              ) : (
                                slotsOfGroup.map((slot) => {
                                  const entry = slotLineEntry(slot)
                                  const status = slotStatus(slot, entry)
                                  const slotNumber = Number(slot.data?.slot_numero || 0)
                                  const letter = String(
                                    slot.data?.slot_letra
                                    || (slotNumber > 0
                                      ? String.fromCharCode(64 + Math.min(slotNumber, 26))
                                      : '?'),
                                  )
                                  const slotFaseId = String(
                                    slot.data?.fase_id
                                    || group.data?.fase_id
                                    || (phase.id === 'sem-fase' ? '' : phase.id),
                                  )
                                  const logo = lineAvatar(entry, slot)
                                  const nomePrincipal = slotLineName(slot, entry, status, letter)
                                  const detalhe = slotDetail(slot, entry, status, group, phase)

                                  return (
                                    <article
                                      key={slot.id}
                                      className={`championship-vaga-row status-${status}`}
                                    >
                                      <button
                                        type="button"
                                        className="vaga-row-summary"
                                        onClick={() => {
                                          if (!slot.id) return
                                          setSlotModal({
                                            id: slot.id,
                                            fase_id: slotFaseId,
                                            grupo_id: group.id,
                                            slot_numero: String(slotNumber || ''),
                                            letra: letter,
                                            whatsapp_url: String(group.data?.whatsapp_url || ''),
                                          })
                                          props.setSlotAssignment({
                                            ...props.slotAssignment,
                                            slot_id: slot.id,
                                            fase_id: slotFaseId,
                                            grupo_id: group.id,
                                            slot_numero: String(slotNumber || ''),
                                            campeonato_equipe_id: '',
                                            equipe_id: '',
                                            line_id: '',
                                          })
                                        }}
                                      >
                                        <span className="vaga-row-number">{letter}</span>

                                        <span className={`vaga-row-avatar status-${status}`} aria-hidden>
                                          {status === 'ocupada' && logo ? (
                                            <img src={logo} alt="" />
                                          ) : status === 'ocupada' ? (
                                            <Users size={18} />
                                          ) : status === 'reservada' ? (
                                            <MessageCircle size={16} />
                                          ) : (
                                            <span className="vaga-avatar-dot" />
                                          )}
                                        </span>

                                        <span className="vaga-row-identity">
                                          <strong>{nomePrincipal}</strong>
                                          <small>{detalhe}</small>
                                        </span>

                                        <span className="vaga-row-meta">
                                          {status === 'reservada' ? (
                                            <span className="vaga-status-pill status-reservada">Reservada</span>
                                          ) : null}
                                        </span>

                                        <span className="vaga-row-chevron">
                                          <ChevronRight size={17} />
                                        </span>
                                      </button>
                                    </article>
                                  )
                                })
                              )}
                            </div>
                            </> : null}
                          </article>
                        })}{groupsOfPhase.length===0 ? <p className="empty">Nenhum grupo nesta fase.</p> : null}</div> : null}
                      </section>
                    })}
                  </div>
                </div>
              ) : null}

              {tab === 'jogos' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Jogos</p>
                      <h3>Jogos por fase</h3>
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        setEditingGameId('')
                        props.setGame({ nome: '', campeonato_id: selectedChamp.id, fase_id: '', data_jogo: '', horario: '', numero_partidas: '6', mapas: Array(6).fill(''), grupos_ids: [] })
                        setOpenAction('game')
                      }}
                    >
                      Novo jogo
                    </button>
                  </div>

                  {openAction === 'game' ? (
                    <div className="inline-action-panel game-editor-panel">
                      <div className="game-editor-heading">
                        <div>
                          <p className="eyebrow">{editingGameId ? 'Editar jogo' : 'Novo jogo'}</p>
                          <h4>{editingGameId ? 'Atualize as informaÃ§Ãµes do jogo' : 'Cadastre um jogo na fase selecionada'}</h4>
                        </div>
                        <button className="button secondary" type="button" onClick={() => { setOpenAction(''); setEditingGameId('') }}>Cancelar</button>
                      </div>
                      <div className="mini-grid three">
                        <Field label="Fase">
                          <select value={props.game.fase_id} onChange={(e) => props.setGame({ ...props.game, fase_id: e.target.value, campeonato_id: selectedChamp.id, grupos_ids: [] })}>
                            <option value="">Selecione</option>
                            {champPhases.map((phase) => <option key={phase.id} value={phase.id}>{rowTitle(phase)}</option>)}
                          </select>
                        </Field>
                        <Field label="Nome do jogo"><input value={props.game.nome} onChange={(e) => props.setGame({ ...props.game, nome: e.target.value, campeonato_id: selectedChamp.id })} placeholder="Jogo 1 - A x B" /></Field>
                        <Field label="NÃºmero de quedas"><input type="number" min="1" max="20" value={props.game.numero_partidas} onChange={(e) => { const total = Math.max(1, Number(e.target.value || 1)); props.setGame({ ...props.game, numero_partidas: e.target.value, mapas: Array.from({ length: total }, (_, index) => props.game.mapas[index] || ''), campeonato_id: selectedChamp.id }) }} /></Field>
                      </div>
                      <div className="mini-grid two">
                        <Field label="Data"><input type="date" value={props.game.data_jogo} onChange={(e) => props.setGame({ ...props.game, data_jogo: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                        <Field label="HorÃ¡rio"><input type="time" value={props.game.horario} onChange={(e) => props.setGame({ ...props.game, horario: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                      </div>

                      <div className="game-form-section">
                        <div className="game-form-section-header">
                          <div><strong>Mapas por queda</strong><small>Selecione um mapa para cada queda.</small></div>
                          {mapsLoading ? <Loader2 size={16} className="button-spinner" /> : null}
                        </div>
                        <div className="map-drop-grid">
                          {Array.from({ length: Math.max(1, Number(props.game.numero_partidas || 1)) }).map((_, index) => {
                            const selectedCode = props.game.mapas[index] || ''
                            const selectedMap = mapCatalog.find((mapa) => mapa.codigo === selectedCode)
                            return (
                              <label className="map-drop-field" key={index}>
                                <span>Queda {index + 1}</span>
                                <div className="map-drop-control">
                                  {selectedMap?.imagem_url ? <img src={selectedMap.imagem_url} alt="" /> : <div className="map-drop-placeholder" />}
                                  <select value={selectedCode} disabled={mapsLoading || mapCatalog.length === 0} onChange={(event) => {
                                    const nextMaps = Array.from({ length: Math.max(1, Number(props.game.numero_partidas || 1)) }, (_, mapIndex) => props.game.mapas[mapIndex] || '')
                                    nextMaps[index] = event.target.value
                                    props.setGame({ ...props.game, mapas: nextMaps, campeonato_id: selectedChamp.id })
                                  }}>
                                    <option value="">Selecione o mapa</option>
                                    {mapCatalog.map((mapa) => <option key={mapa.codigo} value={mapa.codigo}>{mapa.nome}</option>)}
                                  </select>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <div className="game-form-section">
                        <div className="game-form-section-header">
                          <div><strong>Grupos participantes</strong><small>Marque um ou mais grupos da fase selecionada.</small></div>
                          <span className="selection-count">{props.game.grupos_ids.length} selecionado(s)</span>
                        </div>
                        <div className="group-check-grid">
                          {champGroups.filter((group) => Boolean(props.game.fase_id) && group.data?.fase_id === props.game.fase_id).map((group) => {
                            const checked = props.game.grupos_ids.includes(group.id)
                            return (
                              <label className={`group-check-card ${checked ? 'selected' : ''}`} key={group.id}>
                                <input type="checkbox" checked={checked} onChange={() => {
                                  const grupos_ids = checked ? props.game.grupos_ids.filter((id) => id !== group.id) : [...props.game.grupos_ids, group.id]
                                  props.setGame({ ...props.game, grupos_ids, campeonato_id: selectedChamp.id })
                                }} />
                                <span className="group-check-box"><CheckCircle2 size={15} /></span>
                                <span><strong>{rowTitle(group)}</strong><small>{Number(group.data?.slots || 0)} slots</small></span>
                              </label>
                            )
                          })}
                          {!props.game.fase_id ? <p className="empty">Selecione uma fase para ver os grupos.</p> : null}
                          {props.game.fase_id && champGroups.filter((group) => group.data?.fase_id === props.game.fase_id).length === 0 ? <p className="empty">Nenhum grupo cadastrado nesta fase.</p> : null}
                        </div>
                      </div>
                      <div className="button-row">
                        <button
                          className="button"
                          type="button"
                          disabled={Boolean(props.pendingCreate)}
                          onClick={async () => {
                            const saved = editingGameId ? await props.updateGame(editingGameId) : await props.createGame()
                            if (saved) { setOpenAction(''); setEditingGameId('') }
                          }}
                        >
                          {props.pendingCreate === 'game' || props.pendingCreate === 'game_update' ? <><Loader2 size={15} className="button-spinner" /> {editingGameId ? 'Salvando jogo...' : 'Criando jogo...'}</> : editingGameId ? 'Salvar alteraÃ§Ãµes' : 'Criar jogo'}
                        </button>
                        <button className="button secondary" type="button" onClick={() => { setOpenAction(''); setEditingGameId('') }}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                  <div className="folder-structure game-folder-structure">
                    {champPhases.map((phase) => {
                      const gamesOfPhase = champGames.filter((game) => game.data?.fase_id === phase.id)
                      const phaseOpen = openGamePhases[phase.id] !== false
                      return (
                        <section className="folder-card phase-folder-card" key={phase.id}>
                          <header className="folder-row phase-folder-row">
                            <button className="folder-toggle" onClick={() => setOpenGamePhases((value) => ({ ...value, [phase.id]: !phaseOpen }))}>
                              {phaseOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              {phaseOpen ? <FolderOpen size={18} /> : <Folder size={18} />}
                              <span><strong>{rowTitle(phase)}</strong><small>{gamesOfPhase.length} jogo(s)</small></span>
                            </button>
                          </header>
                          {phaseOpen ? (
                            <div className="phase-groups-list game-list-in-phase">
                              {gamesOfPhase.map((gameRow) => {
                                const gameOpen = Boolean(openGames[gameRow.id])
                                const total = Number(gameRow.data?.numero_partidas || 1)
                                const rawMaps = Array.isArray(gameRow.data?.mapas) ? gameRow.data?.mapas as string[] : []
                                const groupIds = Array.isArray(gameRow.data?.grupos_ids) ? gameRow.data?.grupos_ids as string[] : []
                                const mapNames = rawMaps.slice(0, total).map((value) => mapCatalog.find((mapa) => mapa.codigo === value || mapa.nome.toLowerCase() === String(value).toLowerCase())?.nome || value).filter(Boolean)
                                return (
                                  <article className="folder-card game-folder-card" key={gameRow.id}>
                                    <header className="folder-row game-folder-row">
                                      <button className="folder-toggle" onClick={() => setOpenGames((value) => ({ ...value, [gameRow.id]: !gameOpen }))}>
                                        {gameOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <Folder size={18} />
                                        <span><strong>{rowTitle(gameRow)}</strong><small>{dataText(gameRow, 'data_jogo') || 'Sem data'} Â· {total} queda(s)</small></span>
                                      </button>
                                      <div className="folder-actions">
                                        <button title="Editar jogo" onClick={() => {
                                          const normalizedMaps = Array.from({ length: total }, (_, index) => {
                                            const value = rawMaps[index] || ''
                                            return mapCatalog.find((mapa) => mapa.codigo === value || mapa.nome.toLowerCase() === String(value).toLowerCase())?.codigo || value
                                          })
                                          setEditingGameId(gameRow.id)
                                          props.setGame({
                                            nome: rowTitle(gameRow),
                                            campeonato_id: selectedChamp.id,
                                            fase_id: String(gameRow.data?.fase_id || phase.id),
                                            data_jogo: String(gameRow.data?.data_jogo || '').slice(0, 10),
                                            horario: String(gameRow.data?.horario || '').slice(0, 5),
                                            numero_partidas: String(total),
                                            mapas: normalizedMaps,
                                            grupos_ids: groupIds,
                                          })
                                          setOpenAction('game')
                                          window.scrollTo({ top: 0, behavior: 'smooth' })
                                        }}><Pencil size={15} /></button>
                                        <button title="Excluir jogo" className="danger" onClick={async () => { if (window.confirm(`Excluir o jogo ${rowTitle(gameRow)}?`)) await props.deleteGame(gameRow.id) }}><Trash2 size={15} /></button>
                                      </div>
                                    </header>
                                    {gameOpen ? (
                                      <div className="game-folder-details">
                                        <div><span>Fase</span><strong>{rowTitle(phase)}</strong></div>
                                        <div><span>Data e horÃ¡rio</span><strong>{dataText(gameRow, 'data_jogo') || 'NÃ£o definida'}{gameRow.data?.horario ? ` Â· ${String(gameRow.data.horario).slice(0, 5)}` : ''}</strong></div>
                                        <div><span>Quedas</span><strong>{total}</strong></div>
                                        <div><span>Grupos</span><strong>{groupIds.map((id) => groupName(id)).join(', ') || 'Nenhum grupo'}</strong></div>
                                        <div className="wide"><span>Mapas</span><strong>{mapNames.join(' Â· ') || 'NÃ£o definidos'}</strong></div>
                                      </div>
                                    ) : null}
                                  </article>
                                )
                              })}
                              {gamesOfPhase.length === 0 ? <p className="empty">Nenhum jogo nesta fase.</p> : null}
                            </div>
                          ) : null}
                        </section>
                      )
                    })}
                    {champPhases.length === 0 ? <p className="empty">Crie uma fase antes de cadastrar jogos.</p> : null}
                  </div>
                </div>
              ) : null}

              {tab === 'estatisticas' ? (
                <CampeonatoEstatisticasTab
                  campeonatoId={selectedChamp.id}
                  phases={champPhases}
                  groups={champGroups}
                  games={champGames}
                  maps={mapCatalog}
                />
              ) : null}

              {tab === 'vendedores' ? (() => {
                const pendingInvites = mgrInvites.filter((c) => c.status === 'pendente')
                const activeSellers = sellerRows
                  .filter((s) => Boolean(s.no_campeonato || s.vinculo_atual))
                  .slice()
                  .sort((a, b) => {
                    const an = String(a.nome_publico || a.managers?.nome || a.managers?.username || '')
                    const bn = String(b.nome_publico || b.managers?.nome || b.managers?.username || '')
                    return an.localeCompare(bn, 'pt-BR')
                  })
                const rosterOnly = sellerRows
                  .filter((s) => !s.no_campeonato && !s.vinculo_atual)
                  .slice()
                  .sort((a, b) => {
                    const an = String(a.nome_publico || a.managers?.nome || a.managers?.username || '')
                    const bn = String(b.nome_publico || b.managers?.nome || b.managers?.username || '')
                    return an.localeCompare(bn, 'pt-BR')
                  })
                const selectedLimite = Number(
                  sellerSelected?.limite_vagas_atual
                  ?? sellerSelected?.vinculo_atual?.limite_vagas
                  ?? 0,
                )
                const selectedUsadas = Number(sellerSelected?.vagas_usadas || 0)
                const publicPanel = sellerSelected?.manager_id
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}/vendedores/${sellerSelected.manager_id}`
                  : ''

                function toggleSeller(seller: any) {
                  if (sellerSelected?.manager_id === seller.manager_id) {
                    setSellerSelected(null)
                    return
                  }
                  openSellerEditor(seller)
                }

                return (
                  <div className="ref-section-stack seller-tab">
                    <div className="subtab-actionbar">
                      <div>
                        <p className="eyebrow">Vendedores</p>
                        <h3>{rowTitle(selectedChamp)}</h3>
                      </div>
                      <button type="button" className="button" onClick={openInviteForm}>
                        <Plus size={16} /> Convidar
                      </button>
                    </div>

                    {sellerError ? <div className="message error">{sellerError}</div> : null}
                    {mgrInviteMsg ? <div className="message success">{mgrInviteMsg}</div> : null}

                    {sellerLoading ? (
                      <div className="teams-tab-loading">
                        <Loader2 size={18} className="spin" /> Carregando managers...
                      </div>
                    ) : null}

                    {!sellerLoading && activeSellers.length === 0 && rosterOnly.length === 0 && pendingInvites.length === 0 ? (
                      <div className="vagas-empty-filter">
                        Nenhum manager neste evento. Use <strong>Convidar</strong> para enviar pelo correio.
                      </div>
                    ) : null}

                    {!sellerLoading && (activeSellers.length > 0 || rosterOnly.length > 0) ? (
                      <div className="championship-vagas-list seller-managers-list">
                        {activeSellers.map((seller, index) => {
                          const manager = seller.managers || {}
                          const limite = Number(seller.vinculo_atual?.limite_vagas ?? seller.limite_vagas_atual ?? 0)
                          const usadas = Number(seller.vagas_usadas || 0)
                          const aberta = sellerSelected?.manager_id === seller.manager_id
                          const nome = seller.nome_publico || manager.nome || manager.username || 'Manager'
                          const detalhe = [
                            manager.username ? `@${manager.username}` : null,
                            limite > 0 ? `${usadas}/${limite} vagas` : `${usadas} vendida(s)`,
                          ].filter(Boolean).join(' · ')
                          return (
                            <article
                              key={seller.manager_id || seller.id}
                              className={`championship-vaga-row status-ocupada ${aberta ? 'is-open' : ''}`}
                            >
                              <button
                                type="button"
                                className="vaga-row-summary"
                                onClick={() => toggleSeller(seller)}
                                aria-expanded={aberta}
                              >
                                <span className="vaga-row-number">{String(index + 1).padStart(2, '0')}</span>
                                <span className="vaga-row-avatar status-ocupada" aria-hidden>
                                  {manager.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={manager.avatar_url} alt="" />
                                  ) : (
                                    <Users size={18} />
                                  )}
                                </span>
                                <span className="vaga-row-identity">
                                  <strong>{nome}</strong>
                                  <small>{detalhe}</small>
                                </span>
                                <span className="vaga-row-meta">
                                  <span className="vaga-status-pill status-ocupada">
                                    {limite > 0 ? `${usadas}/${limite}` : `${usadas} vagas`}
                                  </span>
                                </span>
                                <span className="vaga-row-chevron">
                                  {aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                </span>
                              </button>

                              {aberta ? (
                                <div className="vaga-row-details seller-row-details">
                                  <div className="vaga-detail-grid">
                                    <span>
                                      <small>Vagas vendidas</small>
                                      <strong>{selectedUsadas}</strong>
                                    </span>
                                    <span>
                                      <small>Limite</small>
                                      <strong>{selectedLimite > 0 ? selectedLimite : 'Sem limite'}</strong>
                                    </span>
                                    <span>
                                      <small>Status</small>
                                      <strong>Ativo neste evento</strong>
                                    </span>
                                  </div>

                                  <div className="seller-row-edit">
                                    <Field label="Limite de vagas (0 = sem limite)">
                                      <input
                                        type="number"
                                        min={0}
                                        value={sellerLimite}
                                        onChange={(e) => setSellerLimite(e.target.value)}
                                        placeholder="0"
                                      />
                                    </Field>
                                    <div className="seller-perm-grid compact">
                                      {([
                                        ['gerar_convites_equipe', 'Gerar convites'],
                                        ['adicionar_equipes', 'Adicionar equipes'],
                                        ['remover_equipes', 'Remover equipes'],
                                        ['ver_estrutura', 'Ver estrutura'],
                                        ['organizar_grupos', 'Fases e grupos'],
                                        ['gerenciar_jogos', 'Criar/editar jogos'],
                                        ['pontuar_tabela', 'Pontuar'],
                                      ] as const).map(([key, label]) => (
                                        <label key={key} className="seller-perm-item">
                                          <input
                                            type="checkbox"
                                            checked={Boolean((sellerPerms as any)[key])}
                                            onChange={(e) =>
                                              setSellerPerms((current) => ({ ...current, [key]: e.target.checked }))
                                            }
                                          />
                                          <span>{label}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <div className="vaga-row-actions">
                                      <button
                                        type="button"
                                        disabled={sellerBusy}
                                        onClick={() => void attachSellerToChampionship()}
                                      >
                                        {sellerBusy ? 'Salvando...' : 'Salvar'}
                                      </button>
                                      {publicPanel ? (
                                        <button type="button" onClick={() => props.copyToken(publicPanel)}>
                                          <Copy size={14} /> Link
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="danger"
                                        disabled={sellerBusy}
                                        onClick={() => void detachSellerFromChampionship(seller.manager_id)}
                                      >
                                        <Trash2 size={14} /> Encerrar
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          )
                        })}

                        {rosterOnly.map((seller) => {
                          const manager = seller.managers || {}
                          const aberta = sellerSelected?.manager_id === seller.manager_id
                          const nome = seller.nome_publico || manager.nome || manager.username || 'Manager'
                          return (
                            <article
                              key={seller.manager_id || seller.id}
                              className={`championship-vaga-row status-livre ${aberta ? 'is-open' : ''}`}
                            >
                              <button
                                type="button"
                                className="vaga-row-summary"
                                onClick={() => toggleSeller(seller)}
                                aria-expanded={aberta}
                              >
                                <span className="vaga-row-number">—</span>
                                <span className="vaga-row-avatar status-livre" aria-hidden>
                                  {manager.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={manager.avatar_url} alt="" />
                                  ) : (
                                    <Users size={18} />
                                  )}
                                </span>
                                <span className="vaga-row-identity">
                                  <strong>{nome}</strong>
                                  <small>
                                    {manager.username ? `@${manager.username}` : 'Manager'}
                                    {' · só na produtora'}
                                  </small>
                                </span>
                                <span className="vaga-row-meta">
                                  <span className="vaga-status-pill status-livre">Fora</span>
                                </span>
                                <span className="vaga-row-chevron">
                                  {aberta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                </span>
                              </button>
                              {aberta ? (
                                <div className="vaga-row-details seller-row-details">
                                  <div className="vaga-detail-copy">
                                    <strong>Não vende neste evento</strong>
                                    <span>Libere com limite e permissões, ou use Convidar se ainda não for da produtora.</span>
                                  </div>
                                  <div className="seller-row-edit">
                                    <Field label="Limite de vagas (0 = sem limite)">
                                      <input
                                        type="number"
                                        min={0}
                                        value={sellerLimite}
                                        onChange={(e) => setSellerLimite(e.target.value)}
                                        placeholder="0"
                                      />
                                    </Field>
                                    <div className="seller-perm-grid compact">
                                      {([
                                        ['gerar_convites_equipe', 'Gerar convites'],
                                        ['adicionar_equipes', 'Adicionar equipes'],
                                        ['remover_equipes', 'Remover equipes'],
                                        ['ver_estrutura', 'Ver estrutura'],
                                        ['organizar_grupos', 'Fases e grupos'],
                                        ['gerenciar_jogos', 'Criar/editar jogos'],
                                        ['pontuar_tabela', 'Pontuar'],
                                      ] as const).map(([key, label]) => (
                                        <label key={key} className="seller-perm-item">
                                          <input
                                            type="checkbox"
                                            checked={Boolean((sellerPerms as any)[key])}
                                            onChange={(e) =>
                                              setSellerPerms((current) => ({ ...current, [key]: e.target.checked }))
                                            }
                                          />
                                          <span>{label}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <div className="vaga-row-actions">
                                      <button
                                        type="button"
                                        disabled={sellerBusy}
                                        onClick={() => void attachSellerToChampionship()}
                                      >
                                        {sellerBusy ? 'Salvando...' : 'Liberar neste evento'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    ) : null}

                    {!sellerLoading && pendingInvites.length > 0 ? (
                      <div className="championship-vagas-list seller-managers-list" style={{ marginTop: 12 }}>
                        {pendingInvites.map((c) => (
                          <article key={c.id} className="championship-vaga-row status-reservada">
                            <div className="vaga-row-summary" style={{ cursor: 'default' }}>
                              <span className="vaga-row-number">…</span>
                              <span className="vaga-row-avatar status-reservada" aria-hidden>
                                <UserPlus size={16} />
                              </span>
                              <span className="vaga-row-identity">
                                <strong>@{c.manager?.username || c.manager_username || 'manager'}</strong>
                                <small>
                                  {c.tipo === 'pedido' ? 'Pedido pendente' : 'Convite enviado'}
                                  {' · expira '}
                                  {new Date(c.expira_em).toLocaleDateString('pt-BR')}
                                </small>
                              </span>
                              <span className="vaga-row-meta">
                                {c.tipo === 'convite' ? (
                                  <button
                                    type="button"
                                    className="button secondary small"
                                    disabled={sellerBusy}
                                    onClick={() => void cancelChampManagerInvite(c.id)}
                                  >
                                    Cancelar
                                  </button>
                                ) : (
                                  <span className="vaga-status-pill status-reservada">Correio</span>
                                )}
                              </span>
                              <span className="vaga-row-chevron" aria-hidden />
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    <SystemModal
                      open={showInviteForm}
                      title="Convidar manager"
                      description={`Envie convite no correio para operar ${rowTitle(selectedChamp)}.`}
                      onClose={closeInviteForm}
                      size="medium"
                    >
                      <div className="seller-invite-modal">
                        <div className="mini-grid two">
                          <Field label="Buscar @username ou ID">
                            <div className="staff-search-row">
                              <input
                                value={mgrQuery}
                                onChange={(e) => setMgrQuery(e.target.value)}
                                placeholder="@username ou 123"
                                onKeyDown={(e) => { if (e.key === 'Enter') void searchManagersForChamp() }}
                              />
                              <button
                                type="button"
                                className="button secondary"
                                disabled={sellerBusy}
                                onClick={() => void searchManagersForChamp()}
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
                              value={mgrValidade}
                              onChange={(e) => setMgrValidade(e.target.value)}
                            />
                          </Field>
                        </div>

                        {mgrSearch.length > 0 ? (
                          <div className="staff-search-results">
                            {mgrSearch.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className={`staff-search-card ${mgrSelected?.id === m.id ? 'selected' : ''}`}
                                onClick={() => { setMgrSelected(m); setMgrQuery(m.username) }}
                              >
                                <strong>@{m.username}</strong>
                                <span>{m.nome}</span>
                                <small>{m.public_id_prefix || 'MN'}{m.public_id}</small>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="mini-grid two">
                          <Field label="Limite de vagas (0 = sem limite)">
                            <input
                              type="number"
                              min={0}
                              value={mgrLimite}
                              onChange={(e) => setMgrLimite(e.target.value)}
                              placeholder="0"
                            />
                          </Field>
                          <Field label="Mensagem (opcional)">
                            <input
                              value={mgrMessage}
                              onChange={(e) => setMgrMessage(e.target.value)}
                              placeholder="Ex.: Liberado para vender vagas."
                            />
                          </Field>
                        </div>

                        <div className="seller-perm-grid compact">
                          {([
                            ['gerar_convites_equipe', 'Gerar convites'],
                            ['adicionar_equipes', 'Adicionar equipes'],
                            ['remover_equipes', 'Remover equipes'],
                            ['ver_estrutura', 'Ver estrutura'],
                            ['organizar_grupos', 'Fases e grupos'],
                            ['gerenciar_jogos', 'Criar/editar jogos'],
                            ['pontuar_tabela', 'Pontuar'],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="seller-perm-item">
                              <input
                                type="checkbox"
                                checked={Boolean((mgrPerms as any)[key])}
                                onChange={(e) => setMgrPerms((c) => ({ ...c, [key]: e.target.checked }))}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>

                        <div className="modal-form-actions">
                          <button type="button" className="button secondary" onClick={closeInviteForm}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="button"
                            disabled={sellerBusy}
                            onClick={() => void sendChampManagerInvite()}
                          >
                            <UserPlus size={16} />
                            {sellerBusy ? 'Enviando...' : 'Enviar no correio'}
                          </button>
                        </div>
                      </div>
                    </SystemModal>
                  </div>
                )
              })() : null}

              {tab === 'links' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Links</p>
                      <h3>Entrada de equipes por grupo</h3>
                      <p className="muted-copy">
                        Crie um link com limite de vagas. “Equipes esperadas” é opcional e só para controle interno —
                        o convidado não vê e não precisa escolher nada da lista.
                      </p>
                    </div>
                    <button className="button" onClick={() => toggleAction('link')}>Gerar novo link</button>
                  </div>
                  {openAction === 'link' ? (
                    <div className="inline-action-panel">
                      <div className="mini-grid two">
                        <Field label="Nome interno do link">
                          <input
                            value={props.registrationLink.nome_interno}
                            onChange={(e) =>
                              props.setRegistrationLink({
                                ...props.registrationLink,
                                nome_interno: e.target.value,
                              })
                            }
                            placeholder="Ex.: Vendedor João · Grupo A"
                          />
                        </Field>
                        <Field label="Grupo do link">
                          <select
                            value={props.registrationLink.grupo_id}
                            onChange={(e) => {
                              const grupoId = e.target.value
                              const livres = grupoId ? Math.max(1, freeSlotsInGroup(grupoId)) : 1
                              const current = Number(props.registrationLink.limite_vagas || 1)
                              const limite = Math.min(Math.max(1, current || 1), livres)
                              props.setRegistrationLink({
                                ...props.registrationLink,
                                grupo_id: grupoId,
                                limite_vagas: String(limite),
                              })
                            }}
                          >
                            <option value="">Selecione</option>
                            {champGroups.map((group) => {
                              const livres = freeSlotsInGroup(group.id)
                              const total = Number(group.data?.slots || 0)
                              return (
                                <option key={group.id} value={group.id} disabled={livres < 1}>
                                  {rowTitle(group)} · {livres} livre{livres === 1 ? '' : 's'} de {total}
                                </option>
                              )
                            })}
                          </select>
                        </Field>
                      </div>
                      <div className="mini-grid two">
                        <Field label="Máx. de equipes neste link">
                          {(() => {
                            const grupoId = props.registrationLink.grupo_id
                            const livres = grupoId ? freeSlotsInGroup(grupoId) : 0
                            const max = Math.max(0, livres)
                            return (
                              <select
                                value={props.registrationLink.limite_vagas}
                                disabled={!grupoId || max < 1}
                                onChange={(e) => {
                                  props.setRegistrationLink({
                                    ...props.registrationLink,
                                    limite_vagas: String(Math.max(1, Number(e.target.value) || 1)),
                                  })
                                }}
                              >
                                {!grupoId ? (
                                  <option value="1">Selecione o grupo</option>
                                ) : max < 1 ? (
                                  <option value="1">Sem vagas livres</option>
                                ) : (
                                  Array.from({ length: max }, (_, index) => index + 1).map((n) => (
                                    <option key={n} value={String(n)}>
                                      {n === 1 ? '1 equipe' : `${n} equipes`}
                                    </option>
                                  ))
                                )}
                              </select>
                            )
                          })()}
                        </Field>
                        <Field label="Encerrar em (opcional)">
                          <input
                            type="datetime-local"
                            value={props.registrationLink.encerra_em}
                            onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, encerra_em: e.target.value })}
                          />
                        </Field>
                      </div>

                      <div className="link-ref-list-panel">
                        <div className="link-ref-list-head">
                          <strong>Equipes esperadas (opcional)</strong>
                          <small>Controle interno — cole a lista (uma por linha ou separadas por vírgula)</small>
                        </div>
                        <label className="field">
                          <span>Lista</span>
                          <textarea
                            rows={5}
                            value={props.registrationLink.equipes_esperadas_texto}
                            onChange={(e) =>
                              props.setRegistrationLink({
                                ...props.registrationLink,
                                equipes_esperadas_texto: e.target.value,
                              })
                            }
                            placeholder={'TEAM SIX\nALOE\nLOUD, FURIA'}
                          />
                        </label>
                        <p className="muted-copy" style={{ marginTop: 6 }}>
                          Não interfere na inscrição. Conforme as equipes usarem o link, o sistema marca quem entrou e com qual line.
                        </p>
                      </div>

                      <p className="muted-copy">
                        Ao gerar, copiamos uma mensagem curta com o link para WhatsApp/Discord.
                      </p>
                      <button
                        className="button"
                        type="button"
                        disabled={Boolean(props.pendingCreate)}
                        onClick={() => props.createRegistrationLink()}
                      >
                        {props.pendingCreate === 'registration_link'
                          ? <><Loader2 size={15} className="button-spinner" /> Gerando link...</>
                          : 'Gerar link e copiar mensagem'}
                      </button>
                    </div>
                  ) : null}
                  <div className="links-invite-list">
                    <div className="section-head compact-head">
                      <div>
                        <p className="eyebrow">Convites gerados</p>
                        <h3>Lista de links do campeonato</h3>
                      </div>
                      <span className="selection-count">
                        {filteredGroupInviteLinks.length}
                        {linkStatusFilter !== 'todos' ? ` de ${groupInviteLinks.length}` : ''} link(s)
                      </span>
                    </div>

                    {groupInviteLinks.length > 0 ? (
                      <div className="link-status-filters" role="tablist" aria-label="Filtrar links por status">
                        {([
                          ['todos', 'Todos'],
                          ['ativo', 'Ativos'],
                          ['pausado', 'Pausados'],
                          ['esgotado', 'Esgotados'],
                          ['grupo_cheio', 'Grupo cheio'],
                          ['expirado', 'Expirados'],
                        ] as const).map(([key, label]) => {
                          const count = linkFilterCounts[key] ?? 0
                          if (key !== 'todos' && count === 0) return null
                          return (
                            <button
                              key={key}
                              type="button"
                              role="tab"
                              aria-selected={linkStatusFilter === key}
                              className={`link-status-filter ${linkStatusFilter === key ? 'active' : ''}`}
                              onClick={() => setLinkStatusFilter(key)}
                            >
                              {label}
                              <b>{count}</b>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    {groupInviteLinks.length === 0 ? (
                      <p className="empty">Nenhum link de equipes gerado ainda. Use “Gerar novo link” acima.</p>
                    ) : filteredGroupInviteLinks.length === 0 ? (
                      <p className="empty">
                        Nenhum link com status “{linkStatusFilter}”.{' '}
                        <button type="button" className="link-inline-reset" onClick={() => setLinkStatusFilter('todos')}>
                          Ver todos
                        </button>
                      </p>
                    ) : (
                      filteredGroupInviteLinks.map((link) => {
                        const path = `/convite/grupo/${link.token}`
                        const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${path}`
                        const info = linkStatusInfo(link)
                        const isOpen = openLinkIds[link.id] === true
                        const isPaused = link.data?.ativo === false || info.status === 'pausado'

                        return (
                          <article key={link.id} className={`link-invite-row status-${info.status} ${isOpen ? 'is-open' : ''}`}>
                            <button
                              type="button"
                              className="link-invite-summary"
                              onClick={() => setOpenLinkIds((prev) => ({ ...prev, [link.id]: !isOpen }))}
                              aria-expanded={isOpen}
                            >
                              <span className="link-invite-icon" aria-hidden>
                                <Link2 size={16} />
                              </span>
                              <span className="link-invite-main">
                                <strong>
                                  {String(link.data?.titulo || link.name || '').trim()
                                    || groupName(String(link.data?.group_id || link.data?.grupo_id || ''))}
                                </strong>
                                <small>
                                  {groupName(String(link.data?.group_id || link.data?.grupo_id || ''))}
                                  {' · '}
                                  {info.limite != null ? `${info.usos}/${info.limite} vaga(s)` : `${info.usos} uso(s)`}
                                  {info.temListaEsperada
                                    ? ` · ${info.inscritosLista} inscrita(s)${info.pendentes > 0 ? ` · ${info.pendentes} pendente(s)` : ''}`
                                    : info.entradas.length
                                      ? ` · ${info.entradas.length} entrada(s)`
                                      : ''}
                                  {' · '}
                                  criado {formatDateTime(link.created_at)}
                                  {link.data?.expira_em ? ` · encerra ${formatDateTime(String(link.data.expira_em))}` : ''}
                                </small>
                              </span>
                              <span className={`link-status-pill status-${info.status}`}>{info.statusLabel}</span>
                              <span className="link-invite-chevron">
                                {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                              </span>
                            </button>

                            {isOpen ? (
                              <div className="link-invite-details">
                                <div className="link-invite-meta-grid">
                                  <span>
                                    <small>Token / caminho</small>
                                    <strong>{path}</strong>
                                  </span>
                                  <span>
                                    <small>Uso</small>
                                    <strong>
                                      {info.limite != null
                                        ? `${info.usos} de ${info.limite}`
                                        : `${info.usos}`}
                                      {info.restantes != null ? ` · restam ${info.restantes}` : ''}
                                    </strong>
                                  </span>
                                  <span>
                                    <small>Validade</small>
                                    <strong>
                                      {link.data?.expira_em
                                        ? formatDateTime(String(link.data.expira_em))
                                        : 'Sem data de encerramento'}
                                    </strong>
                                  </span>
                                  <span>
                                    <small>Status</small>
                                    <strong>{info.statusLabel}</strong>
                                  </span>
                                </div>

                                <div className="link-invite-entries">
                                  <div className="link-invite-entries-head">
                                    <strong>Equipes esperadas / entradas</strong>
                                    <small>
                                      {info.temListaEsperada
                                        ? `${info.inscritosLista} inscrita(s) · ${info.pendentes} pendente(s)`
                                        : info.entradas.length
                                          ? `${info.entradas.length} entrada(s) (sem lista prévia)`
                                          : 'Sem entradas ainda'}
                                    </small>
                                  </div>
                                  {(() => {
                                    const controle = Array.isArray(link.data?.vagas_controle)
                                      ? link.data.vagas_controle
                                      : (Array.isArray(link.data?.expected_teams) ? link.data.expected_teams : []).map((nome: string, i: number) => {
                                          const key = String(nome || '').trim().toLowerCase()
                                          const match = info.entradas.find((e: any) =>
                                            String(e.referencia_lista || e.equipe_nome || '').trim().toLowerCase() === key,
                                          )
                                          return {
                                            ordem: i + 1,
                                            referencia: nome,
                                            status: match ? 'inscrita' : 'pendente',
                                            entrada: match || null,
                                          }
                                        })
                                    if (!controle.length && !info.entradas.length) {
                                      return <p className="empty compact-empty">Sem lista de equipes esperadas. As entradas aparecerão aqui quando alguém se inscrever.</p>
                                    }
                                    if (!controle.length) {
                                      return (
                                        <div className="link-entry-table">
                                          {info.entradas.map((entrada: any, index: number) => (
                                            <div key={entrada.participacao_id || index} className="link-entry-row">
                                              <span className="link-entry-slot">
                                                {entrada.slot_letra || (entrada.slot_numero != null ? String(entrada.slot_numero) : '—')}
                                              </span>
                                              <span className="link-entry-identity">
                                                <strong>{entrada.line_nome || entrada.equipe_nome || 'Line'}</strong>
                                                <small>{entrada.referencia_lista || entrada.equipe_nome || 'via link'}</small>
                                              </span>
                                              <span className="link-entry-when">{formatDateTime(entrada.entrou_em)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="link-entry-table">
                                        {controle.map((item: any) => (
                                          <div
                                            key={`${item.ordem}-${item.referencia}`}
                                            className={`link-entry-row status-ref-${item.status}`}
                                          >
                                            <span className={`link-entry-slot status-${item.status}`}>
                                              {item.status === 'inscrita'
                                                ? (item.entrada?.slot_letra || item.ordem)
                                                : item.ordem}
                                            </span>
                                            <span className="link-entry-identity">
                                              <strong>{item.referencia}</strong>
                                              <small>
                                                {item.status === 'inscrita'
                                                  ? `${item.entrada?.line_nome || item.entrada?.equipe_nome || 'Inscrita'}${item.entrada?.equipe_nome && item.entrada?.line_nome ? ` · ${item.entrada.equipe_nome}` : ''}`
                                                  : 'Aguardando inscrição'}
                                              </small>
                                            </span>
                                            <span className={`link-ref-status-pill status-${item.status}`}>
                                              {item.status === 'inscrita' ? 'Inscrita' : 'Pendente'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </div>

                                <div className="link-invite-actions">
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => {
                                      const teams = Array.isArray(link.data?.expected_teams)
                                        ? link.data.expected_teams as string[]
                                        : []
                                      const texto = buildShareFromLink({
                                        campeonatoNome: selectedChamp ? rowTitle(selectedChamp) : 'Campeonato',
                                        grupoNome: groupName(String(link.data?.group_id || link.data?.grupo_id || '')),
                                        limite: info.limite || teams.length || 1,
                                        teams,
                                        url: fullUrl || `${window.location.origin}${path}`,
                                        expiraEm: link.data?.expira_em ? String(link.data.expira_em) : null,
                                        titulo: String(link.data?.titulo || link.name || '') || null,
                                      })
                                      props.copyToken(texto)
                                    }}
                                  >
                                    <Copy size={14} /> Copiar mensagem
                                  </button>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => props.copyToken(fullUrl || `${window.location.origin}${path}`)}
                                  >
                                    <Copy size={14} /> Só o link
                                  </button>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    title={
                                      info.status === 'esgotado'
                                        ? 'Reabre o link. Usos passam a refletir quem já entrou (histórico mantido).'
                                        : info.status === 'grupo_cheio'
                                          ? 'Tenta reativar se o grupo voltar a ter vaga'
                                          : info.status === 'expirado'
                                            ? 'Link expirado por data — gere um novo ou altere a validade'
                                            : isPaused
                                              ? 'Reativar link'
                                              : 'Pausar link'
                                    }
                                    disabled={info.status === 'expirado' || info.status === 'excluido'}
                                    onClick={() => {
                                      if (info.status === 'esgotado' || info.status === 'grupo_cheio' || isPaused) {
                                        const reset = info.status === 'esgotado' || info.status === 'grupo_cheio'
                                        if (
                                          info.status === 'esgotado'
                                          && !window.confirm(
                                            'Reabrir este link esgotado? O contador de usos será recalculado com base em quem já entrou (não zera o histórico).',
                                          )
                                        ) {
                                          return
                                        }
                                        props.updateStructure('registration_link', link.id, {
                                          ativo: true,
                                          ...(reset ? { reset_usos: true } : {}),
                                        })
                                        return
                                      }
                                      props.updateStructure('registration_link', link.id, { ativo: false })
                                    }}
                                  >
                                    {info.status === 'ativo' ? <Pause size={14} /> : <Play size={14} />}
                                    {info.status === 'ativo'
                                      ? 'Pausar'
                                      : info.status === 'esgotado'
                                        ? 'Reabrir vagas'
                                        : info.status === 'grupo_cheio'
                                          ? 'Tentar reabrir'
                                          : 'Reativar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    title="Abre o formulário com o mesmo grupo para gerar outro link."
                                    onClick={() => {
                                      const grupoId = String(link.data?.group_id || link.data?.grupo_id || '')
                                      const livres = grupoId ? freeSlotsInGroup(grupoId) : 1
                                      const limite = Math.min(
                                        Number(link.data?.limite_vagas || link.data?.metadata?.limite_vagas || 1) || 1,
                                        Math.max(1, livres),
                                      )
                                      props.setRegistrationLink({
                                        grupo_id: grupoId,
                                        nome_interno: '',
                                        limite_vagas: String(limite),
                                        equipes_esperadas_texto: '',
                                        encerra_em: '',
                                        descricao: '',
                                      })
                                      setOpenAction('link')
                                      window.scrollTo({ top: 0, behavior: 'smooth' })
                                    }}
                                  >
                                    <Plus size={14} /> Novo link (mesmo grupo)
                                  </button>
                                  <button
                                    type="button"
                                    className="button secondary danger"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          'Excluir este link? Ele deixa de aparecer na lista e não aceita novas inscrições, mas quem já tem o URL ainda pode acompanhar o grupo.',
                                        )
                                      ) {
                                        props.deleteStructure('registration_link', link.id)
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} /> Excluir
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </article>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-state-big">
            <Trophy size={36} />
            <h2>Selecione ou crie um campeonato</h2>
            <p>Ao selecionar, as abas de equipes, jogadores, fases, grupos e jogos aparecem aqui.</p>
          </div>
        )}
      </section>
    </div>
  )
}


