'use client'

import { Select } from '@/components/ui/Field'
import { WorkspaceNav } from '@/components/workspace'

export function ProducerCompetitionNavigation({ items, activeId, onChange }: {
  items: Array<{ id: string; label: string }>
  activeId: string
  onChange: (id: string) => void
}) {
  return <>
    <div className="producer-tools-desktop">
      <p>Ferramentas do campeonato</p>
      <WorkspaceNav ariaLabel="Áreas do campeonato" activeId={activeId} items={items} onChange={onChange} />
    </div>
    <label className="producer-tools-mobile">Ferramenta do campeonato
      <Select aria-label="Ferramenta do campeonato" value={activeId} onChange={event => onChange(event.target.value)}>
        {!items.some(item => item.id === activeId) ? <option value={activeId}>Regras avançadas</option> : null}
        {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </Select>
    </label>
  </>
}
