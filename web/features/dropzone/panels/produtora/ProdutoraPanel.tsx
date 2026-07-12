'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Folder, FolderOpen, Loader2, MessageCircle, Pencil, Plus, Trash2, Trophy, Users } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
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
  registrationLink: { grupo_id: string; vagas_por_equipe: string; abre_em: string; encerra_em: string; permite_substituicao: boolean; max_substituicoes_por_equipe: string; substituicao_encerra_em: string; descricao: string }
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
  slotAssignment: { slot_id: string; grupo_id: string; equipe_id: string; line_id: string; campeonato_equipe_id: string; slot_numero: string }
  setSlotAssignment: (value: any) => void
  game: { nome: string; campeonato_id: string; fase_id: string; data_jogo: string; horario: string; numero_partidas: string; mapas: string[]; grupos_ids: string[] }
  setGame: (value: any) => void
  createChampionship: () => Promise<boolean>
  updateChampionship: (id: string, data: CampeonatoFormValue) => Promise<DropZoneRow | undefined>
  deleteChampionship: (id: string) => Promise<void>
  updateStructure: (entityType: 'phase' | 'group' | 'group_slot', id: string, data: Record<string, unknown>) => Promise<void>
  deleteStructure: (entityType: 'phase' | 'group', id: string) => Promise<void>
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
  const [slotModal, setSlotModal] = useState<{ id: string; grupo_id: string; slot_numero: string; letra: string; whatsapp_url: string } | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<{ id: string; nome: string; ordem: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; nome: string; slots: string; whatsapp_url: string } | null>(null)
  const [mapCatalog, setMapCatalog] = useState<Array<{ codigo: string; nome: string; imagem_url: string | null; mapa_misterioso: boolean }>>([])
  const [mapsLoading, setMapsLoading] = useState(false)
  const [editingGameId, setEditingGameId] = useState('')
  const [openGamePhases, setOpenGamePhases] = useState<Record<string, boolean>>({})
  const [openGames, setOpenGames] = useState<Record<string, boolean>>({})

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

  function toggleAction(value: typeof openAction) {
    setOpenAction((current) => current === value ? '' : value)
  }

  function groupName(id?: string | null) {
    return rowTitle(champGroups.find((row) => row.id === id)) || 'Sem grupo'
  }

  function phaseName(id?: string | null) {
    return rowTitle(champPhases.find((row) => row.id === id)) || 'Sem fase'
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
                  <small>{dataText(champ, 'premiacao') || 'Premiação não informada'}</small>
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
        description="Cadastre os dados básicos, informações e controles do campeonato."
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
            <Field label="Line inscrita no campeonato">
              <select value={props.slotAssignment.campeonato_equipe_id} onChange={(e) => {
                const entry = props.selectedChampTeams.find((item) => item.data?.campeonato_equipe_id === e.target.value)
                props.setSlotAssignment({
                  ...props.slotAssignment,
                  slot_id: slotModal.id,
                  grupo_id: slotModal.grupo_id,
                  slot_numero: slotModal.slot_numero,
                  campeonato_equipe_id: String(entry?.data?.campeonato_equipe_id || ''),
                  equipe_id: String(entry?.ref_id || ''),
                  line_id: String(entry?.data?.line_id || ''),
                })
              }}>
                <option value="">Selecione uma line</option>
                {props.selectedChampTeams.map((entry) => (
                  <option key={entry.id} value={String(entry.data?.campeonato_equipe_id || '')}>{rowTitle(entry)} · {dataText(entry, 'team_name')}</option>
                ))}
              </select>
            </Field>
            {props.selectedChampTeams.length === 0 ? <p className="empty"><Users size={18}/> Nenhuma line inscrita no campeonato.</p> : null}
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setSlotModal(null)}>Cancelar</button>
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
                <p>{CHAMPIONSHIP_TYPE_LABELS[selectedChampType as keyof typeof CHAMPIONSHIP_TYPE_LABELS] || 'Copa'} · {dataText(selectedChamp, 'premiacao') ? `Premiação: ${dataText(selectedChamp, 'premiacao')}` : 'Premiação não informada'}</p>
                {dataText(selectedChamp, 'regras_url') ? <small>Regulamento: {dataText(selectedChamp, 'regras_url')}</small> : null}
              </div>
              <div className="championship-admin-actions">
                <button className="icon-action-button" onClick={() => startEditChampionship(selectedChamp)} title="Editar campeonato"><Pencil size={16} /> Editar</button>
                <button className="icon-action-button danger" onClick={() => {
                  if (window.confirm(`Excluir o campeonato ${rowTitle(selectedChamp)}? Ele ficará oculto, mas os dados serão preservados.`)) props.deleteChampionship(selectedChamp.id)
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
                              <button className="button" type="button" onClick={async () => { await props.updateStructure('phase', phase.id, { nome: editingPhase.nome.trim(), ordem: Number(editingPhase.ordem || 1) }); setEditingPhase(null) }}>Salvar alterações</button>
                              <button className="button secondary" type="button" onClick={() => setEditingPhase(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : null}{openAction === 'group' && props.group.fase_id === phase.id ? (
                          <div className="inline-action-panel phase-inline-group-form mini-grid three">
                            <Field label={isDailyChamp ? 'Horário' : 'Letra do grupo'}>
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
                                <Field label={isDailyChamp ? 'Horário' : 'Nome do grupo'}><input value={editingGroup.nome} onChange={(event) => setEditingGroup({ ...editingGroup, nome: event.target.value })} /></Field>
                                <Field label="Número de slots"><input type="number" min="1" max="52" value={editingGroup.slots} onChange={(event) => setEditingGroup({ ...editingGroup, slots: event.target.value })} /></Field>
                                <Field label="Link do WhatsApp"><input value={editingGroup.whatsapp_url} onChange={(event) => setEditingGroup({ ...editingGroup, whatsapp_url: event.target.value })} placeholder="https://chat.whatsapp.com/..." /></Field>
                                <div className="button-row structure-edit-actions">
                                  <button className="button" type="button" onClick={async () => { await props.updateStructure('group', group.id, { nome: editingGroup.nome.trim(), slots: Number(editingGroup.slots || 1), whatsapp_url: editingGroup.whatsapp_url.trim() }); setEditingGroup(null) }}>Salvar alterações</button>
                                  <button className="button secondary" type="button" onClick={() => setEditingGroup(null)}>Cancelar</button>
                                </div>
                              </div>
                            ) : null}<div className="slot-letter-list">{Array.from({length: slotCount}).map((_, index) => {
                              const slotNumber=index+1; const slot=slotsOfGroup.find((item)=>Number(item.data?.slot_numero)===slotNumber); const entry=props.selectedChampTeams.find((item)=>item.ref_id===slot?.data?.equipe_id && (!slot?.data?.line_id || item.data?.line_id===slot.data.line_id)); const letter=String(slot?.data?.slot_letra || String.fromCharCode(65 + (index % 26)) + (index >= 26 ? Math.floor(index/26) : ''))
                              return <div className={`slot-letter-row ${entry ? 'occupied' : ''}`} key={slot?.id || slotNumber} role="button" tabIndex={0} onClick={() => slot?.id && setSlotModal({ id: slot.id, grupo_id: group.id, slot_numero: String(slotNumber), letra: letter, whatsapp_url: String(group.data?.whatsapp_url || '') })} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && slot?.id) setSlotModal({ id: slot.id, grupo_id: group.id, slot_numero: String(slotNumber), letra: letter, whatsapp_url: String(group.data?.whatsapp_url || '') }) }}><b>{letter}</b><span>{entry ? rowTitle(entry) : 'Disponível'}</span><small>{entry ? dataText(entry,'team_name') : 'Clique para adicionar uma line'}</small><button title="Editar letra" onClick={(event) => { event.stopPropagation(); if(!slot?.id) return; const slot_letra=window.prompt('Letra do slot', letter); if(slot_letra) props.updateStructure('group_slot', slot.id, { slot_letra }) }}><Pencil size={14}/></button></div>
                            })}</div></> : null}
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
                          <h4>{editingGameId ? 'Atualize as informações do jogo' : 'Cadastre um jogo na fase selecionada'}</h4>
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
                        <Field label="Número de quedas"><input type="number" min="1" max="20" value={props.game.numero_partidas} onChange={(e) => { const total = Math.max(1, Number(e.target.value || 1)); props.setGame({ ...props.game, numero_partidas: e.target.value, mapas: Array.from({ length: total }, (_, index) => props.game.mapas[index] || ''), campeonato_id: selectedChamp.id }) }} /></Field>
                      </div>
                      <div className="mini-grid two">
                        <Field label="Data"><input type="date" value={props.game.data_jogo} onChange={(e) => props.setGame({ ...props.game, data_jogo: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
                        <Field label="Horário"><input type="time" value={props.game.horario} onChange={(e) => props.setGame({ ...props.game, horario: e.target.value, campeonato_id: selectedChamp.id })} /></Field>
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
                          {props.pendingCreate === 'game' || props.pendingCreate === 'game_update' ? <><Loader2 size={15} className="button-spinner" /> {editingGameId ? 'Salvando jogo...' : 'Criando jogo...'}</> : editingGameId ? 'Salvar alterações' : 'Criar jogo'}
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
                                        <span><strong>{rowTitle(gameRow)}</strong><small>{dataText(gameRow, 'data_jogo') || 'Sem data'} · {total} queda(s)</small></span>
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
                                        <div><span>Data e horário</span><strong>{dataText(gameRow, 'data_jogo') || 'Não definida'}{gameRow.data?.horario ? ` · ${String(gameRow.data.horario).slice(0, 5)}` : ''}</strong></div>
                                        <div><span>Quedas</span><strong>{total}</strong></div>
                                        <div><span>Grupos</span><strong>{groupIds.map((id) => groupName(id)).join(', ') || 'Nenhum grupo'}</strong></div>
                                        <div className="wide"><span>Mapas</span><strong>{mapNames.join(' · ') || 'Não definidos'}</strong></div>
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
                        <Field label="Grupo do link">
                          <select value={props.registrationLink.grupo_id} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, grupo_id: e.target.value })}>
                            <option value="">Selecione</option>
                            {champGroups.map((group) => <option key={group.id} value={group.id}>{rowTitle(group)}</option>)}
                          </select>
                        </Field>
                        <Field label="Vagas por equipe"><input type="number" value={props.registrationLink.vagas_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, vagas_por_equipe: e.target.value })} /></Field>
                        <Field label="Encerrar escalação"><input type="datetime-local" value={props.registrationLink.encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, encerra_em: e.target.value })} /></Field>
                      </div>
                      <div className="mini-grid three">
                        <Field label="Permite substituição">
                          <select value={props.registrationLink.permite_substituicao ? 'sim' : 'nao'} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, permite_substituicao: e.target.value === 'sim' })}>
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                        </Field>
                        <Field label="Máximo de substituições"><input type="number" value={props.registrationLink.max_substituicoes_por_equipe} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, max_substituicoes_por_equipe: e.target.value })} /></Field>
                        <Field label="Prazo de substituição"><input type="datetime-local" value={props.registrationLink.substituicao_encerra_em} onChange={(e) => props.setRegistrationLink({ ...props.registrationLink, substituicao_encerra_em: e.target.value })} /></Field>
                      </div>
                      <button className="button" type="button" disabled={Boolean(props.pendingCreate)} onClick={props.createRegistrationLink}>{props.pendingCreate === 'registration_link' ? <><Loader2 size={15} className="button-spinner" /> Gerando link...</> : 'Gerar link público'}</button>
                    </div>
                  ) : null}
                  <div className="ref-card-grid two">
                    {champRegistrationLinks.map((link) => (
                      <button key={link.id} className="token-card" onClick={() => props.copyToken(`${window.location.origin}/i/${link.token}`)}>
                        <span>{groupName(link.data?.group_id)}</span>
                        <strong>{`/i/${link.token}`}</strong>
                        <Copy size={15} />
                      </button>
                    ))}
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
