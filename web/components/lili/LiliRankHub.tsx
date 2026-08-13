'use client'

import { useEffect, useState } from 'react'
import { Medal, RefreshCw, Shield, Swords, Trophy } from 'lucide-react'

type RankMode = 'teams' | 'players' | 'championships'
type RankingData = { teams: any[]; players: any[]; championships: any[] }

export function LiliRankHub() {
  const [mode, setMode] = useState<RankMode>('teams')
  const [data, setData] = useState<RankingData>({ teams: [], players: [], championships: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/rank', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o ranking.')
      setData({ teams: payload.teams || [], players: payload.players || [], championships: payload.championships || [] })
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível carregar o ranking.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const rows = mode === 'teams' ? data.teams : mode === 'players' ? data.players : data.championships
  const modeLabel = mode === 'teams' ? 'Equipe' : mode === 'players' ? 'Jogador' : 'Campeonato'

  return (
    <section className="directory-rank-table">
      <div className="directory-rank-toolbar">
        <nav aria-label="Tipo de ranking">
          <button type="button" className={mode === 'teams' ? 'active' : ''} onClick={() => setMode('teams')}><Shield size={16} /> Equipes</button>
          <button type="button" className={mode === 'players' ? 'active' : ''} onClick={() => setMode('players')}><Swords size={16} /> Jogadores</button>
          <button type="button" className={mode === 'championships' ? 'active' : ''} onClick={() => setMode('championships')}><Trophy size={16} /> Campeonatos</button>
        </nav>
        <button className="directory-rank-refresh" type="button" onClick={() => void load()} aria-label="Atualizar ranking"><RefreshCw className={loading ? 'spin' : ''} size={16} /></button>
      </div>

      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {!loading && !rows.length ? <div className="lili-team-empty"><Medal size={34} /><strong>Ranking ainda vazio</strong><span>Os tiers surgem depois dos primeiros resultados oficiais.</span></div> : null}

      {rows.length ? <div className="directory-list-head" aria-hidden="true"><span className="directory-list-head-main">{modeLabel}</span><span className="directory-list-head-meta"><em>Posição</em><em>Tier</em><em>Score</em></span></div> : null}

      <div className="directory-list directory-rank-list">
        {rows.map((row) => {
          const image = row.logo_url || row.foto_url || row.avatar_url || ''
          const title = mode === 'players' ? row.nick : row.nome
          const detail = mode === 'teams'
            ? [row.tag, `${row.quedas} quedas`, `${row.abates || 0} abates`].filter(Boolean).join(' · ')
            : mode === 'players'
              ? [`${row.abates || 0} abates`, `${row.assistencias || 0} assist.`, `${row.quedas} quedas`].join(' · ')
              : [`${row.participantes || 0} equipes`, `${row.jogadores || 0} jogadores`, `${row.quedas || 0} quedas`].join(' · ')
          const score = Number(row.score || 0).toFixed(1)

          return <article className="directory-list-row directory-list-row-compact directory-rank-row" key={row.key}>
            <b className="directory-rank-mobile-position">{row.rank}</b>
            <span className="directory-list-media">{image ? <img src={image} alt="" /> : mode === 'teams' ? <Shield size={18} /> : mode === 'players' ? <Swords size={18} /> : <Trophy size={18} />}</span>
            <span className="directory-list-main"><small>{modeLabel}</small><strong>{title}</strong><span>{detail}</span></span>
            <span className="directory-list-meta">
              <em data-label="Posição"><b className="directory-rank-position">#{row.rank}</b></em>
              <em data-label="Tier"><b className={`directory-tier tier-${String(row.tier || 'E').toLowerCase()}`}>{row.tier || 'E'}</b></em>
              <em data-label="Score"><b className="directory-rank-score">{score}</b></em>
            </span>
            <strong className="directory-rank-mobile-score">{row.tier || 'E'} · {score}</strong>
            <span className="directory-list-arrow" aria-hidden="true" />
          </article>
        })}
      </div>
    </section>
  )
}
