'use client'

import { ChevronRight, Flame, Gift, Radio, Search, Ticket, Trophy, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
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

function ChampionshipCards({ items }: { items: DirectoryItem[] }) {
  return (
    <div className="directory-champ-card-grid">
      {items.map((item) => {
        const free = Number(item.commercial?.vagas_livres ?? 0)
        const hasPrize = Number(item.commercial?.premiacao || 0) > 0
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
            </span>
          </a>
        )
      })}
    </div>
  )
}

export function DirectoryListClient({ items }: { items: DirectoryItem[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return clean ? items.filter((item) => item.searchText.includes(clean)) : items
  }, [items, query])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])
  const isChampionshipDirectory = items[0]?.kind === 'campeonatos'

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
        <ChampionshipCards items={filtered} />
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
