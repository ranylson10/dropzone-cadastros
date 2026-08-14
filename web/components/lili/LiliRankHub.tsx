'use client'

import { useEffect, useState } from 'react'
import { Medal, RefreshCw, Shield, Swords, Trophy, X } from 'lucide-react'

type RankMode = 'teams' | 'players' | 'championships'
type RankRow = Record<string, any>
type RankingData = { teams: RankRow[]; players: RankRow[]; championships: RankRow[] }

function rankMetrics(mode: RankMode, row: RankRow) {
  if (mode === 'players') return [
    ['Abates', row.abates || 0], ['Dano', Number(row.dano || 0).toLocaleString('pt-BR')],
    ['Assistencias', row.assistencias || 0], ['Revives', row.revives || 0], ['Quedas', row.quedas || 0],
    ['Arma mais usada', row.arma_mais_usada || 'Sem dados importados'],
  ]
  if (mode === 'teams') return [
    ['Pontos', Number(row.pontos || 0).toLocaleString('pt-BR')], ['Abates', row.abates || 0],
    ['Booyahs', row.booyahs || 0], ['Jogadores', row.jogadores || 0], ['Quedas', row.quedas || 0],
  ]
  return [
    ['Equipes', row.participantes || 0], ['Jogadores', row.jogadores || 0],
    ['Quedas', row.quedas || 0], ['Premiacao', Number(row.premiacao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
    ['Formato', row.tipo || 'Campeonato'],
  ]
}

export function LiliRankHub() {
  const [mode, setMode] = useState<RankMode>('teams')
  const [data, setData] = useState<RankingData>({ teams: [], players: [], championships: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState<RankRow | null>(null)

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
  const selectedTitle = selectedRow ? (mode === 'players' ? selectedRow.nick : selectedRow.nome) : ''
  const selectedImage = selectedRow?.logo_url || selectedRow?.foto_url || selectedRow?.avatar_url || ''

  return (
    <section className="directory-rank-table">
      <div className="directory-rank-toolbar">
        <nav aria-label="Tipo de ranking">
          <button type="button" aria-pressed={mode === 'teams'} className={mode === 'teams' ? 'active' : ''} onClick={() => { setMode('teams'); setSelectedRow(null) }}><Shield size={16} /> Equipes</button>
          <button type="button" aria-pressed={mode === 'players'} className={mode === 'players' ? 'active' : ''} onClick={() => { setMode('players'); setSelectedRow(null) }}><Swords size={16} /> Jogadores</button>
          <button type="button" aria-pressed={mode === 'championships'} className={mode === 'championships' ? 'active' : ''} onClick={() => { setMode('championships'); setSelectedRow(null) }}><Trophy size={16} /> Campeonatos</button>
        </nav>
        <button className="directory-rank-refresh" type="button" onClick={() => void load()} aria-label="Atualizar ranking"><RefreshCw className={loading ? 'spin' : ''} size={16} /></button>
      </div>

      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {loading ? <div className="directory-rank-loading" role="status" aria-live="polite"><span /><span /><span /><span /><span /></div> : null}
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

          return <article
            className="directory-list-row directory-list-row-compact directory-rank-row"
            key={row.key}
            role="button"
            tabIndex={0}
            aria-label={`Abrir dados de ${title}`}
            onClick={() => setSelectedRow(row)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRow(row) } }}
          >
            <b className="directory-rank-mobile-position">{row.rank}</b>
            <span className="directory-list-media">{image ? <img src={image} alt="" /> : mode === 'teams' ? <Shield size={18} /> : mode === 'players' ? <Swords size={18} /> : <Trophy size={18} />}</span>
            <span className="directory-list-main"><small>{modeLabel}</small><strong>{title}</strong><span>{detail}</span></span>
            <span className="directory-list-meta">
              <em data-label="Posição"><b className="directory-rank-position">#{row.rank}</b></em>
              <em data-label="Tier"><b className={`directory-tier tier-${String(row.tier || 'E').toLowerCase()}`}>{row.tier || 'E'}</b></em>
              <em data-label="Score"><b className="directory-rank-score">{score}</b></em>
            </span>
            <strong className="directory-rank-mobile-score"><span className={`directory-tier tier-${String(row.tier || 'E').toLowerCase()}`}>{row.tier || 'E'}</span><b>{score}</b></strong>
            <span className="directory-list-arrow" aria-hidden="true" />
          </article>
        })}
      </div>

      {selectedRow ? <div className="directory-rank-detail-backdrop" role="presentation" onClick={() => setSelectedRow(null)}>
        <section className="directory-rank-detail-card" role="dialog" aria-modal="true" aria-label={`Dados de ${selectedTitle}`} onClick={(event) => event.stopPropagation()}>
          <button className="directory-rank-detail-close" type="button" onClick={() => setSelectedRow(null)} aria-label="Fechar detalhes"><X size={18} /></button>
          <div className="directory-rank-detail-identity">
            <span className="directory-rank-detail-image">{selectedImage ? <img src={selectedImage} alt="" /> : mode === 'teams' ? <Shield size={25} /> : mode === 'players' ? <Swords size={25} /> : <Trophy size={25} />}</span>
            <div><small>{modeLabel} #{selectedRow.rank}</small><h2>{selectedTitle}</h2></div>
          </div>
          <div className="directory-rank-detail-score"><span>Tier <b className={`directory-tier tier-${String(selectedRow.tier || 'E').toLowerCase()}`}>{selectedRow.tier || 'E'}</b></span><strong>{Number(selectedRow.score || 0).toFixed(1)} <small>score</small></strong></div>
          <dl className="directory-rank-detail-metrics">
            {rankMetrics(mode, selectedRow).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
      </div> : null}
    </section>
  )
}
