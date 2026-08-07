'use client'

import { ChevronRight, Flame, Gift, Radio, Search, SlidersHorizontal, Ticket, Trophy, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import type { DirectoryItem } from '../types'

function getMetaLabels(items: DirectoryItem[]) {
  const labels: string[] = []
  for (const item of items) {
    for (const meta of item.meta || []) {
      if (!labels.includes(meta.label)) labels.push(meta.label)
      if (labels.length === 3) return labels
    }
  }
  return labels
}

function getMetaValue(item: DirectoryItem, label: string) {
  return item.meta?.find((meta) => meta.label === label)?.value || '—'
}

function money(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function vacancyRatio(item: DirectoryItem) {
  const free = Number(item.commercial?.vagas_livres || 0)
  const total = Math.max(1, Number(item.commercial?.total_vagas || 1))
  return Math.max(6, Math.min(100, (free / total) * 100))
}

function moneyNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function isToday(value: unknown) {
  if (!value) return false
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

type ChampFilters = {
  today: boolean
  free: boolean
  lastVacancies: boolean
  live: boolean
  withPrize: boolean
  mine: boolean
  maxPrice: string
  minPrize: string
}

const emptyChampFilters: ChampFilters = {
  today: false,
  free: false,
  lastVacancies: false,
  live: false,
  withPrize: false,
  mine: false,
  maxPrice: '',
  minPrize: '',
}

function hasChampFilters(filters: ChampFilters) {
  return filters.today || filters.free || filters.lastVacancies || filters.live || filters.withPrize || filters.mine || filters.maxPrice || filters.minPrize
}

function filterChampionships(items: DirectoryItem[], filters: ChampFilters, myChampionshipIds: Set<string>) {
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
  const minPrize = filters.minPrize ? Number(filters.minPrize) : null
  return items.filter((item) => {
    const price = moneyNumber(item.commercial?.valor_inscricao)
    const prize = moneyNumber(item.commercial?.premiacao)
    const free = Number(item.commercial?.vagas_livres ?? 0)
    if (filters.mine && !myChampionshipIds.has(item.id)) return false
    if (filters.today && !isToday(item.commercial?.data_jogo || item.commercial?.data_limite_inscricao)) return false
    if (filters.free && price > 0) return false
    if (filters.lastVacancies && !(free > 0 && free <= 3)) return false
    if (filters.live && !item.commercial?.tem_live) return false
    if (filters.withPrize && prize <= 0) return false
    if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false
    if (minPrize != null && Number.isFinite(minPrize) && prize < minPrize) return false
    return true
  })
}

function ChampionshipCards({ items, myChampionshipIds }: { items: DirectoryItem[]; myChampionshipIds: Set<string> }) {
  return (
    <div className="directory-champ-card-grid">
      {items.map((item) => {
        const free = Number(item.commercial?.vagas_livres ?? 0)
        const hasPrize = Number(item.commercial?.premiacao || 0) > 0
        const isMine = myChampionshipIds.has(item.id)
        return (
          <a className="directory-champ-card" href={`/${item.kind}/${item.id}`} key={item.id}>
            <span
              className="directory-champ-cover"
              style={item.banner ? { backgroundImage: `linear-gradient(180deg, rgba(8,12,18,.05), rgba(8,12,18,.92)), url(${item.banner})` } : undefined}
            >
              <em>{item.eyebrow || 'Campeonato'}</em>
              <span className="directory-champ-badges">
                {item.commercial?.tem_live ? <b><Radio size={12} /> Live</b> : null}
                {hasPrize ? <b><Gift size={12} /> Prêmio</b> : null}
                {free > 0 && free <= 3 ? <b className="hot"><Flame size={12} /> Últimas</b> : null}
              </span>
              <span className="directory-champ-logo">{item.image ? <img src={item.image} alt="" /> : <Trophy size={24} />}</span>
            </span>
            <span className="directory-champ-body">
              <span className="directory-champ-title">
                <small>{item.description}</small>
                <strong>{item.name}</strong>
              </span>
              <span className="directory-champ-metrics">
                <span><Ticket size={14} /><b>{money(item.commercial?.valor_inscricao)}</b><small>Inscrição</small></span>
                <span><Gift size={14} /><b>{hasPrize ? money(item.commercial?.premiacao) : '-'}</b><small>Premiação</small></span>
                <span><Users size={14} /><b>{free}</b><small>Vagas</small></span>
              </span>
              <span className="directory-champ-vacancy">
                <span><b>{free}</b> de {item.commercial?.total_vagas || 0} vagas reais</span>
                <i><em style={{ width: `${vacancyRatio(item)}%` }} /></i>
              </span>
              <span className="directory-champ-footer">
                <span>{[item.commercial?.plataforma, item.commercial?.servidor].filter(Boolean).join(' · ') || 'Formato competitivo'}</span>
                <b>Ver campeonato <ChevronRight size={15} /></b>
              </span>
              {isMine ? (
                <button
                  type="button"
                  className="directory-champ-lineup-action"
                  onClick={(event) => {
                    event.preventDefault()
                    window.location.href = '/?painel=1&section=campeonatos'
                  }}
                >
                  <Users size={14} /> Escalar elenco
                </button>
              ) : null}
            </span>
          </a>
        )
      })}
    </div>
  )
}

export function DirectoryListClient({ items }: { items: DirectoryItem[] }) {
  const [query, setQuery] = useState('')
  const [champFilters, setChampFilters] = useState<ChampFilters>(emptyChampFilters)
  const [myChampionshipIds, setMyChampionshipIds] = useState<Set<string>>(new Set())
  const isChampionshipDirectory = items[0]?.kind === 'campeonatos'

  useEffect(() => {
    if (!isChampionshipDirectory) return
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      if (!accessToken) return
      const response = await fetch('/api/equipe/escalacoes', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null)
      const payload = response?.ok ? await response.json().catch(() => ({})) : {}
      if (!alive) return
      setMyChampionshipIds(new Set<string>((payload.escalacoes || []).map((row: any) => String(row.campeonato_id || '')).filter(Boolean)))
    })
    return () => { alive = false }
  }, [isChampionshipDirectory])

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const queryItems = clean ? items.filter((item) => item.searchText.includes(clean)) : items
    return isChampionshipDirectory ? filterChampionships(queryItems, champFilters, myChampionshipIds) : queryItems
  }, [champFilters, isChampionshipDirectory, items, myChampionshipIds, query])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])
  const toggleChampFilter = (key: keyof Pick<ChampFilters, 'today' | 'free' | 'lastVacancies' | 'live' | 'withPrize' | 'mine'>) => {
    setChampFilters((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <>
      <div className="directory-toolbar">
        <label className="directory-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, usuário, tag ou localidade..."
          />
        </label>
        <div className="directory-result-count">
          <strong>{filtered.length}</strong>
          <span>resultado{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {isChampionshipDirectory ? (
        <div className="directory-market-filters" aria-label="Filtros de campeonatos">
          <div className="directory-market-filter-chips">
            <button type="button" className={champFilters.today ? 'active' : ''} onClick={() => toggleChampFilter('today')}>Hoje</button>
            <button type="button" className={champFilters.free ? 'active' : ''} onClick={() => toggleChampFilter('free')}>Grátis</button>
            <button type="button" className={champFilters.lastVacancies ? 'active' : ''} onClick={() => toggleChampFilter('lastVacancies')}>Últimas vagas</button>
            <button type="button" className={champFilters.live ? 'active' : ''} onClick={() => toggleChampFilter('live')}>Com live</button>
            <button type="button" className={champFilters.withPrize ? 'active' : ''} onClick={() => toggleChampFilter('withPrize')}>Com premiação</button>
            <button type="button" className={champFilters.mine ? 'active' : ''} onClick={() => toggleChampFilter('mine')}>Meus campeonatos</button>
          </div>
          <div className="directory-market-filter-fields">
            <label>
              <SlidersHorizontal size={14} />
              <span>Até R$</span>
              <input
                inputMode="decimal"
                min="0"
                type="number"
                value={champFilters.maxPrice}
                onChange={(event) => setChampFilters((current) => ({ ...current, maxPrice: event.target.value }))}
                placeholder="valor da vaga"
              />
            </label>
            <label>
              <Gift size={14} />
              <span>Prêmio mín.</span>
              <input
                inputMode="decimal"
                min="0"
                type="number"
                value={champFilters.minPrize}
                onChange={(event) => setChampFilters((current) => ({ ...current, minPrize: event.target.value }))}
                placeholder="R$"
              />
            </label>
            {hasChampFilters(champFilters) ? (
              <button type="button" className="directory-market-clear" onClick={() => setChampFilters(emptyChampFilters)}>
                <X size={14} /> Limpar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {filtered.length && !isChampionshipDirectory ? (
        <div className="directory-list-head" aria-hidden="true">
          <span className="directory-list-head-main">Perfil</span>
          <span className="directory-list-head-meta">
            {metaLabels.map((label) => (
              <em key={label}>{label}</em>
            ))}
          </span>
        </div>
      ) : null}

      {isChampionshipDirectory ? (
        <ChampionshipCards items={filtered} myChampionshipIds={myChampionshipIds} />
      ) : (
        <div className={`directory-list directory-list-${items[0]?.kind || 'empty'}`}>
          {filtered.map((item) => (
            <a className={`directory-list-row directory-list-row-${item.kind}`} href={`/${item.kind}/${item.id}`} key={item.id}>
              <span className="directory-list-media">{item.image ? <img src={item.image} alt="" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}</span>
              <span className="directory-list-main">
                <small>{item.eyebrow}</small>
                <strong>{item.name}</strong>
                <span>{item.username ? `@${item.username} · ` : ''}{item.description}</span>
              </span>
              <span className="directory-list-meta">
                {metaLabels.map((label) => (
                  <em key={label} data-label={label}>
                    <b>{getMetaValue(item, label)}</b>
                  </em>
                ))}
              </span>
              <ChevronRight size={18} className="directory-list-arrow" />
            </a>
          ))}
        </div>
      )}
      {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
    </>
  )
}
