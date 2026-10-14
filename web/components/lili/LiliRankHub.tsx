'use client'

import { Input as UiInput } from '@/components/ui/Field'
import { Dialog } from '@/components/ui/Dialog'
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Info, Medal, RefreshCw, Search, Shield, Swords, Trophy, X } from 'lucide-react'
import './rank-list-r18.css'
import styles from './LiliRankHub.module.css'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState<RankRow | null>(null)
  const [search, setSearch] = useState('')
  const [methodOpen, setMethodOpen] = useState(false)

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
  const selectedTitle = selectedRow ? (mode === 'players' ? selectedRow.nick : selectedRow.nome) || 'Sem nome' : ''
  const selectedImage = selectedRow?.logo_url || selectedRow?.foto_url || selectedRow?.avatar_url || ''
  const selectedProfileHref = selectedRow ? profileHref(mode, selectedRow) : ''
  const updatedAt = dateTimeLabel(data.updated_at)
  const updatedTime = updatedAt ? new Date(data.updated_at!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const resultLabel = search.trim()
    ? `${rows.length} ${rows.length === 1 ? 'resultado' : 'resultados'}`
    : `${rows.length} ${mode === 'teams' ? rows.length === 1 ? 'equipe' : 'equipes' : mode === 'players' ? rows.length === 1 ? 'jogador' : 'jogadores' : rows.length === 1 ? 'campeonato' : 'campeonatos'}`

  function changeMode(next: RankMode) {
    setMode(next)
    setSelectedRow(null)
    setSearch('')
  }

  return (
    <section className="directory-rank-table">
      <header className="directory-hero directory-hero-banner directory-rank-hero theme-rank" data-theme="rank">
        <div className="directory-rank-hero-inner">
          <div className="directory-rank-heading">
            <div>
              <small>DIRETÓRIO COMPETITIVO</small>
              <h1><span className="directory-rank-title-full">Ranking DropZone</span><span className="directory-rank-title-mobile">Ranking</span></h1>
            </div>
            <div className="directory-rank-actions">
              <button className="directory-rank-help" type="button" onClick={() => setMethodOpen(true)} aria-label="Como funciona o ranking"><Info size={20} aria-hidden="true" /></button>
              <button className="directory-rank-refresh" type="button" disabled={loading} onClick={() => void load()} aria-label="Atualizar ranking"><RefreshCw className={loading ? 'spin' : ''} size={20} aria-hidden="true" /></button>
            </div>
          </div>
          <p>Ranking baseado em resultados oficiais. Compare equipes, jogadores e campeonatos com um score competitivo separado dos pontos de cada torneio.</p>
        </div>
      </header>
      <div className="directory-rank-toolbar">
        <nav aria-label="Tipo de ranking">
          <button type="button" aria-pressed={mode === 'teams'} className={mode === 'teams' ? 'active' : ''} onClick={() => changeMode('teams')}><Shield size={16} /> Equipes</button>
          <button type="button" aria-pressed={mode === 'players'} className={mode === 'players' ? 'active' : ''} onClick={() => changeMode('players')}><Swords size={16} /> Jogadores</button>
          <button type="button" aria-pressed={mode === 'championships'} className={mode === 'championships' ? 'active' : ''} onClick={() => changeMode('championships')}><Trophy size={16} /> Campeonatos</button>
        </nav>
      </div>

      <div className="directory-rank-context">
        <div className="directory-rank-search"><Search size={18} aria-hidden="true" /><UiInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar ${modeLabel.toLocaleLowerCase('pt-BR')}`} aria-label={`Buscar ${modeLabel.toLocaleLowerCase('pt-BR')} no ranking`} />{search ? <button type="button" className="directory-rank-search-clear" aria-label="Limpar busca" onClick={() => setSearch('')}><X size={18} aria-hidden="true" /></button> : null}</div>
        <div className="directory-rank-method">
          <span>{resultLabel}</span>
          {updatedAt ? <time dateTime={data.updated_at} title={`Atualizado ${updatedAt}`}>Atualizado <span className="directory-rank-updated-full">{updatedAt}</span><span className="directory-rank-updated-mobile">às {updatedTime}</span></time> : <span>Resultados oficiais</span>}
        </div>
      </div>

      {error ? <div className="lili-team-feedback error" role="alert">{error}</div> : null}
      {loading && !sourceRows.length ? <div className="directory-rank-loading" role="status" aria-label="Carregando ranking" aria-live="polite">{[0,1,2,3,4].map(key => <div key={key} aria-hidden="true"><i /><span /><b /></div>)}</div> : null}
      {!loading && !error && !sourceRows.length ? <div className="lili-team-empty"><Medal size={24} /><strong>Ranking ainda vazio</strong><span>Os tiers surgem depois dos primeiros resultados oficiais.</span></div> : null}
      {!loading && !error && sourceRows.length > 0 && rows.length === 0 ? <div className="lili-team-empty"><Search size={24} /><strong>Nenhum resultado</strong><span>Tente outro nome, tag ou ID.</span></div> : null}
      {rows.length > 0 ? (
        <div className="dz-ranking-head" aria-hidden="true">
          <span>Posição</span>
          <span>{modeLabel}</span>
          <span>Tier</span>
          <span>Score DZ</span>
        </div>
      ) : null}

      <ol className="dz-ranking-list" aria-busy={loading} aria-label={`Classificação: ${mode === 'teams' ? 'equipes' : mode === 'players' ? 'jogadores' : 'campeonatos'}`}>
        {rows.map((row) => {
          const image = row.logo_url || row.foto_url || row.avatar_url || ''
          const title = (mode === 'players' ? row.nick : row.nome) || 'Sem nome'
          const detail = mode === 'teams'
            ? [row.tag, `${row.quedas || 0} quedas`, `${row.abates || 0} abates`].filter(Boolean).join(' · ')
            : mode === 'players'
              ? [`${row.abates || 0} abates`, `${row.assistencias || 0} assist.`, `${row.quedas || 0} quedas`].join(' · ')
              : [`${row.participantes || 0} equipes`, `${row.jogadores || 0} jogadores`, `${row.quedas || 0} quedas`].join(' · ')
          const score = Number(row.score || 0).toFixed(1)
          const mobileDetail = mode === 'teams'
            ? [row.tag, `${row.quedas || 0} quedas`].filter(Boolean).join(' · ')
            : mode === 'players'
              ? `${row.abates || 0} abates · ${row.quedas || 0} quedas`
              : `${row.participantes || 0} equipes · ${row.quedas || 0} quedas`
          const tier = String(row.tier || 'E').toLowerCase()
          const icon = mode === 'teams' ? <Shield size={20} aria-hidden="true" /> : mode === 'players' ? <Swords size={20} aria-hidden="true" /> : <Trophy size={20} aria-hidden="true" />

          return (
            <li className="dz-ranking-list-entry" key={row.key}>
            <button
              type="button"
              className="dz-ranking-item"
              aria-label={`Ver estatísticas de ${title}, posição ${row.rank}, score ${score}`}
              onClick={() => setSelectedRow(row)}
            >
              <span className={`dz-ranking-number ${Number(row.rank) <= 3 ? 'is-leading' : ''}`}>{row.rank}</span>
              <span className="dz-ranking-identity">
                <span className="dz-ranking-avatar">{image ? <img src={image} alt="" loading="lazy" decoding="async" /> : icon}</span>
                <span className="dz-ranking-name"><strong>{title}</strong><small className="dz-ranking-meta-full">{detail}</small><small className="dz-ranking-meta-mobile">{mobileDetail}</small></span>
              </span>
              <span className="dz-ranking-tier"><span className={`directory-tier tier-${tier}`}>{row.tier || 'E'}</span></span>
              <span className="dz-ranking-score"><strong>{score}</strong><span className="dz-ranking-mobile-tier">Tier {row.tier || 'E'}</span><span className={`directory-tier tier-${tier}`}>{row.tier || 'E'}</span></span>
            </button>
            </li>
          )
        })}
      </ol>

      <Dialog open={methodOpen} title="Como funciona o ranking" onClose={() => setMethodOpen(false)} size="medium" className="directory-rank-help-dialog">
        <p>O score DropZone parte do desempenho oficial, considera o tamanho da amostra e recebe influência limitada do nível das equipes, jogadores e campeonatos relacionados.</p>
        <dl><div><dt>Posição</dt><dd>Colocação na lista de equipes, jogadores ou campeonatos.</dd></div><div><dt>Score DZ</dt><dd>Indicador competitivo. É diferente dos pontos obtidos em um campeonato.</dd></div><div><dt>Tier</dt><dd>Faixa de classificação associada ao score.</dd></div></dl>
        <p>Toque em um item para consultar suas estatísticas e abrir o perfil completo.</p>
      </Dialog>
      {selectedRow ? <Dialog open title={selectedTitle} description={`${modeLabel} #${selectedRow.rank}`} onClose={() => setSelectedRow(null)} size="medium" closeLabel="Fechar detalhes" className={`${styles.detail} directory-rank-detail`}>
          <div className="directory-rank-detail-identity">
            <span className="directory-rank-detail-image">{selectedImage ? <img src={selectedImage} alt="" /> : mode === 'teams' ? <Shield size={25} /> : mode === 'players' ? <Swords size={25} /> : <Trophy size={25} />}</span>
          </div>
          <div className="directory-rank-detail-score"><span>Tier <b className={`directory-tier tier-${String(selectedRow.tier || 'E').toLowerCase()}`}>{selectedRow.tier || 'E'}</b></span><strong>{Number(selectedRow.score || 0).toFixed(1)} <small>score DZ</small></strong></div>
          <dl className="directory-rank-detail-metrics">
            {primaryMetrics(mode, selectedRow).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {advancedMetrics(mode, selectedRow).length ? <details className="directory-rank-detail-advanced"><summary>Mais estatísticas</summary><dl>{advancedMetrics(mode, selectedRow).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details> : null}
          {selectedProfileHref ? <a className="directory-rank-profile-link" href={selectedProfileHref}>Abrir perfil completo <ExternalLink size={14} /></a> : null}
      </Dialog> : null}
    </section>
  )
}
