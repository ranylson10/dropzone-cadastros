'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, Copy, ExternalLink, Link2, Pencil, Plus, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { SystemModal } from '@/components/layout/SystemModal'
import type { DropZoneRow } from '@/lib/types'
import { Field, UploadField } from '../../components/form-fields'
import { ProfileEditForm } from '@/components/forms/ProfileEditForm'
import { uploadPublicFile } from '@/lib/upload-public'
import { dataText, rowTitle } from '../../utils'

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
  const [tab, setTab] = useState<'campeonatos' | 'lines' | 'jogadores' | 'convites' | 'staff' | 'config'>('campeonatos')
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

  useEffect(() => { void loadLineups() }, [])

  useEffect(() => {
    if (props.managedTeams[0]?.id && !staffTeamId) setStaffTeamId(props.managedTeams[0].id)
  }, [props.managedTeams, staffTeamId])

  useEffect(() => {
    if (tab === 'staff' && staffTeamId) void loadStaff()
  }, [tab, staffTeamId])

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
        <div className="tabs panel-tabs team-panel-tabs">
          <button className={`tab ${tab === 'campeonatos' ? 'active' : ''}`} onClick={() => setTab('campeonatos')}>Campeonatos</button>
          <button className={`tab ${tab === 'lines' ? 'active' : ''}`} onClick={() => setTab('lines')}>Lines</button>
          <button className={`tab ${tab === 'jogadores' ? 'active' : ''}`} onClick={() => setTab('jogadores')}>Jogadores</button>
          <button className={`tab ${tab === 'convites' ? 'active' : ''}`} onClick={() => setTab('convites')}>Convites</button>
          <button className={`tab ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')}>Staff</button>
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
                <button className="team-championship-head" onClick={() => setExpanded(isOpen ? '' : lineup.campeonato_equipe_id)}>
                  <img src={lineup.line_logo_url || '/favicon.ico'} alt="" />
                  <div><strong>{lineup.campeonato_nome}</strong><span>{lineup.line_nome} · {lineup.fase_nome || 'Sem fase'} · {lineup.grupo_nome || 'Sem grupo'} · Slot {lineup.slot_equipe || '-'}</span></div>
                  <div className="team-championship-status"><b>{lineup.jogadores_confirmados}/{lineup.limite_jogadores}</b><span>escalação</span></div>
                  <ChevronDown className={isOpen ? 'rotated' : ''} />
                </button>
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
                      <button className="button secondary" onClick={() => openInviteEditor(lineup)}>Alterar</button>
                      <button className="button secondary danger" onClick={() => void removeLineupInvite(lineup)}><Trash2 size={15}/> Remover</button>
                    </> : <button className="button" onClick={() => void createLineupLink(lineup)} disabled={lineupLoading}><Link2 size={15}/> Criar link</button>}
                  </div>
                </div> : null}
              </article>
            })}
          </div>
        </div> : null}

        {tab === 'lines' ? (
          <EquipeLinesEditor
            teams={props.managedTeams}
            uploadPublicFile={props.uploadPublicFile}
          />
        ) : null}

        {tab === 'jogadores' ? <div className="panel-tab-body"><div className="team-section-title"><div><p className="eyebrow">Elenco</p><h3>Jogadores da equipe</h3></div><span className="count-pill"><Users size={14}/>{teamPlayers.length}</span></div>{teamPlayers.length === 0 ? <p className="empty">Nenhum jogador vinculado ao elenco.</p> : null}<div className="team-player-grid">{teamPlayers.map((row) => <article className="team-player-card" key={row.id}><img src={dataText(row, 'foto_url') || '/favicon.ico'} alt=""/><div><strong>{dataText(row, 'nick') || rowTitle(row)}</strong><span>ID {dataText(row, 'id_jogo') || '-'}</span><small>{dataText(row, 'funcao') || 'Função não informada'}</small></div></article>)}</div></div> : null}

        {tab === 'convites' ? <div className="panel-tab-body"><div className="panel-soft"><h3>Convidar jogador para a equipe</h3><p>Este convite adiciona o jogador ao elenco. Ele não inscreve o jogador em campeonato.</p><div className="token-list">{props.managedTeams.map((team) => <button key={team.id} className="token-card" onClick={() => void createRosterInvite(team)} disabled={lineupLoading}><span>{rowTitle(team)}</span><strong>Criar link de convite</strong><Link2 size={15}/></button>)}</div></div><div className="panel-soft"><h3>Links ativos de escalação</h3>{lineups.filter((lineup) => lineup.link_token).length === 0 ? <p className="empty">Nenhum link gerado.</p> : null}<div className="token-list">{lineups.filter((lineup) => lineup.link_token).map((lineup) => <button key={lineup.campeonato_equipe_id} className={`token-card ${copiedLineupId === lineup.campeonato_equipe_id ? 'copied' : ''}`} onClick={() => void copyLink(shareText(lineup), lineup.campeonato_equipe_id)}><span>{lineup.campeonato_nome} · {lineup.line_nome}</span><strong>{copiedLineupId === lineup.campeonato_equipe_id ? 'Link copiado' : 'Copiar convite'}</strong><Copy size={15}/></button>)}</div></div></div> : null}

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
        {rosterInvite ? <div className="lineup-invite-result"><strong>{rosterInvite.teamName}</strong><pre className="lineup-invite-preview">{rosterInvite.texto}</pre><div className="button-row"><button className="button" onClick={() => void copyLink(rosterInvite.texto, 'roster')}><Copy size={15}/> {copiedLineupId === 'roster' ? 'Link copiado' : 'Copiar convite'}</button><button className="button secondary" onClick={() => setRosterInvite(null)}>Fechar</button></div></div> : null}
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
            <span>Link de escalação</span>
            <strong>{generatedInvite.link}</strong>
          </div>
          <pre className="lineup-invite-preview">{generatedInvite.texto}</pre>
          <div className="button-row">
            <button className="button" type="button" onClick={() => void copyLink(generatedInvite.texto, 'modal')}><Copy size={15}/> {copiedLineupId === 'modal' ? 'Link copiado' : 'Copiar convite'}</button>
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

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
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
      const res = await fetch(`/api/equipes/${teamId}/lines`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? { line_id: editingId, nome: nome.trim(), tag: tag.trim() || null, logo_url: logoUrl.trim() || null }
            : { nome: nome.trim(), tag: tag.trim() || null, logo_url: logoUrl.trim() || teamLogo || null },
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
        {lines.map((line, index) => (
          <article key={line.id} className="championship-vaga-row status-ocupada">
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
              </span>
              <span className="vaga-row-meta">
                <button type="button" className="button small secondary" onClick={() => startEdit(line)}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="button small secondary" disabled={busy} onClick={() => void remove(line.id)}>
                  <Trash2 size={14} />
                </button>
              </span>
              <span className="vaga-row-chevron" aria-hidden />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
