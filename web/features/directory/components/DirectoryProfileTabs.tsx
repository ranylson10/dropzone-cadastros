'use client'

import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { DirectoryProfile } from '../types'

export function DirectoryProfileTabs({ sections }: { sections: DirectoryProfile['sections'] }) {
  const [active, setActive] = useState(sections[0]?.title || '')
  if (!sections.length) return null
  const section = sections.find((item) => item.title === active) || sections[0]

  return (
    <section className="directory-profile-tabs-shell">
      <div className="directory-profile-tabs" role="tablist">
        {sections.map((item) => (
          <button key={item.title} type="button" className={item.title === section.title ? 'active' : ''} onClick={() => setActive(item.title)}>
            {item.title}<span>{item.items.length}</span>
          </button>
        ))}
      </div>
      <div className="directory-profile-tab-panel">
        {section.items.length ? (
          <div className="directory-related-list">
            {section.items.map((item) => {
              const body = <><span>{item.image ? <img src={item.image} alt="" /> : item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}{item.meta?.length ? <em>{item.meta.map((meta) => `${meta.label}: ${meta.value}`).join(' · ')}</em> : null}</div>{item.href ? <ExternalLink size={15} /> : null}</>
              return item.href ? <a key={item.id} href={item.href}>{body}</a> : <article key={item.id}>{body}</article>
            })}
          </div>
        ) : <div className="directory-empty compact">Nenhuma informação cadastrada nesta seção.</div>}
      </div>
    </section>
  )
}
