'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download, Loader2, Shuffle, Users, X } from 'lucide-react'

type Props = {
  championshipId: string
  phases: Array<Record<string, any>>
  groups: Array<Record<string, any>>
  slots: Array<Record<string, any>>
  canManage: boolean
  request: (url: string, options?: RequestInit) => Promise<any>
  onChanged: () => Promise<void>
  onFeedback: (message: string) => void
}

export function LiliPhaseDistributor({ championshipId, phases, groups, slots, canManage, request, onChanged, onFeedback }: Props) {
  const [open, setOpen] = useState(false)
  const [phaseId, setPhaseId] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [strategy, setStrategy] = useState<'balanced' | 'random'>('balanced')
  const [running, setRunning] = useState(false)

  const phaseGroups = useMemo(() => groups.filter((group) => String(group.fase_id) === phaseId), [groups, phaseId])
  const selectedSlots = useMemo(() => slots.filter((slot) => selectedGroups.includes(String(slot.grupo_id))), [slots, selectedGroups])
  const occupied = selectedSlots.filter((slot) => slot.equipe_id || slot.line_id)

  useEffect(() => {
    if (!phaseId && phases.length) setPhaseId(String(phases[0].id))
  }, [phaseId, phases])

  useEffect(() => {
    setSelectedGroups(phaseGroups.map((group) => String(group.id)))
  }, [phaseId])

  if (!canManage || phases.length === 0) return null

  function toggleGroup(groupId: string) {
    setSelectedGroups((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId])
  }

  function distributionText() {
    const lines = [`Distribuição — ${phases.find((phase) => String(phase.id) === phaseId)?.nome || 'Fase'}`]
    for (const group of phaseGroups.filter((item) => selectedGroups.includes(String(item.id)))) {
      const groupSlots = slots.filter((slot) => String(slot.grupo_id) === String(group.id)).sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
      lines.push('', String(group.nome || 'Grupo'))
      for (const slot of groupSlots) lines.push(`${String(slot.slot_numero || '?').padStart(2, '0')} — ${slot.line_nome || slot.equipe_nome || 'Livre'}`)
    }
    return lines.join('\n')
  }

  async function copyDistribution() {
    try {
      await navigator.clipboard.writeText(distributionText())
      onFeedback('Distribuição copiada para a área de transferência.')
    } catch {
      onFeedback('Não foi possível copiar automaticamente. Tente exportar o arquivo.')
    }
  }

  function exportDistribution() {
    const blob = new Blob([distributionText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `distribuicao-${phaseId || 'fase'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function distribute() {
    if (selectedGroups.length < 2) return onFeedback('Selecione pelo menos dois grupos.')
    if (occupied.length < 2) return onFeedback('É necessário ter pelo menos duas equipes nos grupos selecionados.')
    const label = strategy === 'balanced' ? 'equilibradamente' : 'aleatoriamente'
    if (!window.confirm(`Distribuir ${occupied.length} equipes ${label} entre ${selectedGroups.length} grupos? A posição atual será substituída.`)) return
    setRunning(true)
    try {
      const payload = await request(`/api/campeonatos/${championshipId}/equipes`, {
        method: 'PATCH',
        body: JSON.stringify({ mode: 'distribute_phase', phase_id: phaseId, group_ids: selectedGroups, strategy }),
      })
      onFeedback(payload?.mensagem || 'Equipes distribuídas com sucesso.')
      await onChanged()
    } catch (error: any) {
      onFeedback(error?.message || 'Não foi possível distribuir as equipes.')
    } finally {
      setRunning(false)
    }
  }

  return <section className="lili-phase-distributor">
    <button type="button" className="lili-phase-distributor-toggle" onClick={() => setOpen((value) => !value)}><Shuffle size={17} /> Distribuir equipes entre grupos {open ? <X size={16} /> : null}</button>
    {open ? <div className="lili-phase-distributor-panel">
      <div className="lili-phase-distributor-head"><div><strong>Distribuição automática</strong><span>Organize todas as equipes de uma fase entre vários grupos em uma única ação.</span></div><div className="lili-phase-export"><button type="button" onClick={() => void copyDistribution()}><Copy size={15} /> Copiar lista</button><button type="button" onClick={exportDistribution}><Download size={15} /> Exportar</button></div></div>
      <div className="lili-phase-distributor-controls">
        <label>Fase<select value={phaseId} onChange={(event) => setPhaseId(event.target.value)}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label>
        <label>Método<select value={strategy} onChange={(event) => setStrategy(event.target.value as 'balanced' | 'random')}><option value="balanced">Equilibrado entre grupos</option><option value="random">Totalmente aleatório</option></select></label>
      </div>
      <div className="lili-phase-groups-select">{phaseGroups.map((group) => {
        const groupId = String(group.id)
        const groupSlots = slots.filter((slot) => String(slot.grupo_id) === groupId)
        const count = groupSlots.filter((slot) => slot.equipe_id || slot.line_id).length
        const active = selectedGroups.includes(groupId)
        return <button type="button" key={groupId} className={active ? 'active' : ''} onClick={() => toggleGroup(groupId)}><span>{active ? <Check size={14} /> : null}{group.nome}</span><small>{count}/{groupSlots.length || group.slots || 0}</small></button>
      })}</div>
      <div className="lili-phase-distributor-summary"><div><Users size={17} /><span><strong>{occupied.length}</strong> equipes</span></div><div><span><strong>{selectedGroups.length}</strong> grupos</span></div><div><span><strong>{selectedSlots.length}</strong> slots disponíveis</span></div><button type="button" onClick={() => void distribute()} disabled={running || selectedGroups.length < 2 || occupied.length < 2}>{running ? <Loader2 className="spin" size={16} /> : <Shuffle size={16} />} {running ? 'Distribuindo…' : 'Executar distribuição'}</button></div>
    </div> : null}
  </section>
}
