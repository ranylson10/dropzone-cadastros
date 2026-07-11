'use client'

import { Search, ArrowUpRight } from 'lucide-react'
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
      <label className="directory-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, tag, ID ou localidade..." /></label>
      <div className="directory-result-count">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</div>
      <div className="directory-grid">
        {filtered.map((item) => (
          <a className="directory-card" href={`/${item.kind}/${item.id}`} key={item.id}>
            <span className="directory-card-media">{item.image ? <img src={item.image} alt="" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}</span>
            <span className="directory-card-content">
              <small>{item.eyebrow}</small><strong>{item.name}</strong>
              {item.username ? <span>@{item.username}</span> : null}
              <p>{item.description}</p>
              <span className="directory-card-meta">{item.meta.slice(0, 3).map((meta) => <em key={meta.label}><small>{meta.label}</small><b>{meta.value}</b></em>)}</span>
            </span>
            <ArrowUpRight size={20} className="directory-card-arrow" />
          </a>
        ))}
      </div>
      {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
    </>
  )
}
