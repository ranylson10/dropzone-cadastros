'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, ExternalLink, Plus, RefreshCw, Shield, Swords, UserPlus, Users } from 'lucide-react'
import { LineRosterManager } from '@/components/equipes/LineRosterManager'

type TeamItem = {
  id: string
  nome: string
  username?: string | null
  logo_url?: string | null
  tag?: string | null
  papel: 'dono' | 'staff'
  permissoes: { pode_ver: boolean; pode_editar: boolean; pode_escalar: boolean; pode_gerar_token: boolean }
}

type TeamDetail = {
  team: TeamItem & { status?: string | null }
  overview: {
    lines: any[]
    players: any[]
    staff: any[]
    managerInvites: any[]
    playerInvites: any[]
    activeRegistrations: any[]
    issues: Array<{ level: 'attention' | 'info'; title: string; detail: string }>
  }
}

type Section = 'overview' | 'players' | 'lines' | 'staff' | 'championships'

export function LiliTeamHub({ accessToken }: { accessToken?: string | null }) {
  const [items, setItems] = useState<TeamItem[]>([])
  const [selected, setSelected] = useState<TeamItem | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [creatingLine, setCreatingLine] = useState(false)
  const [lineName, setLineName] = useState('')
  const [selectedLine, setSelectedLine] = useState<any | null>(null)

  async function request(url: string, options?: RequestInit) {
    if (!accessToken) throw new Error('Entre na sua conta para ver suas equipes.')
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a ação.')
    return payload
  }

  async function loadTeams() {
    setLoading(true); setError('')
    try { const payload = await request('/api/lili/equipes'); setItems(payload.items || []) }
    catch (err: any) { setError(err?.message || 'Não foi possível carregar suas equipes.') }
    finally { setLoading(false) }
  }

  async function openTeam(team: TeamItem) {
    setSelected(team); setDetail(null); setSection('overview'); setSelectedLine(null); setLoading(true); setError(''); setFeedback('')
    try { setDetail(await request(`/api/lili/equipes?id=${encodeURIComponent(team.id)}`)) }
    catch (err: any) { setError(err?.message || 'Não foi possível carregar a equipe.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadTeams() }, [accessToken])

  const counts = useMemo(() => ({
    players: detail?.overview.players.length || 0,
    lines: detail?.overview.lines.length || 0,
    staff: detail?.overview.staff.length || 0,
    championships: detail?.overview.activeRegistrations.length || 0,
  }), [detail])

  async function createLine() {
    if (!selected || !lineName.trim()) return
    setFeedback('')
    try {
      await request(`/api/equipes/${selected.id}/lines`, { method: 'POST', body: JSON.stringify({ nome: lineName.trim() }) })
      setLineName(''); setCreatingLine(false); setFeedback('Line criada com sucesso.'); await openTeam(selected); setSection('lines')
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível criar a line.') }
  }

  async function createRosterInvite() {
    if (!selected) return
    setFeedback('')
    try {
      const payload = await request('/api/equipes/convites-elenco', { method: 'POST', body: JSON.stringify({ equipe_id: selected.id }) })
      await navigator.clipboard.writeText(payload.url || payload.texto || '')
      setFeedback('Link para convidar jogador copiado.')
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível gerar o convite.') }
  }

  if (!accessToken) return <div className="lili-team-empty"><Users size={34}/><strong>Entre para acessar suas equipes</strong><span>A Lili mostrará apenas equipes que você controla.</span></div>
  if (!selected) return (
    <div className="lili-team-hub">
      <div className="lili-team-toolbar"><div><strong>Minhas equipes</strong><span>Controle rápido e compacto pelo celular.</span></div><button onClick={() => void loadTeams()} aria-label="Atualizar"><RefreshCw size={16}/></button></div>
      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {loading ? <div className="lili-team-loading"><RefreshCw className="spin" size={18}/> Carregando...</div> : null}
      {!loading && !items.length ? <div className="lili-team-empty"><Shield size={34}/><strong>Nenhuma equipe disponível</strong><span>Crie uma equipe ou aceite um convite de staff.</span><a href="/equipes">Abrir equipes</a></div> : null}
      <div className="lili-team-list">{items.map((team) => <button key={team.id} onClick={() => void openTeam(team)}><span className="lili-team-logo">{team.logo_url ? <img src={team.logo_url} alt=""/> : (team.tag || team.nome).slice(0,2).toUpperCase()}</span><span className="lili-team-copy"><strong>{team.nome}</strong><small>{team.tag || `@${team.username || 'equipe'}`}</small><em>{team.papel === 'dono' ? 'Dono' : 'Staff'}</em></span><ChevronRight size={18}/></button>)}</div>
    </div>
  )

  const team = detail?.team || selected
  return (
    <div className="lili-team-hub detail">
      <div className="lili-team-detail-head"><button onClick={() => { setSelected(null); setDetail(null) }}><ArrowLeft size={17}/></button><span className="lili-team-logo large">{team.logo_url ? <img src={team.logo_url} alt=""/> : (team.tag || team.nome).slice(0,2).toUpperCase()}</span><div><strong>{team.nome}</strong><span>{team.tag || `@${team.username || 'equipe'}`} · {team.papel === 'dono' ? 'Dono' : 'Staff'}</span></div><a href={`/equipes/${team.id}`}><ExternalLink size={16}/></a></div>

      <nav className="lili-team-sections">
        <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}><Shield size={16}/><span>Resumo</span></button>
        <button className={section === 'players' ? 'active' : ''} onClick={() => setSection('players')}><Users size={16}/><span>Elenco</span></button>
        <button className={section === 'lines' ? 'active' : ''} onClick={() => { setSection('lines'); setSelectedLine(null) }}><Swords size={16}/><span>Lines</span></button>
        <button className={section === 'staff' ? 'active' : ''} onClick={() => setSection('staff')}><Shield size={16}/><span>Staff</span></button>
        <button className={section === 'championships' ? 'active' : ''} onClick={() => setSection('championships')}><Swords size={16}/><span>Eventos</span></button>
      </nav>

      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {feedback ? <div className="lili-team-feedback">{feedback}</div> : null}
      {loading || !detail ? <div className="lili-team-loading"><RefreshCw className="spin" size={18}/> Carregando equipe...</div> : null}

      {detail && section === 'overview' ? <div className="lili-team-section">
        <div className="lili-team-metrics"><div><span>Jogadores</span><strong>{counts.players}</strong></div><div><span>Lines</span><strong>{counts.lines}</strong></div><div><span>Staff</span><strong>{counts.staff}</strong></div><div><span>Eventos</span><strong>{counts.championships}</strong></div></div>
        <div className="lili-team-issues">{detail.overview.issues.map((issue, index) => <article key={`${issue.title}-${index}`} className={issue.level}><strong>{issue.title}</strong><span>{issue.detail}</span></article>)}</div>
        <div className="lili-team-quick-actions">{team.permissoes?.pode_editar ? <button onClick={() => { setSection('lines'); setCreatingLine(true) }}><Plus size={16}/> Nova line</button> : null}{team.papel === 'dono' ? <button onClick={() => void createRosterInvite()}><UserPlus size={16}/> Convidar jogador</button> : null}</div>
      </div> : null}

      {detail && section === 'players' ? <div className="lili-team-section">
        <div className="lili-team-section-title"><div><strong>Elenco</strong><span>{counts.players} jogador(es)</span></div>{team.papel === 'dono' ? <button onClick={() => void createRosterInvite()}><UserPlus size={15}/> Convidar</button> : null}</div>
        <div className="lili-team-rows">{detail.overview.players.map((player: any) => <article key={player.id}><span className="lili-team-avatar">{player.foto_url ? <img src={player.foto_url} alt=""/> : String(player.nick || 'J').slice(0,1)}</span><div><strong>{player.nick || 'Jogador'}</strong><small>{player.funcao || 'Função não informada'} · ID {player.id_jogo || 'pendente'}</small></div></article>)}</div>
        {!counts.players ? <div className="lili-team-empty compact"><Users size={26}/><strong>Elenco vazio</strong><span>Gere um convite para adicionar jogadores.</span></div> : null}
      </div> : null}

      {detail && section === 'lines' ? selectedLine ? <LineRosterManager accessToken={accessToken || ''} equipeId={team.id} line={selectedLine} compact onBack={() => setSelectedLine(null)} onChanged={() => void openTeam(selected)} /> : <div className="lili-team-section">
        <div className="lili-team-section-title"><div><strong>Lines</strong><span>{counts.lines} time(s) da equipe</span></div>{team.permissoes?.pode_editar ? <button onClick={() => setCreatingLine((v) => !v)}><Plus size={15}/> Nova</button> : null}</div>
        {creatingLine ? <div className="lili-team-inline-form"><input value={lineName} onChange={(e) => setLineName(e.target.value)} placeholder="Nome da line"/><button onClick={() => void createLine()}>Criar</button></div> : null}
        <div className="lili-team-rows clickable">{detail.overview.lines.map((line: any) => <button type="button" key={line.id} onClick={() => setSelectedLine(line)}><span className="lili-team-avatar">{line.logo_url ? <img src={line.logo_url} alt=""/> : String(line.tag || line.nome || 'L').slice(0,2)}</span><div><strong>{line.nome}</strong><small>{line.tag || 'Sem tag'} · toque para abrir jogadores e formações</small></div><ChevronRight size={17}/></button>)}</div>
      </div> : null}

      {detail && section === 'staff' ? <div className="lili-team-section"><div className="lili-team-section-title"><div><strong>Staff</strong><span>{counts.staff} membro(s)</span></div></div><div className="lili-team-rows">{detail.overview.staff.map((row: any) => <article key={row.id}><span className="lili-team-avatar">{row.manager?.avatar_url ? <img src={row.manager.avatar_url} alt=""/> : 'M'}</span><div><strong>{row.manager?.nome || row.manager?.username || 'Manager'}</strong><small>{row.pode_editar ? 'Pode editar' : 'Visualização'} · {row.pode_escalar ? 'Pode escalar' : 'Sem escalação'}</small></div></article>)}</div>{!counts.staff ? <div className="lili-team-empty compact"><Shield size={26}/><strong>Sem staff adicional</strong><span>O dono continua com controle total.</span></div> : null}</div> : null}

      {detail && section === 'championships' ? <div className="lili-team-section"><div className="lili-team-section-title"><div><strong>Campeonatos</strong><span>{counts.championships} participação(ões) ativa(s)</span></div></div><div className="lili-team-rows championships">{detail.overview.activeRegistrations.map((row: any) => <article key={row.id}><span className="lili-team-avatar">{row.campeonato?.logo_url ? <img src={row.campeonato.logo_url} alt=""/> : 'C'}</span><div><strong>{row.campeonato?.nome || row.nome_exibicao || 'Campeonato'}</strong><small>{row.line?.nome || 'Sem line'} · Slot {row.slot_numero || '-'}</small></div></article>)}</div>{!counts.championships ? <div className="lili-team-empty compact"><Swords size={26}/><strong>Sem campeonatos ativos</strong><span>As inscrições da equipe aparecerão aqui.</span></div> : null}</div> : null}
    </div>
  )
}
