'use client'

import { useRef } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

export type WorkspaceMoreItem = { id: string; label: string; detail?: string }

/** Ferramentas continuam acessíveis, mas fora do caminho principal. */
export function WorkspaceMoreMenu({
  items, activeId, onChange, label = 'Ferramentas',
}: {
  items: WorkspaceMoreItem[]
  activeId?: string
  onChange: (id: string) => void
  label?: string
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  if (!items.length) return null
  const active = items.some((item) => item.id === activeId)
  return (
    <details className={`dz-workspace-more ${active ? 'is-active' : ''}`} ref={detailsRef}>
      <summary><SlidersHorizontal size={16} aria-hidden="true" /><span>{label}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="dz-workspace-more__items" role="group" aria-label={label}>
        {items.map((item) => (
          <button type="button" key={item.id} aria-current={item.id === activeId ? 'page' : undefined}
            className={item.id === activeId ? 'is-active' : ''}
            onClick={() => { onChange(item.id); if (detailsRef.current) detailsRef.current.open = false }}>
            <strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}
          </button>
        ))}
      </div>
    </details>
  )
}
