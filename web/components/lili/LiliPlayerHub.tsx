'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, ChevronRight, ExternalLink, Gamepad2, RefreshCw, Shield, Swords, Trophy, Users } from 'lucide-react'

type PlayerItem = {
  id: string
  nick: string
  username?: string | null
  avatar_url?: string | null
  id_jogo?: string | null
  funcao?: string | null
  localidade?: string | null
  status?: string | null
}

type PlayerDetail = {
  player: PlayerItem & { bio?: string | null; banner_url?: string | null }
  overview: { teams: any[]; lines: any[]; formations: any[]; activeChampionships: any[] }
}

type Section = 'overview' | 'teams' | 'lines' | 'championships' | 'profile'

export function LiliPlayerHub({ accessToken }: { accessToken?: string | null }) {
  const [items, setItems] = useState<PlayerItem[]>([])
  const [selected, setSelected] = useState<PlayerItem | null>(null)
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function request(url: string) {
    if (!accessToken) throw new Error('Entre na sua conta para abrir seus players.')
    const response = await fetch(url, { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a consulta.')
    return payload
  }

  async function loadPlayers() {
    setLoading(true); setError('')
    try {
      const payload = await request('/api/lili/jogadores')
      const nextItems = payload.items || []
      setItems(nextItems)
      if (nextItems.length === 1) await openPlayer(nextItems[0])
    } catch (err: any) { setError(err?.message || 'Não foi possível carregar seus players.') }
    finally { setLoading(false) }
  }

  async function openPlayer(player: PlayerItem) {
    setSelected(player); setDetail(null); setSection('overview'); setLoading(true); setError('')
    try { setDetail(await request(`/api/lili/jogadores?id=${encodeURIComponent(player.id)}`)) }
    catch (err: any) { setError(err?.message || 'Não foi possível carregar o player.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadPlayers() }, [accessToken])

  const counts = useMemo(() => ({
    teams: detail?.overview.teams.length || 0,
    lines: detail?.overview.lines.length || 0,
    championships: detail?.overview.activeChampionships.length || 0,
    formations: detail?.overview.formations.length || 0,
  }), [detail])

  if (!accessToken) return <div className="lili-player-empty"><Gamepad2 size={34}/><strong>Entre para acessar seus players</strong><span>Perfis, equipes, lines e campeonatos aparecerão aqui.</span></div>

  if (!selected) return (
    <div className="lili-player-hub">
      <div className="lili-player-toolbar"><div><strong>Meus players</strong><span>Visão rápida da sua carreira no DropZone.</span></div><button onClick={() => void loadPlayers()} aria-label="Atualizar"><RefreshCw size={16}/></button></div>
      {error ? <div className="lili-player-feedback error">{error}</div> : null}
      {loading ? <div className="lili-player-loading"><RefreshCw className="spin" size={18}/> Carregando...</div> : null}
      {!loading && !items.length ? <div className="lili-player-empty"><Gamepad2 size={34}/><strong>Nenhum perfil de jogador</strong><span>Crie seu player para participar de equipes, lines e campeonatos.</span><a href="/jogadores">Abrir jogadores</a></div> : null}
      <div className="lili-player-list">{items.map((player) => <button key={player.id} onClick={() => void openPlayer(player)}><span className="lili-player-avatar">{player.avatar_url ? <img src={player.avatar_url} alt=""/> : player.nick.slice(0,2).toUpperCase()}</span><span><strong>{player.nick}</strong><small>{player.funcao || 'Função não informada'} · ID {player.id_jogo || 'pendente'}</small><em>{player.localidade || 'Localidade não informada'}</em></span><ChevronRight size={18}/></button>)}</div>
    </div>
  )

  const player: PlayerDetail['player'] = detail?.player || { ...selected, bio: null, banner_url: null }
  return (
    <div className="lili-player-hub detail">
      <div className="lili-player-head"><button onClick={() => { setSelected(null); setDetail(null) }}><ArrowLeft size={17}/></button><span className="lili-player-avatar large">{player.avatar_url ? <img src={player.avatar_url} alt=""/> : player.nick.slice(0,2).toUpperCase()}</span><div><strong>{player.nick}</strong><span>{player.funcao || 'Jogador'} · ID {player.id_jogo || 'pendente'}</span></div><a href={`/jogadores/${player.id}`}><ExternalLink size={16}/></a></div>

      <nav className="lili-player-sections">
        <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}><BarChart3 size={16}/><span>Resumo</span></button>
        <button className={section === 'teams' ? 'active' : ''} onClick={() => setSection('teams')}><Shield size={16}/><span>Equipes</span></button>
        <button className={section === 'lines' ? 'active' : ''} onClick={() => setSection('lines')}><Swords size={16}/><span>Lines</span></button>
        <button className={section === 'championships' ? 'active' : ''} onClick={() => setSection('championships')}><Trophy size={16}/><span>Eventos</span></button>
        <button className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}><Gamepad2 size={16}/><span>Perfil</span></button>
      </nav>

      {error ? <div className="lili-player-feedback error">{error}</div> : null}
      {loading || !detail ? <div className="lili-player-loading"><RefreshCw className="spin" size={18}/> Carregando player...</div> : null}

      {detail && section === 'overview' ? <div className="lili-player-section"><div className="lili-player-metrics"><div><span>Equipes</span><strong>{counts.teams}</strong></div><div><span>Lines</span><strong>{counts.lines}</strong></div><div><span>Eventos</span><strong>{counts.championships}</strong></div><div><span>Formações</span><strong>{counts.formations}</strong></div></div><div className="lili-player-highlight"><Gamepad2 size={20}/><div><strong>{player.nick}</strong><span>{player.bio || 'Complete seu perfil para apresentar sua função, experiência e objetivos.'}</span></div></div>{counts.championships ? <div className="lili-player-mini-list"><strong>Competições ativas</strong>{detail.overview.activeChampionships.slice(0,3).map((row: any) => <article key={row.id}><span>{row.campeonato?.nome || 'Campeonato'}</span><small>{row.equipe?.nome || 'Equipe'} · {row.line?.nome || 'Line'}</small></article>)}</div> : null}</div> : null}

      {detail && section === 'teams' ? <div className="lili-player-section"><div className="lili-player-title"><div><strong>Minhas equipes</strong><span>{counts.teams} vínculo(s) ativo(s)</span></div></div><div className="lili-player-rows">{detail.overview.teams.map((row: any) => <article key={row.id}><span className="lili-player-avatar">{row.equipe?.logo_url ? <img src={row.equipe.logo_url} alt=""/> : String(row.equipe?.tag || row.equipe?.nome || 'EQ').slice(0,2)}</span><div><strong>{row.equipe?.nome || 'Equipe'}</strong><small>{row.equipe?.tag || 'Sem tag'} · {row.funcao || player.funcao || 'Jogador'}</small></div></article>)}</div>{!counts.teams ? <div className="lili-player-empty compact"><Users size={26}/><strong>Sem equipe ativa</strong><span>Aceite um convite para entrar no elenco de uma equipe.</span></div> : null}</div> : null}

      {detail && section === 'lines' ? <div className="lili-player-section"><div className="lili-player-title"><div><strong>Minhas lines</strong><span>Você pode participar de várias lines.</span></div></div><div className="lili-player-rows">{detail.overview.lines.map((row: any) => <article key={row.id}><span className="lili-player-avatar">{row.line?.logo_url ? <img src={row.line.logo_url} alt=""/> : String(row.line?.tag || row.line?.nome || 'L').slice(0,2)}</span><div><strong>{row.line?.nome || 'Line'}</strong><small>{row.equipe?.nome || 'Equipe'} · {row.line?.tag || 'Sem tag'}</small></div></article>)}</div>{!counts.lines ? <div className="lili-player-empty compact"><Swords size={26}/><strong>Sem line vinculada</strong><span>O responsável pela equipe pode adicionar você a uma ou mais lines.</span></div> : null}</div> : null}

      {detail && section === 'championships' ? <div className="lili-player-section"><div className="lili-player-title"><div><strong>Campeonatos e formações</strong><span>{counts.formations} escalação(ões)</span></div></div><div className="lili-player-rows events">{detail.overview.formations.map((row: any) => <article key={row.id}><span className="lili-player-avatar">{row.campeonato?.logo_url ? <img src={row.campeonato.logo_url} alt=""/> : 'C'}</span><div><strong>{row.campeonato?.nome || 'Campeonato'}</strong><small>{row.equipe?.nome || 'Equipe'} · {row.line?.nome || 'Line'} · {row.grupo?.nome || 'Sem grupo'}</small><em>{row.tipo_formacao === 'reserva' ? 'Reserva' : 'Titular'} · posição {row.ordem_formacao || '-'}</em></div></article>)}</div>{!counts.formations ? <div className="lili-player-empty compact"><Trophy size={26}/><strong>Sem formação ativa</strong><span>Suas escalações oficiais aparecerão aqui.</span></div> : null}</div> : null}

      {detail && section === 'profile' ? <div className="lili-player-section"><div className="lili-player-profile-card"><span className="lili-player-avatar xlarge">{player.avatar_url ? <img src={player.avatar_url} alt=""/> : player.nick.slice(0,2).toUpperCase()}</span><strong>{player.nick}</strong><span>@{player.username || 'jogador'}</span><dl><div><dt>ID Free Fire</dt><dd>{player.id_jogo || 'Não informado'}</dd></div><div><dt>Função</dt><dd>{player.funcao || 'Não informada'}</dd></div><div><dt>Localidade</dt><dd>{player.localidade || 'Não informada'}</dd></div><div><dt>Status</dt><dd>{player.status || 'ativo'}</dd></div></dl><a href={`/jogadores/${player.id}`}>Abrir e editar perfil completo <ExternalLink size={15}/></a></div></div> : null}
    </div>
  )
}
