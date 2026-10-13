import { useState } from 'react'
import { MobileSection } from '../../web/components/layout/MobileSection'
import { Field, Input } from '../../web/components/ui/Field'

export function MobileSectionFixture() {
  const [name, setName] = useState('')
  return <main className="dz-unified-workspace-page">
    <MobileSection title="Séries e divisões" className="advanced-card">
      <Field label="Nome da série"><Input value={name} onChange={event => setName(event.target.value)} /></Field>
    </MobileSection>
    <MobileSection title="Etapas" className="advanced-card">
      <Field label="Nome da etapa"><Input /></Field>
    </MobileSection>
    <button type="button">Depois das seções</button>
  </main>
}
