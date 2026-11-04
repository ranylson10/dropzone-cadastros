'use client'

import { WorkspaceNav } from '@/components/workspace'

/** Horizontal scrolling tabs on desktop and mobile; the scorer is launched by the parent. */
export function ProducerCompetitionNavigation({ items, activeId, onChange }: {
  items: Array<{ id: string; label: string }>
  activeId: string
  onChange: (id: string) => void
}) {
  return <div className="producer-tools-horizontal">
    <WorkspaceNav ariaLabel="Seções do campeonato" activeId={activeId} items={items} onChange={onChange} />
  </div>
}
