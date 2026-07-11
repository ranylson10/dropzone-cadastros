'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, Copy, ExternalLink, Link2, Shield, Trash2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { SystemModal } from '@/components/layout/SystemModal'
import type { DropZoneRow } from '@/lib/types'
import { Field } from '../../components/form-fields'
import { dataText, rowTitle, tokenText } from '../../utils'

const PLAYER_INVITE_TYPES = new Set(['convite_jogador_campeonato', 'convite_jogador_equipe', 'player_invite'])

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
  teamPanelToken: string
  setTeamPanelToken: (value: string) => void
  acceptTeamInvite: () => void
  teamPlayerChampId: string
  setTeamPlayerChampId: (value: string) => void
  teamPlayerTeamId: string
  setTeamPlayerTeamId: (value: string) => void
  generatePlayerInvite: () => void
  copyToken: (value: string | null) => void
  loading: boolean
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [tab, setTab] = useState<'campeonatos' | 'lines' | 'jogadores' | 'convites' | 'config'>('campeonatos')
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [expanded, setExpanded] = useState<string>('')
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupError, setLineupError] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; link: string; texto: string } | null>(null)
  const [editingInvite, setEditingInvite] = useState<Lineup | null>(null)
  const [inviteLimit, setInviteLimit] = useState('')
  const [inviteExpiresAt, setInviteExpiresAt] = useState('')

  const playerInvites = props.tokens.filter((row) => PLAYER_INVITE_TYPES.has(String(row.data?.token_kind || '')) && row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id))
  const teamLines = useMemo(() => props.teamLines.filter((line) => line.ref_id && props.managedTeams.some((team) => team.id === line.ref_id)), [props.teamLines, props.managedTeams])
  const teamPlayers = useMemo(() => props.playerTeams.filter((row) => row.ref_id && props.managedTeams.some((team) => team.id === row.ref_id)), [props.playerTeams, props.managedTeams])

  useEffect(() => { void loadLineups() }, [])

  async function authToken() {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.')
    return data.session.access_token
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
    setInviteExpiresAt(lineup.link_expira_em ? new Date(lineup.link_expira_em).toISOString().slice(0, 16) : '')
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

  async function copyLink(value: string) {
    await navigator.clipboard.writeText(value)
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
                      <button className="button" onClick={() => void copyLink(shareText(lineup))}><Copy size={15}/> Copiar token</button>
                      <button className="button secondary" onClick={() => openInviteEditor(lineup)}>Alterar</button>
                      <button className="button secondary danger" onClick={() => void removeLineupInvite(lineup)}><Trash2 size={15}/> Remover</button>
                    </> : <button className="button" onClick={() => void createLineupLink(lineup)} disabled={lineupLoading}><Link2 size={15}/> Criar token</button>}
                  </div>
                </div> : null}
              </article>
            })}
          </div>
          <div className="panel-soft compact-panel"><h3>Entrar em novo campeonato</h3><div className="inline-invite-form"><Field label="Token enviado pela produtora"><input value={props.teamPanelToken} onChange={(e) => props.setTeamPanelToken(e.target.value.toUpperCase())} placeholder="EQ-..." /></Field><button className="button" onClick={props.acceptTeamInvite}>Aceitar convite</button></div></div>
        </div> : null}

        {tab === 'lines' ? <div className="panel-tab-body"><div className="team-section-title"><div><p className="eyebrow">Estrutura</p><h3>Lines da equipe</h3></div></div>{teamLines.length === 0 ? <p className="empty">Nenhuma line cadastrada.</p> : null}<div className="team-line-grid">{teamLines.map((line) => <article className="team-line-card" key={line.id}><img src={dataText(line, 'logo_url') || '/favicon.ico'} alt=""/><div><strong>{rowTitle(line)}</strong><span>{dataText(line, 'tag') || 'Sem tag'}</span><small>{lineups.filter((item) => item.line_id === line.id).length} campeonato(s)</small></div></article>)}</div></div> : null}

        {tab === 'jogadores' ? <div className="panel-tab-body"><div className="team-section-title"><div><p className="eyebrow">Elenco</p><h3>Jogadores da equipe</h3></div><span className="count-pill"><Users size={14}/>{teamPlayers.length}</span></div>{teamPlayers.length === 0 ? <p className="empty">Nenhum jogador vinculado ao elenco.</p> : null}<div className="team-player-grid">{teamPlayers.map((row) => <article className="team-player-card" key={row.id}><img src={dataText(row, 'foto_url') || '/favicon.ico'} alt=""/><div><strong>{dataText(row, 'nick') || rowTitle(row)}</strong><span>ID {dataText(row, 'id_jogo') || '-'}</span><small>{dataText(row, 'funcao') || 'Função não informada'}</small></div></article>)}</div></div> : null}

        {tab === 'convites' ? <div className="panel-tab-body"><div className="panel-soft"><h3>Links ativos de escalação</h3>{lineups.filter((lineup) => lineup.link_token).length === 0 ? <p className="empty">Nenhum link gerado.</p> : null}<div className="token-list">{lineups.filter((lineup) => lineup.link_token).map((lineup) => <button key={lineup.campeonato_equipe_id} className="token-card" onClick={() => void copyLink(shareText(lineup))}><span>{lineup.campeonato_nome} · {lineup.line_nome}</span><strong>{tokenText(lineup.link_token || '')}</strong><Copy size={15}/></button>)}</div></div><div className="panel-soft"><h3>Tokens antigos para jogador</h3>{playerInvites.length === 0 ? <p className="empty">Nenhum token antigo ativo.</p> : null}<div className="token-list">{playerInvites.map((token) => <button key={token.id} className="token-card" onClick={() => props.copyToken(token.token)}><span>{dataText(token, 'championship_name')}</span><strong>{tokenText(token.token)}</strong><Copy size={15}/></button>)}</div></div></div> : null}

        {tab === 'config' ? <div className="panel-tab-body"><div className="panel-soft"><h3>Dados da equipe</h3>{props.managedTeams.map((team) => <div className="compact-row" key={team.id}><strong>{rowTitle(team)}</strong><span>{dataText(team, 'tag') || 'sem tag'}</span></div>)}</div></div> : null}
      </section>

      <SystemModal
        open={Boolean(generatedInvite)}
        title="Token da escalação criado"
        description="Ao copiar o token, a mensagem informativa e o link são copiados juntos."
        size="medium"
        onClose={() => setGeneratedInvite(null)}
      >
        {generatedInvite ? <div className="lineup-invite-result">
          <div className="lineup-invite-token">
            <span>Token da escalação</span>
            <strong>{generatedInvite.token}</strong>
          </div>
          <pre className="lineup-invite-preview">{generatedInvite.texto}</pre>
          <div className="button-row">
            <button className="button" type="button" onClick={() => void copyLink(generatedInvite.texto)}><Copy size={15}/> Copiar token</button>
            <button className="button secondary" type="button" onClick={() => setGeneratedInvite(null)}>Fechar</button>
          </div>
        </div> : null}
      </SystemModal>

      <SystemModal
        open={Boolean(editingInvite)}
        title="Alterar token da escalação"
        description="Ajuste o limite de jogadores e a validade sem trocar o link atual."
        size="medium"
        onClose={() => setEditingInvite(null)}
      >
        <div className="form-grid">
          <Field label="Limite de jogadores">
            <input type="number" min="1" value={inviteLimit} onChange={(event) => setInviteLimit(event.target.value)} />
          </Field>
          <Field label="Validade do token">
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
