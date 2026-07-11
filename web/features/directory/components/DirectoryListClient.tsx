'use client'

import { Search, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DirectoryItem } from '../types'

export function DirectoryListClient({ items }: { items: DirectoryItem[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return clean ? items.filter((item) => item.searchText.includes(clean)) : items
  }, [items, query])

  return (
    <>
      <div className="directory-toolbar">
        <label className="directory-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, tag, ID ou localidade..." /></label>
        <div className="directory-result-count">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</div>
      </div>
      <div className="directory-list">
        {filtered.map((item) => (
          <a className="directory-list-row" href={`/${item.kind}/${item.id}`} key={item.id}>
            <span className="directory-list-media">{item.image ? <img src={item.image} alt="" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}</span>
            <span className="directory-list-main">
              <small>{item.eyebrow}</small>
              <strong>{item.name}</strong>
              <span>{item.username ? `@${item.username} · ` : ''}{item.description}</span>
            </span>
            <span className="directory-list-meta">
              {item.meta.slice(0, 3).map((meta) => <em key={meta.label}><small>{meta.label}</small><b>{meta.value}</b></em>)}
            </span>
            <ChevronRight size={18} className="directory-list-arrow" />
          </a>
        ))}
      </div>
      {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
    </>
  )
}
