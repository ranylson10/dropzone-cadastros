'use client'

import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { DirectoryProfile, DirectorySectionItem } from '../types'

function StructureTree({ items, depth = 0 }: { items: DirectorySectionItem[]; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // Fases (nível 0) abertas por padrão para o visitante ver os grupos
    const initial: Record<string, boolean> = {}
    if (depth === 0) {
      for (const item of items) {
        if (item.children?.length) initial[item.id] = true
      }
    }
    return initial
  })

  if (!items.length) {
    return <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>
  }

  return (
    <div className={`directory-structure depth-${depth}`}>
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length)
        const expanded = hasChildren && Boolean(open[item.id])

        return (
          <div
            key={item.id}
            className={`directory-structure-node status-${item.status || 'default'} depth-${depth}`}
          >
            <button
              type="button"
              className={`directory-structure-row ${hasChildren ? 'is-expandable' : ''} ${expanded ? 'is-open' : ''}`}
              onClick={() => {
                if (!hasChildren) return
                setOpen((current) => ({ ...current, [item.id]: !expanded }))
              }}
              aria-expanded={hasChildren ? expanded : undefined}
            >
              {hasChildren ? (
                <span className="directory-structure-chevron" aria-hidden>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              ) : (
                <span className="directory-structure-chevron spacer" aria-hidden />
              )}

              {item.badge ? (
                <span className="directory-structure-badge">{item.badge}</span>
              ) : item.image ? (
                <span className="directory-structure-avatar">
                  <img src={item.image} alt="" />
                </span>
              ) : depth === 0 ? (
                <span className="directory-structure-avatar initials">
                  {item.title.slice(0, 2).toUpperCase()}
                </span>
              ) : depth === 1 ? (
                <span className="directory-structure-folder" aria-hidden />
              ) : (
                <span className="directory-structure-dot" aria-hidden />
              )}

              {item.image && item.badge ? (
                <span className="directory-structure-avatar compact">
                  <img src={item.image} alt="" />
                </span>
              ) : null}

              <span className="directory-structure-copy">
                <strong>{item.title}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
                {item.meta?.length ? (
                  <em>{item.meta.map((meta) => `${meta.label}: ${meta.value}`).join(' · ')}</em>
                ) : null}
              </span>

              {item.status === 'livre' ? (
                <span className="directory-structure-pill livre">Livre</span>
              ) : item.status === 'ocupada' ? (
                <span className="directory-structure-pill ocupada">Ocupado</span>
              ) : null}

              {hasChildren ? (
                <span className="directory-structure-count">{item.children!.length}</span>
              ) : null}
            </button>

            {hasChildren && expanded ? (
              <div className="directory-structure-children">
                <StructureTree items={item.children!} depth={depth + 1} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function DirectoryProfileTabs({ sections }: { sections: DirectoryProfile['sections'] }) {
  const [active, setActive] = useState(sections[0]?.title || '')
  if (!sections.length) return null
  const section = sections.find((item) => item.title === active) || sections[0]

  return (
    <section className="directory-profile-tabs-shell">
      <div className="directory-profile-tabs" role="tablist">
        {sections.map((item) => (
          <button
            key={item.title}
            type="button"
            className={item.title === section.title ? 'active' : ''}
            onClick={() => setActive(item.title)}
          >
            {item.title}
            <span>{item.items.length}</span>
          </button>
        ))}
      </div>
      <div className="directory-profile-tab-panel">
        {section.layout === 'structure' ? (
          <StructureTree items={section.items} />
        ) : section.items.length ? (
          <div className="directory-related-list">
            {section.items.map((item) => {
              const body = (
                <>
                  <span>
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      item.title.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.subtitle ? <small>{item.subtitle}</small> : null}
                    {item.meta?.length ? (
                      <em>{item.meta.map((meta) => `${meta.label}: ${meta.value}`).join(' · ')}</em>
                    ) : null}
                  </div>
                  {item.href ? <ExternalLink size={15} /> : null}
                </>
              )
              return item.href ? (
                <a key={item.id} href={item.href}>
                  {body}
                </a>
              ) : (
                <article key={item.id}>{body}</article>
              )
            })}
          </div>
        ) : (
          <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>
        )}
      </div>
    </section>
  )
}
