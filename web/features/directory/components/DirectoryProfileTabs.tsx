'use client'

import { ChevronDown, ChevronRight, ExternalLink, Users } from 'lucide-react'
import { useState } from 'react'
import { AgendaCalendar } from '@/features/agenda'
import type { DirectoryProfile, DirectorySectionItem } from '../types'

/** Slot no padrão da aba Equipes (SLOT + avatar + nome + detalhe). */
export function SlotVagaRow({ item }: { item: DirectorySectionItem }) {
  const status = item.status === 'ocupada' ? 'ocupada' : item.status === 'reservada' ? 'reservada' : 'livre'
  const letter = item.badge || '?'

  return (
    <article className={`championship-vaga-row status-${status} directory-public-slot`}>
      <div className="vaga-row-summary is-static">
        <span className="vaga-row-number">{letter}</span>
        <span className={`vaga-row-avatar status-${status}`} aria-hidden>
          {status === 'ocupada' && item.image ? (
            <img src={item.image} alt="" />
          ) : status === 'ocupada' ? (
            <Users size={18} />
          ) : (
            <span className="vaga-avatar-dot" />
          )}
        </span>
        <span className="vaga-row-identity">
          <strong>{item.title}</strong>
          {item.subtitle ? <small>{item.subtitle}</small> : null}
        </span>
        <span className="vaga-row-meta" />
        <span className="vaga-row-chevron" aria-hidden />
      </div>
    </article>
  )
}

export function StructureTree({ items, depth = 0 }: { items: DirectorySectionItem[]; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    if (depth === 0) {
      for (const item of items) {
        if (item.children?.length) initial[item.id] = true
      }
    }
    // Grupos abertos por padrão no nível 1 (ver slots direto)
    if (depth === 1) {
      for (const item of items) {
        if (item.children?.length) initial[item.id] = true
      }
    }
    return initial
  })

  if (!items.length) {
    return <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>
  }

  // Lista de slots: mesmo visual da aba Equipes
  const allSlots = items.every((item) => !item.children?.length && item.badge)
  if (allSlots) {
    return (
      <div className="championship-vagas-list directory-public-slots">
        {items.map((item) => (
          <SlotVagaRow key={item.id} item={item} />
        ))}
      </div>
    )
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

              {depth === 0 ? (
                <span className="directory-structure-avatar initials">
                  {item.title.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <span className="directory-structure-folder" aria-hidden />
              )}

              <span className="directory-structure-copy">
                <strong>{item.title}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </span>

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

export function renderSectionItems(items: DirectorySectionItem[]) {
  return (
    <div className="directory-related-list">
      {items.map((item) => {
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
  )
}

export function DirectoryProfileTabs({
  sections,
  agenda,
}: {
  sections: DirectoryProfile['sections']
  /** Agenda embutida (ex.: dias de jogo da equipe) */
  agenda?: {
    title: string
    scope: 'equipe' | 'campeonato' | 'me'
    scopeId: string
    tabLabel?: string
  } | null
}) {
  const tabTitles = [
    ...sections.map((item) => item.title),
    ...(agenda ? [agenda.tabLabel || 'Agenda'] : []),
  ]
  const [active, setActive] = useState(tabTitles[0] || '')
  if (!tabTitles.length) return null

  const agendaLabel = agenda?.tabLabel || 'Agenda'
  const isAgenda = Boolean(agenda && active === agendaLabel)
  const section = sections.find((item) => item.title === active) || sections[0]

  return (
    <section className="directory-profile-tabs-shell">
      <div className="directory-profile-tabs" role="tablist">
        {sections.map((item) => (
          <button
            key={item.title}
            type="button"
            className={!isAgenda && item.title === section?.title ? 'active' : ''}
            onClick={() => setActive(item.title)}
          >
            {item.title}
            <span>{item.items.length}</span>
          </button>
        ))}
        {agenda ? (
          <button
            type="button"
            className={isAgenda ? 'active' : ''}
            onClick={() => setActive(agendaLabel)}
          >
            {agendaLabel}
          </button>
        ) : null}
      </div>
      <div className="directory-profile-tab-panel">
        {isAgenda && agenda ? (
          <AgendaCalendar
            title={agenda.title}
            scope={agenda.scope}
            scopeId={agenda.scopeId}
            canCreate
            compact
          />
        ) : section?.layout === 'structure' ? (
          <StructureTree items={section.items} />
        ) : section?.items.length ? (
          renderSectionItems(section.items)
        ) : (
          <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>
        )}
      </div>
    </section>
  )
}
