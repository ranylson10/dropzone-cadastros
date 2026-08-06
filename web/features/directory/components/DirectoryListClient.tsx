'use client'

import { Search, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DirectoryItem } from '../types'

function getMetaLabels(items: DirectoryItem[]) {
  const firstWithMeta = items.find((item) => item.meta?.length)
  return (firstWithMeta?.meta || []).slice(0, 3).map((meta) => meta.label)
}

export function DirectoryListClient({ items }: { items: DirectoryItem[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return clean ? items.filter((item) => item.searchText.includes(clean)) : items
  }, [items, query])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])

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

      {filtered.length ? (
        <div className="directory-list-head" aria-hidden="true">
          <span className="directory-list-head-main">Perfil</span>
          <span className="directory-list-head-meta">
            {metaLabels.map((label) => (
              <em key={label}>{label}</em>
            ))}
          </span>
        </div>
      ) : null}

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
              {item.meta.slice(0, 3).map((meta) => (
                <em key={meta.label} data-label={meta.label}>
                  <b>{meta.value}</b>
                </em>
              ))}
            </span>
            <ChevronRight size={18} className="directory-list-arrow" />
          </a>
        ))}
      </div>
      {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
    </>
  )
}
