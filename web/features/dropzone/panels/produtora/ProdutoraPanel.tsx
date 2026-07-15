'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Folder, FolderOpen, Loader2, MessageCircle, Pause, Pencil, Play, Plus, RefreshCw, Trash2, Trophy, UserPlus, Users } from 'lucide-react'
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
  registrationLink: { tipo: string; grupo_id: string; vagas_por_equipe: string; abre_em: string; encerra_em: string; permite_substituicao: boolean; max_substituicoes_por_equipe: string; substituicao_encerra_em: string; descricao: string; nomes_equipes: string }
  setRegistrationLink: (value: any) => void
  createRegistrationLink: () => void
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
    remover_proprias_equipes: true,
    ver_estrutura: true,
    organizar_grupos: false,
    pontuar_tabela: false,
  })

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
    if (!token) throw new Error('SessÃ£o expirada. Entre novamente.')
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || 'NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.')
    return json
  }

  async function loadSellers(championshipId?: string) {
    setSellerLoading(true)
    setSellerError('')
    try {
      const qs = championshipId ? `?campeonato_id=${encodeURIComponent(championshipId)}` : ''
      const json = await sellerRequest(`/api/produtora/vendedores${qs}`)
      setSellerRows(json.vendedores || [])
    } catch (error) {
      // fallback legado por campeonato
      try {
        if (championshipId) {
          const json = await sellerRequest(`/api/campeonatos/${championshipId}/vendedores`)
          setSellerRows(
            (json.vendedores || []).map((row: any) => ({
              ...row,
              no_campeonato: row.status === 'ativo' && Boolean(row.manager_id),
              vinculo_atual: row.manager_id ? { limite_vagas: row.limite_vagas, status: row.status } : null,
              campeonatos: [],
              public_url: row.manager_id ? `/vendedores/${row.manager_id}` : null,
            })),
          )
        } else {
          setSellerRows([])
        }
      } catch (err2) {
        setSellerError(err2 instanceof Error ? err2.message : 'Erro ao carregar vendedores.')
        setSellerRows([])
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
      remover_proprias_equipes: perms.remover_proprias_equipes !== false,
      ver_estrutura: perms.ver_estrutura !== false,
      organizar_grupos: perms.organizar_grupos === true,
      pontuar_tabela: perms.pontuar_tabela === true,
    })
  }

  /** Adiciona vendedor já da produtora neste campeonato e define limite/funções. */
  async function attachSellerToChampionship() {
    if (!sellerSelected?.manager_id || !selectedChamp?.id) return
    setSellerBusy(true)
    setSellerError('')
    try {
      await sellerRequest('/api/produtora/vendedores', {
        method: 'POST',
        body: JSON.stringify({
          action: 'attach',
          manager_id: sellerSelected.manager_id,
          campeonato_id: selectedChamp.id,
          limite_vagas: sellerLimite,
          permissoes: sellerPerms,
        }),
      })
      setSellerSelected(null)
      setSellerLimite('')
      await loadSellers(selectedChamp.id)
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao adicionar no campeonato.')
    } finally {
      setSellerBusy(false)
    }
  }

  async function detachSellerFromChampionship(managerId: string) {
    if (!selectedChamp?.id) return
    if (!window.confirm('Remover este vendedor apenas deste campeonato? Ele continua na lista da produtora.')) return
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
    } catch (error) {
      setSellerError(error instanceof Error ? error.message : 'Erro ao remover do campeonato.')
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
    if (tab === 'vendedores') void loadSellers(selectedChamp?.id)
  }, [tab, selectedChamp?.id])

  function toggleAction(value: typeof openAction) {
    setOpenAction((current) => current === value ? '' : value)
  }

  function groupName(id?: string | null) {
    return rowTitle(champGroups.find((row) => row.id === id)) || 'Sem grupo'
  }

  function phaseName(id?: string | null) {
    return rowTitle(champPhases.find((row) => row.id === id)) || 'Sem fase'
  }

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

              {tab === 'vendedores' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Afiliados da produtora</p>
                      <h3>Vendedores</h3>
                    </div>
                    <button className="button" type="button" disabled={sellerLoading} onClick={() => void createSellerInvite()}>
                      <UserPlus size={16} /> Gerar link de convite
                    </button>
                  </div>

                  <div className="inline-action-panel">
                    <p className="empty">
                      Um convite serve para a <strong>produtora inteira</strong>. Depois de aceitar, o vendedor entra na lista.
                      Neste campeonato ({rowTitle(selectedChamp)}), clique no vendedor para liberar e definir o limite de vagas.
                      Ele pode adicionar equipes e gerar convites como o admin (dentro do limite).
                    </p>
                    {sellerError ? <div className="message error">{sellerError}</div> : null}
                    {sellerLink ? (
                      <div className="ref-section-stack">
                        <button className="token-card full-token-card" type="button" onClick={() => props.copyToken(sellerLink)}>
                          <span>Link de convite (produtora)</span>
                          <strong>{sellerLink}</strong>
                          <Copy size={15} />
                        </button>
                        {sellerWhatsappLink ? (
                          <a className="button secondary" href={sellerWhatsappLink} target="_blank" rel="noreferrer">
                            <MessageCircle size={15} /> Enviar pelo WhatsApp
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="seller-roster-grid">
                    {sellerRows.map((seller) => {
                      const manager = seller.managers || {}
                      const publicPanel = seller.manager_id
                        ? `${window.location.origin}/vendedores/${seller.manager_id}`
                        : ''
                      const onChamp = Boolean(seller.no_campeonato || seller.vinculo_atual)
                      const limite = Number(seller.vinculo_atual?.limite_vagas ?? seller.limite_vagas_atual ?? 0)
                      const usadas = Number(seller.vagas_usadas || 0)
                      const restam = seller.vagas_restantes
                      return (
                        <article
                          className={`seller-roster-card ${onChamp ? 'is-on-champ' : 'is-roster-only'} ${sellerSelected?.manager_id === seller.manager_id ? 'selected' : ''}`}
                          key={seller.manager_id || seller.id}
                        >
                          <div className="seller-roster-top">
                            <span className={`seller-status-pill ${onChamp ? 'on' : 'off'}`}>
                              {onChamp ? 'Neste evento' : 'Só produtora'}
                            </span>
                            {onChamp && limite > 0 ? (
                              <span className={`seller-usage-pill ${restam === 0 ? 'full' : ''}`}>
                                {usadas}/{limite} vagas
                              </span>
                            ) : onChamp ? (
                              <span className="seller-usage-pill open">Sem limite</span>
                            ) : null}
                          </div>
                          <strong>
                            {seller.nome_publico || manager.nome || manager.username || 'Vendedor'}
                          </strong>
                          <small className="seller-whatsapp-line">
                            {seller.whatsapp_url || 'WhatsApp ainda não definido'}
                          </small>
                          <small>
                            {(seller.campeonatos || []).filter((c: any) => c.status === 'ativo').length} evento(s)
                            liberado(s) na produtora
                          </small>
                          <div className="seller-roster-actions">
                            <button
                              type="button"
                              className="button small"
                              onClick={() => openSellerEditor(seller)}
                            >
                              {onChamp ? 'Editar liberação' : 'Liberar neste evento'}
                            </button>
                            {onChamp ? (
                              <button
                                type="button"
                                className="button small secondary"
                                disabled={sellerBusy}
                                onClick={() => void detachSellerFromChampionship(seller.manager_id)}
                              >
                                Remover do evento
                              </button>
                            ) : null}
                            {publicPanel ? (
                              <button type="button" className="button small secondary" onClick={() => props.copyToken(publicPanel)}>
                                <Copy size={14} /> Link vendas
                              </button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                    {sellerLoading ? <p className="empty">Carregando vendedores...</p> : null}
                    {!sellerLoading && sellerRows.length === 0 ? (
                      <p className="empty">Nenhum vendedor ainda. Gere o link de convite da produtora.</p>
                    ) : null}
                  </div>

                  {sellerSelected ? (
                    <div className="inline-action-panel seller-edit-panel" style={{ marginTop: 12 }}>
                      <h4 style={{ margin: '0 0 8px' }}>
                        {sellerSelected.nome_publico || 'Vendedor'} · {rowTitle(selectedChamp)}
                      </h4>
                      {sellerSelected.no_campeonato ? (
                        <p className="empty" style={{ marginBottom: 10 }}>
                          Uso atual:{' '}
                          <strong>
                            {Number(sellerSelected.vagas_usadas || 0)}
                            {Number(sellerSelected.limite_vagas_atual || 0) > 0
                              ? ` / ${sellerSelected.limite_vagas_atual}`
                              : ' (sem limite)'}
                          </strong>{' '}
                          vaga(s) preenchida(s) por este vendedor.
                        </p>
                      ) : null}
                      <div className="mini-grid two">
                        <Field label="Limite de vagas neste campeonato">
                          <input
                            type="number"
                            min="0"
                            value={sellerLimite}
                            onChange={(e) => setSellerLimite(e.target.value)}
                            placeholder="0 = sem limite"
                          />
                        </Field>
                      </div>
                      <div className="seller-perm-grid" style={{ marginTop: 12 }}>
                        <p className="empty" style={{ marginBottom: 8 }}>
                          Funções liberadas para este manager no evento (ele opera no painel de manager → Campeonatos).
                        </p>
                        {([
                          ['adicionar_equipes', 'Adicionar equipes/lines nas vagas'],
                          ['gerar_convites_equipe', 'Gerar convites de slot/grupo'],
                          ['remover_proprias_equipes', 'Remover equipes que ele adicionou'],
                          ['ver_estrutura', 'Ver fases, grupos e jogos'],
                          ['organizar_grupos', 'Organizar grupos (moderação avançada)'],
                          ['pontuar_tabela', 'Pontuar tabela / sumula'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="seller-perm-item">
                            <input
                              type="checkbox"
                              checked={Boolean(sellerPerms[key])}
                              onChange={(e) => setSellerPerms((current) => ({ ...current, [key]: e.target.checked }))}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button className="button" type="button" disabled={sellerBusy} onClick={() => void attachSellerToChampionship()}>
                          {sellerBusy ? 'Salvando...' : sellerSelected.no_campeonato ? 'Atualizar liberação' : 'Liberar neste campeonato'}
                        </button>
                        <button className="button secondary" type="button" onClick={() => setSellerSelected(null)}>
                          Fechar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'links' ? (
                <div className="ref-section-stack">
                  <div className="subtab-actionbar">
                    <div>
                      <p className="eyebrow">Links</p>
                      <h3>Inscrição pública</h3>
                    </div>
                    <button className="button" onClick={() => toggleAction('link')}>Gerar link</button>
                  </div>
                  {openAction === 'link' ? (
                    <div className="inline-action-panel">
                      <div className="mini-grid three">
                        <Field label="Tipo de link">
                          <select value={props.registrationLink.tipo} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, tipo: e.target.value })}>
                            <option value="jogadores">Inscrição de jogadores</option>
                            <option value="equipes">Entrada de equipes por grupo</option>
                          </select>
                        </Field>
                        <Field label="Grupo do link">
                          <select value={props.registrationLink.grupo_id} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, grupo_id: e.target.value })}>
                            <option value="">Selecione</option>
                            {champGroups.map((group) => <option key={group.id} value={group.id}>{rowTitle(group)}</option>)}
                          </select>
                        </Field>
                        <Field label="Encerrar link"><input type="datetime-local" value={props.registrationLink.encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, encerra_em: e.target.value })} /></Field>
                      </div>
                      {props.registrationLink.tipo === 'equipes' ? (
                        <Field label="Vagas esperadas do grupo">
                          <textarea value={props.registrationLink.nomes_equipes} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, nomes_equipes: e.target.value })} placeholder={'ALOE ELITE\nALOE BASE\nPAYSANDU\nREMO'} rows={6} />
                        </Field>
                      ) : (
                        <>
                          <div className="mini-grid three">
                            <Field label="Vagas por equipe"><input type="number" value={props.registrationLink.vagas_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, vagas_por_equipe: e.target.value })} /></Field>
                            <Field label="Permite substituição">
                              <select value={props.registrationLink.permite_substituicao ? 'sim' : 'nao'} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, permite_substituicao: e.target.value === 'sim' })}>
                                <option value="nao">Não</option>
                                <option value="sim">Sim</option>
                              </select>
                            </Field>
                            <Field label="Máximo de substituições"><input type="number" value={props.registrationLink.max_substituicoes_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, max_substituicoes_por_equipe: e.target.value })} /></Field>
                          </div>
                          <Field label="Prazo de substituição"><input type="datetime-local" value={props.registrationLink.substituicao_encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, substituicao_encerra_em: e.target.value })} /></Field>
                        </>
                      )}
                      <button className="button" type="button" disabled={Boolean(props.pendingCreate)} onClick={props.createRegistrationLink}>{props.pendingCreate === 'registration_link' ? <><Loader2 size={15} className="button-spinner" /> Gerando link...</> : props.registrationLink.tipo === 'equipes' ? 'Gerar link de equipes' : 'Gerar link público'}</button>
                    </div>
                  ) : null}
                  <div className="ref-card-grid two">
                    {champRegistrationLinks.map((link) => {
                      const isTeamGroupLink = link.data?.tipo === 'inscricao_equipes_grupo'
                      const path = isTeamGroupLink ? `/convite/grupo/${link.token}` : `/i/${link.token}`
                      const isPaused = link.data?.ativo === false
                      return (
                        <div key={link.id} className="token-card link-token-card">
                          <button type="button" onClick={() => props.copyToken(`${window.location.origin}${path}`)}>
                            <span>{isTeamGroupLink ? 'Equipes' : 'Jogadores'} · {groupName(link.data?.group_id)}{isPaused ? ' · Pausado' : ''}</span>
                            <strong>{path}</strong>
                            <Copy size={15} />
                          </button>
                          <div className="folder-actions link-card-actions">
                            <button type="button" title={isPaused ? 'Ativar link' : 'Pausar link'} onClick={() => props.updateStructure('registration_link', link.id, { ativo: isPaused })}>
                              {isPaused ? <Play size={15} /> : <Pause size={15} />}
                            </button>
                            <button type="button" title="Gerar novo token" onClick={() => { if (window.confirm('Gerar um novo token? O link atual deixará de funcionar.')) props.updateStructure('registration_link', link.id, { regenerate_token: true }) }}>
                              <RefreshCw size={15} />
                            </button>
                            <button type="button" title="Excluir link" className="danger" onClick={() => { if (window.confirm('Excluir este link?')) props.deleteStructure('registration_link', link.id) }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {champRegistrationLinks.length === 0 ? <p className="empty">Nenhum link gerado.</p> : null}
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


