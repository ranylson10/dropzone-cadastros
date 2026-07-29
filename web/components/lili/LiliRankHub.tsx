'use client'

import { useEffect, useState } from 'react'
import { Medal, RefreshCw, Shield, Swords } from 'lucide-react'

export function LiliRankHub() {
  const [mode, setMode] = useState<'teams' | 'players'>('teams')
  const [data, setData] = useState<{ teams: any[]; players: any[] }>({ teams: [], players: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/rank', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o ranking.')
      setData({ teams: payload.teams || [], players: payload.players || [] })
    } catch (cause: any) { setError(cause?.message || 'Não foi possível carregar o ranking.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  const rows = mode === 'teams' ? data.teams : data.players

  return <section className="lili-rank-hub">
    <header><div><strong>Ranking DropZone</strong><span>Resultados oficiais registrados no sistema.</span></div><button type="button" onClick={() => void load()} aria-label="Atualizar ranking"><RefreshCw className={loading ? 'spin' : ''} size={17}/></button></header>
    <nav><button type="button" className={mode === 'teams' ? 'active' : ''} onClick={() => setMode('teams')}><Shield size={16}/> Equipes</button><button type="button" className={mode === 'players' ? 'active' : ''} onClick={() => setMode('players')}><Swords size={16}/> Jogadores</button></nav>
    {error ? <div className="lili-team-feedback error">{error}</div> : null}
    {!loading && !rows.length ? <div className="lili-team-empty"><Medal size={34}/><strong>Ranking ainda vazio</strong><span>Os resultados aparecem após as primeiras quedas pontuadas.</span></div> : null}
    <div className="lili-rank-list">{rows.map((row) => <article key={row.key}><b>{row.rank}</b><span className="lili-rank-avatar">{row.logo_url || row.foto_url ? <img src={row.logo_url || row.foto_url} alt=""/> : mode === 'teams' ? <Shield size={18}/> : <Swords size={18}/>}</span><div><strong>{mode === 'teams' ? row.nome : row.nick}</strong><small>{mode === 'teams' ? [row.tag, `${row.booyahs} BOOYAH`, `${row.quedas} quedas`].filter(Boolean).join(' · ') : [`${row.abates} abates`, `${row.dano} dano`, `${row.quedas} quedas`].join(' · ')}</small></div><em>{mode === 'teams' ? `${row.pontos} pts` : `${row.abates} K`}</em></article>)}</div>
  </section>
}
