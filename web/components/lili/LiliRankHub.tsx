'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Info, Medal, RefreshCw, Search, Shield, Swords, Trophy, X } from 'lucide-react'

type RankMode = 'teams' | 'players' | 'championships'
type RankRow = Record<string, any>
type RankingData = {
  teams: RankRow[]
  players: RankRow[]
  championships: RankRow[]
  updated_at?: string
  metodologia?: Record<string, any>
}

function skillLabel(skill: any) {
  if (!skill) return 'Sem dados importados'
  return [skill.personagem, skill.habilidade].filter(Boolean).join(' - ') || 'Sem dados importados'
}

function primaryMetrics(mode: RankMode, row: RankRow) {
  if (mode === 'players') return [
    ['Abates', row.abates || 0],
    ['Dano', Number(row.dano || 0).toLocaleString('pt-BR')],
    ['Assistências', row.assistencias || 0],
    ['Revives', row.revives || 0],
    ['Quedas', row.quedas || 0],
    ['Equipe', (row.equipes || []).map((team: any) => [team.tag, team.nome].filter(Boolean).join(' - ')).join(', ') || 'Sem equipe vinculada'],
  ]
  if (mode === 'teams') return [
    ['Pontos', Number(row.pontos || 0).toLocaleString('pt-BR')],
    ['Abates', row.abates || 0],
    ['Booyahs', row.booyahs || 0],
    ['Dano do elenco', Number(row.dano || 0).toLocaleString('pt-BR')],
    ['Jogadores', row.jogadores || 0],
    ['Quedas', row.quedas || 0],
  ]
  return [
    ['Equipes', row.participantes || 0],
    ['Jogadores', row.jogadores || 0],
    ['Quedas', row.quedas || 0],
    ['Premiação', Number(row.premiacao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
    ['Formato', row.tipo || 'Campeonato'],
  ]
}

function advancedMetrics(mode: RankMode, row: RankRow) {
  if (mode === 'players') return [
    ['Função', row.funcao || 'Não definida'],
    ['Arma mais usada', row.arma_mais_usada || 'Sem dados importados'],
    ['Habilidade ativa', skillLabel(row.habilidade_ativa)],
    ['Passivas mais usadas', (row.habilidades_passivas || []).map(skillLabel).join(' | ') || 'Sem dados importados'],
    ['Headshots', row.headshots || 0],
    ['Knockdowns', row.knockdowns || 0],
    ['Sobrevivência', `${Number(row.sobrevivencia_segundos || 0).toLocaleString('pt-BR')} s`],
    ['Distância movida', `${Number(row.distancia_movida || 0).toLocaleString('pt-BR')} m`],
    ['Maior distância de abate', `${Number(row.distancia_max_abate || 0).toLocaleString('pt-BR')} m`],
    ['Granadas usadas', row.granadas_usadas || 0],
    ['Paredes de gel', row.gel_usado || 0],
    ['Kits médicos', row.kits_medicos || 0],
  ]
  if (mode === 'teams') return [
    ['Assistências', row.assistencias || 0],
    ['Revives', row.revives || 0],
    ['Headshots', row.headshots || 0],
    ['Knockdowns', row.knockdowns || 0],
    ['Sobrevivência', `${Number(row.sobrevivencia_segundos || 0).toLocaleString('pt-BR')} s`],
    ['Distância movida', `${Number(row.distancia_movida || 0).toLocaleString('pt-BR')} m`],
    ['Maior distância de abate', `${Number(row.distancia_max_abate || 0).toLocaleString('pt-BR')} m`],
    ['Granadas usadas', row.granadas_usadas || 0],
    ['Paredes de gel', row.gel_usado || 0],
    ['Kits médicos', row.kits_medicos || 0],
  ]
  return []
}

function profileHref(mode: RankMode, row: RankRow) {
  if (mode === 'players' && row.jogador_id) return `/jogadores/${row.jogador_id}`
  if (mode === 'teams' && row.equipe_id) return `/equipes/${row.equipe_id}`
  if (mode === 'championships' && row.campeonato_id) return `/campeonatos/${row.campeonato_id}`
  return ''
}

function dateTimeLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function LiliRankHub() {
  const [mode, setMode] = useState<RankMode>('teams')
  const [data, setData] = useState<RankingData>({ teams: [], players: [], championships: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState<RankRow | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/rank', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o ranking.')
      setData({
        teams: payload.teams || [],
        players: payload.players || [],
        championships: payload.championships || [],
        updated_at: payload.updated_at,
        metodologia: payload.metodologia,
      })
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível carregar o ranking.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const sourceRows = mode === 'teams' ? data.teams : mode === 'players' ? data.players : data.championships
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    if (!query) return sourceRows
    return sourceRows.filter((row) => {
      const teams = Array.isArray(row.equipes) ? row.equipes.map((team: any) => `${team.nome || ''} ${team.tag || ''}`).join(' ') : ''
      return [row.nome, row.nick, row.tag, row.id_jogo, teams]
        .map((value) => String(value || '').toLocaleLowerCase('pt-BR'))
        .some((value) => value.includes(query))
    })
  }, [search, sourceRows])
  const modeLabel = mode === 'teams' ? 'Equipe' : mode === 'players' ? 'Jogador' : 'Campeonato'
  const selectedTitle = selectedRow ? (mode === 'players' ? selectedRow.nick : selectedRow.nome) : ''
  const selectedImage = selectedRow?.logo_url || selectedRow?.foto_url || selectedRow?.avatar_url || ''
  const selectedProfileHref = selectedRow ? profileHref(mode, selectedRow) : ''
  const updatedAt = dateTimeLabel(data.updated_at)

  function changeMode(next: RankMode) {
    setMode(next)
    setSelectedRow(null)
    setSearch('')
  }

  return (
    <section className="directory-rank-table">
      <div className="directory-rank-toolbar">
        <nav aria-label="Tipo de ranking">
          <button type="button" aria-pressed={mode === 'teams'} className={mode === 'teams' ? 'active' : ''} onClick={() => changeMode('teams')}><Shield size={16} /> Equipes</button>
          <button type="button" aria-pressed={mode === 'players'} className={mode === 'players' ? 'active' : ''} onClick={() => changeMode('players')}><Swords size={16} /> Jogadores</button>
          <button type="button" aria-pressed={mode === 'championships'} className={mode === 'championships' ? 'active' : ''} onClick={() => changeMode('championships')}><Trophy size={16} /> Campeonatos</button>
        </nav>
        <button className="directory-rank-refresh" type="button" onClick={() => void load()} aria-label="Atualizar ranking"><RefreshCw className={loading ? 'spin' : ''} size={16} /></button>
      </div>

      <div className="directory-rank-context">
        <label className="directory-rank-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar ${modeLabel.toLocaleLowerCase('pt-BR')}`} aria-label={`Buscar ${modeLabel.toLocaleLowerCase('pt-BR')} no ranking`} /></label>
        <div className="directory-rank-method">
          <span>{updatedAt ? `Atualizado ${updatedAt}` : 'Resultados oficiais'}</span>
          <details>
            <summary><Info size={14} /> Como funciona</summary>
            <p>O score DropZone parte do desempenho oficial, considera o tamanho da amostra e recebe influência limitada do nível das equipes, jogadores e campeonatos relacionados. Pontos do campeonato e score DropZone são medidas diferentes.</p>
          </details>
        </div>
      </div>

      {error ? <div className="lili-team-feedback error">{error}</div> : null}
      {loading ? <div className="directory-rank-loading" role="status" aria-live="polite"><span /><span /><span /><span /><span /></div> : null}
      {!loading && !sourceRows.length ? <div className="lili-team-empty"><Medal size={34} /><strong>Ranking ainda vazio</strong><span>Os tiers surgem depois dos primeiros resultados oficiais.</span></div> : null}
      {!loading && sourceRows.length > 0 && rows.length === 0 ? <div className="lili-team-empty"><Search size={30} /><strong>Nenhum resultado</strong><span>Tente outro nome, tag ou ID.</span></div> : null}
      {rows.length ? <div className="directory-list-head" aria-hidden="true"><span className="directory-list-head-main">{modeLabel}</span><span className="directory-list-head-meta"><em>Posição</em><em>Tier</em><em>Score DZ</em></span></div> : null}

      <div className="directory-list directory-rank-list">
        {rows.map((row) => {
          const image = row.logo_url || row.foto_url || row.avatar_url || ''
          const hasMedia = Number(row.rank || 0) <= 3
          const title = mode === 'players' ? row.nick : row.nome
          const detail = mode === 'teams'
            ? [row.tag, `${row.quedas} quedas`, `${row.abates || 0} abates`].filter(Boolean).join(' · ')
            : mode === 'players'
              ? [`${row.abates || 0} abates`, `${row.assistencias || 0} assist.`, `${row.quedas} quedas`].join(' · ')
              : [`${row.participantes || 0} equipes`, `${row.jogadores || 0} jogadores`, `${row.quedas || 0} quedas`].join(' · ')
          const score = Number(row.score || 0).toFixed(1)

          return <article
            className={`directory-list-row directory-list-row-compact directory-rank-row${hasMedia ? ' rank-featured' : ' rank-text-only'}`}
            key={row.key}
            role="button"
            tabIndex={0}
            aria-label={`Abrir dados de ${title}`}
            onClick={() => setSelectedRow(row)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRow(row) } }}
          >
            <b className="directory-rank-mobile-position">{row.rank}</b>
            {hasMedia ? <span className="directory-list-media">{image ? <img src={image} alt="" decoding="async" /> : mode === 'teams' ? <Shield size={18} /> : mode === 'players' ? <Swords size={18} /> : <Trophy size={18} />}</span> : null}
            <span className="directory-list-main"><small>{modeLabel}</small><strong>{title}</strong><span>{detail}</span></span>
            <span className="directory-list-meta">
              <em data-label="Posição"><b className="directory-rank-position">#{row.rank}</b></em>
              <em data-label="Tier"><b className={`directory-tier tier-${String(row.tier || 'E').toLowerCase()}`}>{row.tier || 'E'}</b></em>
              <em data-label="Score DZ"><b className="directory-rank-score">{score}</b></em>
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
          <div className="directory-rank-detail-score"><span>Tier <b className={`directory-tier tier-${String(selectedRow.tier || 'E').toLowerCase()}`}>{selectedRow.tier || 'E'}</b></span><strong>{Number(selectedRow.score || 0).toFixed(1)} <small>score DZ</small></strong></div>
          <dl className="directory-rank-detail-metrics">
            {primaryMetrics(mode, selectedRow).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {advancedMetrics(mode, selectedRow).length ? <details className="directory-rank-detail-advanced"><summary>Mais estatísticas</summary><dl>{advancedMetrics(mode, selectedRow).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details> : null}
          {selectedProfileHref ? <a className="directory-rank-profile-link" href={selectedProfileHref}>Abrir perfil completo <ExternalLink size={14} /></a> : null}
        </section>
      </div> : null}
    </section>
  )
}
