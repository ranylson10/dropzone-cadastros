'use client'

import { useEffect, useState } from 'react'
import { Medal, RefreshCw, Shield, Swords } from 'lucide-react'

type RankMode = 'teams' | 'players'

export function LiliRankHub() {
  const [mode, setMode] = useState<RankMode>('teams')
  const [data, setData] = useState<{ teams: any[]; players: any[] }>({ teams: [], players: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/rank', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o ranking.')
      setData({ teams: payload.teams || [], players: payload.players || [] })
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível carregar o ranking.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rows = mode === 'teams' ? data.teams : data.players

  return (
    <section className="directory-rank-table">
      <div className="directory-rank-toolbar">
        <nav aria-label="Tipo de ranking">
          <button type="button" className={mode === 'teams' ? 'active' : ''} onClick={() => setMode('teams')}>
            <Shield size={16} /> Equipes
          </button>
          <button type="button" className={mode === 'players' ? 'active' : ''} onClick={() => setMode('players')}>
            <Swords size={16} /> Jogadores
          </button>
        </nav>
        <button className="directory-rank-refresh" type="button" onClick={() => void load()} aria-label="Atualizar ranking">
          <RefreshCw className={loading ? 'spin' : ''} size={16} />
        </button>
      </div>

      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {!loading && !rows.length ? (
        <div className="lili-team-empty">
          <Medal size={34} />
          <strong>Ranking ainda vazio</strong>
          <span>Os resultados aparecem após as primeiras quedas pontuadas.</span>
        </div>
      ) : null}

      {rows.length ? (
        <div className="directory-list-head" aria-hidden="true">
          <span className="directory-list-head-main">{mode === 'teams' ? 'Equipe' : 'Jogador'}</span>
          <span className="directory-list-head-meta">
            <em>Posição</em>
            <em>{mode === 'teams' ? 'Booyah' : 'Dano'}</em>
            <em>{mode === 'teams' ? 'Pontos' : 'Abates'}</em>
          </span>
        </div>
      ) : null}

      <div className="directory-list directory-rank-list">
        {rows.map((row) => {
          const image = row.logo_url || row.foto_url || row.avatar_url || ''
          const title = mode === 'teams' ? row.nome : row.nick
          const detail = mode === 'teams'
            ? [row.tag, `${row.quedas} quedas`].filter(Boolean).join(' · ')
            : [`${row.assistencias || 0} assist.`, `${row.quedas} quedas`].join(' · ')

          return (
            <article className="directory-list-row directory-list-row-compact directory-rank-row" key={row.key}>
              <b className="directory-rank-mobile-position">{row.rank}</b>
              <span className="directory-list-media">
                {image ? <img src={image} alt="" /> : mode === 'teams' ? <Shield size={18} /> : <Swords size={18} />}
              </span>
              <span className="directory-list-main">
                <small>{mode === 'teams' ? 'Equipe' : 'Jogador'}</small>
                <strong>{title}</strong>
                <span>{detail}</span>
              </span>
              <span className="directory-list-meta">
                <em data-label="Posição"><b className="directory-rank-position">#{row.rank}</b></em>
                <em data-label={mode === 'teams' ? 'Booyah' : 'Dano'}><b>{mode === 'teams' ? row.booyahs : row.dano}</b></em>
                <em data-label={mode === 'teams' ? 'Pontos' : 'Abates'}><b className="directory-rank-score">{mode === 'teams' ? `${row.pontos} pts` : `${row.abates} K`}</b></em>
              </span>
              <strong className="directory-rank-mobile-score">{mode === 'teams' ? `${row.pontos} pts` : `${row.abates} K`}</strong>
              <span className="directory-list-arrow" aria-hidden="true" />
            </article>
          )
        })}
      </div>
    </section>
  )
}
