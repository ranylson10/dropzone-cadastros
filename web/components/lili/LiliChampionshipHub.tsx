'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRightLeft, CalendarDays, ChevronRight, CirclePlus, ExternalLink, Link2, Loader2, Minus, Pencil, Plus, RefreshCw, Save, Search, Shield, Shuffle, Sparkles, Swords, Trash2, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { LiliGamesManager } from './LiliGamesManager'
import { LiliPhaseDistributor } from './LiliPhaseDistributor'

type ChampionshipItem = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status?: string | null
  relationship: 'admin' | 'participant'
  permission?: Record<string, any> | null
  registrations?: Array<Record<string, any>>
}

type BulkGroupDraft = { id: string; nome: string; slots: number }
type BulkPhaseDraft = { id: string; nome: string; ordem: number; grupos: BulkGroupDraft[] }
type EditPhaseDraft = { id: string; nome: string; ordem: number }
type EditGroupDraft = { id: string; nome: string; slots: number }

type Structure = {
  campeonato?: Record<string, any>
  fases?: Array<Record<string, any>>
  grupos?: Array<Record<string, any>>
  slots?: Array<Record<string, any>>
  jogos?: Array<Record<string, any>>
  resumo?: Record<string, number>
  permission?: Record<string, any>
}

export function LiliChampionshipHub({ accessToken }: { accessToken?: string | null }) {
  const [items, setItems] = useState<ChampionshipItem[]>([])
  const [selected, setSelected] = useState<ChampionshipItem | null>(null)
  const [structure, setStructure] = useState<Structure | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [activePhase, setActivePhase] = useState<string>('all')
  const [creating, setCreating] = useState<'phase' | 'group' | 'bulk' | null>(null)
  const [bulkPhases, setBulkPhases] = useState<BulkPhaseDraft[]>([])
  const [savingBulk, setSavingBulk] = useState(false)
  const [managingStructure, setManagingStructure] = useState(false)
  const [editPhases, setEditPhases] = useState<Record<string, EditPhaseDraft>>({})
  const [editGroups, setEditGroups] = useState<Record<string, EditGroupDraft>>({})
  const [savingEntity, setSavingEntity] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [slotManagerGroup, setSlotManagerGroup] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slotSearch, setSlotSearch] = useState('')
  const [teamResults, setTeamResults] = useState<Array<Record<string, any>>>([])
  const [searchingTeams, setSearchingTeams] = useState(false)
  const [slotAction, setSlotAction] = useState<string | null>(null)
  const [moveSourceSlotId, setMoveSourceSlotId] = useState<string | null>(null)

  async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a ação.')
    return payload
  }

  async function loadItems() {
    if (!accessToken) return
    setLoading(true); setError('')
    try {
      const payload = await request('/api/lili/campeonatos')
      setItems(payload.items || [])
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar seus campeonatos.')
    } finally { setLoading(false) }
  }

  async function openChampionship(item: ChampionshipItem) {
    setSelected(item); setStructure(null); setDetailLoading(true); setError(''); setActivePhase('all')
    try {
      const payload = await request(`/api/campeonatos/${item.id}/estrutura`)
      setStructure(payload)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a estrutura do campeonato.')
    } finally { setDetailLoading(false) }
  }

  useEffect(() => { void loadItems() }, [accessToken])

  const phases = structure?.fases || []
  const groups = structure?.grupos || []
  const slots = structure?.slots || []
  const games = structure?.jogos || []
  const visibleGroups = useMemo(() => activePhase === 'all' ? groups : groups.filter((group) => String(group.fase_id) === activePhase), [groups, activePhase])


  function createDraftId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function openBulkBuilder() {
    if (creating === 'bulk') {
      setCreating(null)
      return
    }
    setBulkPhases([{
      id: createDraftId('phase'),
      nome: phases.length ? '' : 'Fase classificatória',
      ordem: phases.length + 1,
      grupos: [{ id: createDraftId('group'), nome: 'Grupo A', slots: 12 }],
    }])
    setCreating('bulk')
    setFeedback('')
  }

  function updateBulkPhase(phaseId: string, patch: Partial<BulkPhaseDraft>) {
    setBulkPhases((current) => current.map((phase) => phase.id === phaseId ? { ...phase, ...patch } : phase))
  }

  function addBulkPhase() {
    setBulkPhases((current) => [...current, {
      id: createDraftId('phase'),
      nome: '',
      ordem: phases.length + current.length + 1,
      grupos: [{ id: createDraftId('group'), nome: 'Grupo A', slots: 12 }],
    }])
  }

  function removeBulkPhase(phaseId: string) {
    setBulkPhases((current) => current.filter((phase) => phase.id !== phaseId))
  }

  function addBulkGroup(phaseId: string) {
    setBulkPhases((current) => current.map((phase) => {
      if (phase.id !== phaseId) return phase
      const letter = String.fromCharCode(65 + phase.grupos.length)
      return { ...phase, grupos: [...phase.grupos, { id: createDraftId('group'), nome: `Grupo ${letter}`, slots: 12 }] }
    }))
  }

  function updateBulkGroup(phaseId: string, groupId: string, patch: Partial<BulkGroupDraft>) {
    setBulkPhases((current) => current.map((phase) => phase.id === phaseId
      ? { ...phase, grupos: phase.grupos.map((group) => group.id === groupId ? { ...group, ...patch } : group) }
      : phase))
  }

  function removeBulkGroup(phaseId: string, groupId: string) {
    setBulkPhases((current) => current.map((phase) => phase.id === phaseId
      ? { ...phase, grupos: phase.grupos.filter((group) => group.id !== groupId) }
      : phase))
  }

  async function createBulkStructure() {
    if (!selected || !bulkPhases.length) return
    const invalidPhase = bulkPhases.find((phase) => !phase.nome.trim() || !phase.grupos.length)
    const invalidGroup = bulkPhases.flatMap((phase) => phase.grupos).find((group) => !group.nome.trim() || group.slots < 1)
    if (invalidPhase || invalidGroup) {
      setFeedback('Preencha o nome de todas as fases e grupos e mantenha ao menos um grupo por fase.')
      return
    }
    setSavingBulk(true)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_bulk',
          fases: bulkPhases.map((phase) => ({
            nome: phase.nome.trim(),
            ordem: phase.ordem,
            grupos: phase.grupos.map((group) => ({ nome: group.nome.trim(), slots: group.slots })),
          })),
        }),
      })
      setCreating(null)
      setBulkPhases([])
      setFeedback('Estrutura criada com sucesso: fases, grupos e slots já estão prontos.')
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível criar a estrutura completa.')
    } finally {
      setSavingBulk(false)
    }
  }


  function openStructureManager() {
    if (managingStructure) {
      setManagingStructure(false)
      return
    }
    setEditPhases(Object.fromEntries(phases.map((phase) => [String(phase.id), {
      id: String(phase.id),
      nome: String(phase.nome || ''),
      ordem: Number(phase.ordem || 1),
    }])))
    setEditGroups(Object.fromEntries(groups.map((group) => [String(group.id), {
      id: String(group.id),
      nome: String(group.nome || ''),
      slots: Number(group.slots_total || group.slots || 12),
    }])))
    setManagingStructure(true)
    setCreating(null)
    setFeedback('')
  }

  async function savePhase(phaseId: string) {
    if (!selected) return
    const draft = editPhases[phaseId]
    if (!draft?.nome.trim()) {
      setFeedback('Informe o nome da fase.')
      return
    }
    setSavingEntity(`phase:${phaseId}`)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, {
        method: 'PATCH',
        body: JSON.stringify({ entity: 'phase', id: phaseId, nome: draft.nome.trim(), ordem: draft.ordem }),
      })
      setFeedback('Fase atualizada com sucesso.')
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível atualizar a fase.')
    } finally {
      setSavingEntity(null)
    }
  }

  async function saveGroup(groupId: string) {
    if (!selected) return
    const draft = editGroups[groupId]
    if (!draft?.nome.trim()) {
      setFeedback('Informe o nome do grupo.')
      return
    }
    setSavingEntity(`group:${groupId}`)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, {
        method: 'PATCH',
        body: JSON.stringify({ entity: 'group', id: groupId, nome: draft.nome.trim(), slots: draft.slots }),
      })
      setFeedback('Grupo e quantidade de slots atualizados.')
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível atualizar o grupo.')
    } finally {
      setSavingEntity(null)
    }
  }

  async function deleteStructureEntity(entity: 'phase' | 'group', entityId: string, label: string) {
    if (!selected) return
    const confirmed = window.confirm(`Excluir ${label}? Esta ação só será permitida se não houver equipes nos slots.`)
    if (!confirmed) return
    setSavingEntity(`${entity}:${entityId}`)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, {
        method: 'DELETE',
        body: JSON.stringify({ entity, id: entityId }),
      })
      setFeedback(`${entity === 'phase' ? 'Fase' : 'Grupo'} excluído com sucesso.`)
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível excluir a estrutura.')
    } finally {
      setSavingEntity(null)
    }
  }

  async function createPhase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'POST', body: JSON.stringify({ action: 'create_phase', nome: form.get('nome'), ordem: Number(form.get('ordem') || phases.length + 1) }) })
      setCreating(null); setFeedback('Fase criada com sucesso.'); await openChampionship(selected)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível criar a fase.') }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'POST', body: JSON.stringify({ action: 'create_group', nome: form.get('nome'), fase_id: form.get('fase_id'), slots: Number(form.get('slots') || 12) }) })
      setCreating(null); setFeedback('Grupo e slots criados com sucesso.'); await openChampionship(selected)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível criar o grupo.') }
  }


  async function searchTeams() {
    if (!selected || slotSearch.trim().length < 2) {
      setTeamResults([])
      return
    }
    setSearchingTeams(true)
    setFeedback('')
    try {
      const payload = await request(`/api/campeonatos/${selected.id}/equipes/busca?q=${encodeURIComponent(slotSearch.trim())}`)
      setTeamResults(payload.equipes || [])
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível buscar equipes.')
    } finally {
      setSearchingTeams(false)
    }
  }

  async function assignLineToSlot(slotId: string, equipeId: string, lineId: string) {
    if (!selected) return
    setSlotAction(`assign:${slotId}:${lineId}`)
    setFeedback('')
    try {
      const payload = await request(`/api/campeonatos/${selected.id}/equipes`, {
        method: 'POST',
        body: JSON.stringify({ slot_id: slotId, equipe_id: equipeId, line_id: lineId }),
      })
      setFeedback(payload?.mensagem || 'Equipe adicionada ao slot.')
      setTeamResults([])
      setSlotSearch('')
      setSelectedSlotId(null)
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível adicionar a equipe ao slot.')
    } finally {
      setSlotAction(null)
    }
  }

  async function moveTeamToSlot(targetSlotId: string, swap = false) {
    if (!selected || !moveSourceSlotId || moveSourceSlotId === targetSlotId) return
    setSlotAction(`move:${moveSourceSlotId}:${targetSlotId}`)
    setFeedback('')
    try {
      const payload = await request(`/api/campeonatos/${selected.id}/equipes`, {
        method: 'PATCH',
        body: JSON.stringify({ source_slot_id: moveSourceSlotId, target_slot_id: targetSlotId, mode: swap ? 'swap' : 'move' }),
      })
      setFeedback(payload?.mensagem || (swap ? 'Equipes trocadas de posição.' : 'Equipe movida para o novo slot.'))
      setMoveSourceSlotId(null)
      setSelectedSlotId(null)
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || (swap ? 'Não foi possível trocar as equipes.' : 'Não foi possível mover a equipe.'))
    } finally {
      setSlotAction(null)
    }
  }

  async function shuffleGroupSlots(group: Record<string, any>, groupSlots: Array<Record<string, any>>) {
    if (!selected) return
    const occupiedCount = groupSlots.filter((slot) => slot.equipe_id || slot.line_id).length
    if (occupiedCount < 2) {
      setFeedback('É necessário ter pelo menos duas equipes no grupo para realizar o sorteio.')
      return
    }
    const confirmed = window.confirm(`Sortear novamente a posição das ${occupiedCount} equipes de ${group.nome || 'este grupo'}? Os slots serão reorganizados aleatoriamente.`)
    if (!confirmed) return
    setSlotAction(`shuffle:${group.id}`)
    setFeedback('')
    try {
      const payload = await request(`/api/campeonatos/${selected.id}/equipes`, {
        method: 'PATCH',
        body: JSON.stringify({ mode: 'shuffle_group', group_id: String(group.id) }),
      })
      setFeedback(payload?.mensagem || 'Slots sorteados com sucesso.')
      setMoveSourceSlotId(null)
      setSelectedSlotId(null)
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível sortear os slots do grupo.')
    } finally {
      setSlotAction(null)
    }
  }

  async function freeOccupiedSlot(slot: Record<string, any>) {
    if (!selected || !slot.participacao_id) return
    const confirmed = window.confirm(`Liberar o slot ${slot.slot_numero || ''} ocupado por ${slot.line_nome || slot.equipe_nome || 'esta equipe'}?`)
    if (!confirmed) return
    setSlotAction(`remove:${slot.id}`)
    setFeedback('')
    try {
      await request(`/api/campeonatos/${selected.id}/equipes?participacao_id=${encodeURIComponent(String(slot.participacao_id))}`, { method: 'DELETE' })
      setFeedback('Slot liberado com sucesso.')
      await openChampionship(selected)
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível liberar o slot.')
    } finally {
      setSlotAction(null)
    }
  }

  function toggleSlotManager(groupId: string) {
    setSlotManagerGroup((current) => current === groupId ? null : groupId)
    setSelectedSlotId(null)
    setSlotSearch('')
    setTeamResults([])
    setFeedback('')
  }

  async function generateLink(group: Record<string, any>) {
    if (!selected) return
    const freeSlots = slots.filter((slot) => String(slot.grupo_id) === String(group.id) && !slot.equipe_id && !slot.line_id).length
    setFeedback('')
    try {
      const payload = await request('/api/dropzone', { method: 'POST', body: JSON.stringify({ entity_type: 'registration_link', parent_id: selected.id, generate_token: true, data: { campeonato_id: selected.id, grupo_id: group.id, fase_id: group.fase_id || null, limite_vagas: Math.max(1, freeSlots), acompanhamento_publico: true } }) })
      const url = payload?.row?.data?.public_url_full || payload?.data?.public_url_full || payload?.public_url_full
      if (!url) throw new Error('O link foi criado, mas a URL não retornou.')
      await navigator.clipboard.writeText(url)
      setFeedback(`Link de ${group.nome} criado e copiado.`)
    } catch (err: any) { setFeedback(err?.message || 'Não foi possível gerar o link.') }
  }

  if (!accessToken) return <div className="lili-champ-empty"><Shield size={30} /><strong>Entre na sua conta</strong><span>Seus campeonatos, grupos e slots aparecem aqui após o login.</span><a href="/login?returnTo=%2Flili">Entrar</a></div>

  if (!selected) return (
    <section className="lili-champ-hub">
      <div className="lili-champ-toolbar"><div><strong>Meus campeonatos</strong><span>Todos os campeonatos em que você participa ou administra.</span></div><button type="button" onClick={() => void loadItems()} aria-label="Atualizar"><RefreshCw size={17} /></button></div>
      {loading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando campeonatos…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {!loading && !items.length ? <div className="lili-champ-empty"><Trophy size={30} /><strong>Nenhum campeonato encontrado</strong><span>Quando sua equipe entrar em um grupo ou você criar um campeonato, ele aparecerá aqui.</span><a href="/campeonatos">Explorar campeonatos</a></div> : null}
      <div className="lili-champ-list">{items.map((item) => {
        const registration = item.registrations?.[0]
        return <button type="button" key={item.id} className="lili-champ-list-item" onClick={() => void openChampionship(item)}>
          <span className="lili-champ-logo">{item.logo_url || item.banner_url ? <img src={item.logo_url || item.banner_url || ''} alt="" /> : <Trophy size={22} />}</span>
          <span className="lili-champ-list-copy"><strong>{item.nome}</strong><small>{registration?.grupo_nome ? `${registration.grupo_nome}${registration.slot_numero ? ` · Slot ${registration.slot_numero}` : ''}` : item.relationship === 'admin' ? 'Acesso administrativo' : 'Participante'} </small><span>{item.tipo || 'Campeonato'} · {item.status || 'ativo'}</span></span>
          <span className={`lili-champ-role ${item.relationship}`}>{item.relationship === 'admin' ? 'Admin' : 'Minha equipe'}</span><ChevronRight size={18} />
        </button>
      })}</div>
    </section>
  )

  return (
    <section className="lili-champ-hub detail">
      <div className="lili-champ-detail-head"><button type="button" onClick={() => { setSelected(null); setStructure(null); setFeedback('') }}><ArrowLeft size={18} /> Voltar</button><a href={`/campeonatos/${selected.id}`}><ExternalLink size={16} /> Painel completo</a></div>
      <div className="lili-champ-title"><span className="lili-champ-logo large">{selected.logo_url || selected.banner_url ? <img src={selected.logo_url || selected.banner_url || ''} alt="" /> : <Trophy size={25} />}</span><div><strong>{selected.nome}</strong><span>{selected.tipo || 'Campeonato'} · {selected.status || 'ativo'}</span></div></div>
      {detailLoading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando estrutura…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {feedback ? <div className="lili-champ-feedback">{feedback}</div> : null}
      {structure ? <>
        <div className="lili-champ-metrics"><div><span>Fases</span><strong>{phases.length}</strong></div><div><span>Grupos</span><strong>{groups.length}</strong></div><div><span>Slots ocupados</span><strong>{slots.filter((slot) => slot.equipe_id || slot.line_id).length}/{slots.length}</strong></div><div><span>Jogos</span><strong>{games.length}</strong></div></div>
        {structure.permission?.canOrganizeGroups ? <div className="lili-champ-admin-actions"><button type="button" className="primary" onClick={openBulkBuilder}><Sparkles size={17} /> Montagem rápida</button><button type="button" onClick={openStructureManager}><Pencil size={17} /> Gerenciar estrutura</button><button type="button" onClick={() => { setManagingStructure(false); setCreating(creating === 'phase' ? null : 'phase') }}><CirclePlus size={17} /> Criar fase</button><button type="button" onClick={() => { setManagingStructure(false); setCreating(creating === 'group' ? null : 'group') }} disabled={!phases.length}><Users size={17} /> Criar grupo</button></div> : null}


        {managingStructure ? <div className="lili-structure-manager">
          <div className="lili-structure-manager-head"><div><strong>Gerenciar estrutura</strong><span>Edite nomes, ordem e quantidade de slots. Estruturas com equipes não podem ser excluídas.</span></div><button type="button" onClick={() => setManagingStructure(false)}><X size={16} /> Fechar</button></div>
          <div className="lili-structure-phase-list">{phases.map((phase) => {
            const phaseId = String(phase.id)
            const phaseDraft = editPhases[phaseId] || { id: phaseId, nome: String(phase.nome || ''), ordem: Number(phase.ordem || 1) }
            const phaseGroups = groups.filter((group) => String(group.fase_id) === phaseId)
            return <section className="lili-structure-phase" key={phaseId}>
              <div className="lili-structure-phase-row">
                <label>Fase<input value={phaseDraft.nome} onChange={(event) => setEditPhases((current) => ({ ...current, [phaseId]: { ...phaseDraft, nome: event.target.value } }))} /></label>
                <label>Ordem<input type="number" min="1" value={phaseDraft.ordem} onChange={(event) => setEditPhases((current) => ({ ...current, [phaseId]: { ...phaseDraft, ordem: Math.max(1, Number(event.target.value || 1)) } }))} /></label>
                <button type="button" className="save" onClick={() => void savePhase(phaseId)} disabled={savingEntity === `phase:${phaseId}`}><Save size={15} /> Salvar</button>
                <button type="button" className="danger" onClick={() => void deleteStructureEntity('phase', phaseId, `a fase ${phase.nome}`)} disabled={savingEntity === `phase:${phaseId}`}><Trash2 size={15} /></button>
              </div>
              <div className="lili-structure-groups">{phaseGroups.map((group) => {
                const groupId = String(group.id)
                const groupDraft = editGroups[groupId] || { id: groupId, nome: String(group.nome || ''), slots: Number(group.slots_total || group.slots || 12) }
                return <div className="lili-structure-group-row" key={groupId}>
                  <label>Grupo<input value={groupDraft.nome} onChange={(event) => setEditGroups((current) => ({ ...current, [groupId]: { ...groupDraft, nome: event.target.value } }))} /></label>
                  <label>Slots<input type="number" min="1" max="52" value={groupDraft.slots} onChange={(event) => setEditGroups((current) => ({ ...current, [groupId]: { ...groupDraft, slots: Math.max(1, Math.min(52, Number(event.target.value || 1))) } }))} /></label>
                  <span>{Number(group.slots_ocupados || 0)} ocupado(s)</span>
                  <button type="button" className="save" onClick={() => void saveGroup(groupId)} disabled={savingEntity === `group:${groupId}`}><Save size={15} /> Salvar</button>
                  <button type="button" className="danger" onClick={() => void deleteStructureEntity('group', groupId, `o grupo ${group.nome}`)} disabled={savingEntity === `group:${groupId}`}><Trash2 size={15} /></button>
                </div>
              })}</div>
            </section>
          })}</div>
        </div> : null}

        {creating === 'bulk' ? <div className="lili-bulk-builder">
          <div className="lili-bulk-builder-head"><div><strong>Montagem rápida</strong><span>Crie várias fases, grupos e slots em uma única ação.</span></div><button type="button" onClick={addBulkPhase}><Plus size={16} /> Adicionar fase</button></div>
          <div className="lili-bulk-phases">{bulkPhases.map((phase, phaseIndex) => <section className="lili-bulk-phase" key={phase.id}>
            <div className="lili-bulk-phase-head"><strong>Fase {phaseIndex + 1}</strong><button type="button" aria-label="Remover fase" onClick={() => removeBulkPhase(phase.id)} disabled={bulkPhases.length === 1}><Trash2 size={16} /></button></div>
            <div className="lili-bulk-phase-fields"><label>Nome da fase<input value={phase.nome} onChange={(event) => updateBulkPhase(phase.id, { nome: event.target.value })} placeholder="Ex.: Fase classificatória" /></label><label>Ordem<input type="number" min="1" value={phase.ordem} onChange={(event) => updateBulkPhase(phase.id, { ordem: Math.max(1, Number(event.target.value || 1)) })} /></label></div>
            <div className="lili-bulk-groups">{phase.grupos.map((group, groupIndex) => <div className="lili-bulk-group" key={group.id}><span>{String(groupIndex + 1).padStart(2, '0')}</span><label>Grupo<input value={group.nome} onChange={(event) => updateBulkGroup(phase.id, group.id, { nome: event.target.value })} /></label><label>Slots<input type="number" min="1" max="52" value={group.slots} onChange={(event) => updateBulkGroup(phase.id, group.id, { slots: Math.max(1, Math.min(52, Number(event.target.value || 1))) })} /></label><button type="button" aria-label="Remover grupo" onClick={() => removeBulkGroup(phase.id, group.id)} disabled={phase.grupos.length === 1}><Minus size={15} /></button></div>)}</div>
            <button className="lili-bulk-add-group" type="button" onClick={() => addBulkGroup(phase.id)} disabled={phase.grupos.length >= 26}><Plus size={15} /> Adicionar grupo</button>
          </section>)}</div>
          <div className="lili-bulk-summary"><span>{bulkPhases.length} fase(s)</span><span>{bulkPhases.reduce((total, phase) => total + phase.grupos.length, 0)} grupo(s)</span><span>{bulkPhases.reduce((total, phase) => total + phase.grupos.reduce((sum, group) => sum + group.slots, 0), 0)} slot(s)</span><button type="button" onClick={() => void createBulkStructure()} disabled={savingBulk}>{savingBulk ? <><Loader2 className="spin" size={16} /> Criando…</> : <><Sparkles size={16} /> Criar estrutura completa</>}</button></div>
        </div> : null}
        {creating === 'phase' ? <form className="lili-champ-form" onSubmit={createPhase}><label>Nome da fase<input name="nome" required placeholder="Ex.: Fase classificatória" /></label><label>Ordem<input name="ordem" type="number" min="1" defaultValue={phases.length + 1} /></label><button type="submit">Salvar fase</button></form> : null}
        {creating === 'group' ? <form className="lili-champ-form" onSubmit={createGroup}><label>Fase<select name="fase_id" required>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label><label>Nome do grupo<input name="nome" required placeholder="Ex.: Grupo A" /></label><label>Quantidade de slots<input name="slots" type="number" min="1" max="52" defaultValue="12" /></label><button type="submit">Criar grupo e slots</button></form> : null}
        <LiliPhaseDistributor
          championshipId={String(selected.id)}
          phases={phases}
          groups={groups}
          slots={slots}
          canManage={Boolean(structure.permission?.canManage)}
          request={request}
          onChanged={async () => { await openChampionship(selected) }}
          onFeedback={setFeedback}
        />
        <LiliGamesManager
          championshipId={String(selected.id)}
          phases={phases}
          groups={groups}
          games={games}
          canManage={Boolean(structure.permission?.canManageGames)}
          request={request}
          onChanged={async () => { await openChampionship(selected) }}
          onFeedback={setFeedback}
        />
        <div className="lili-champ-phase-filter"><button type="button" className={activePhase === 'all' ? 'is-active' : ''} onClick={() => setActivePhase('all')}>Todos</button>{phases.map((phase) => <button type="button" key={phase.id} className={activePhase === String(phase.id) ? 'is-active' : ''} onClick={() => setActivePhase(String(phase.id))}>{phase.nome}</button>)}</div>
        <div className="lili-champ-groups">{visibleGroups.map((group) => {
          const groupSlots = slots.filter((slot) => String(slot.grupo_id) === String(group.id)).sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
          const groupGames = games.filter((game) => Array.isArray(game.grupos_ids) ? game.grupos_ids.includes(group.id) : String(game.grupo_id || '') === String(group.id))
          return <article className="lili-champ-group" key={group.id}><div className="lili-champ-group-head"><div><strong>{group.nome}</strong><span>{groupSlots.filter((slot) => slot.equipe_id || slot.line_id).length}/{groupSlots.length || group.slots || 0} slots ocupados</span></div><div className="lili-champ-group-actions">{structure.permission?.canManage ? <button type="button" className={slotManagerGroup === String(group.id) ? 'active' : ''} onClick={() => toggleSlotManager(String(group.id))}><Users size={16} /> Organizar slots</button> : null}{structure.permission?.canGenerateToken ? <button type="button" onClick={() => void generateLink(group)} disabled={!groupSlots.some((slot) => !slot.equipe_id && !slot.line_id)}><Link2 size={16} /> Gerar link</button> : null}</div></div>
            {groupGames.length ? <div className="lili-champ-games">{groupGames.map((game) => <div key={game.id}><CalendarDays size={15} /><span><strong>{game.nome || 'Jogo'}</strong>{game.data_hora || game.inicio_em ? new Date(game.data_hora || game.inicio_em).toLocaleString('pt-BR') : 'Horário não definido'}</span><Swords size={15} /></div>)}</div> : null}
            {slotManagerGroup === String(group.id) ? <div className="lili-slot-manager">
              <div className="lili-slot-manager-note"><strong>Organizar slots</strong><span>Selecione um slot ocupado e depois escolha um slot livre para mover ou outro ocupado para trocar as equipes de posição.</span><button type="button" onClick={() => void shuffleGroupSlots(group, groupSlots)} disabled={Boolean(slotAction) || groupSlots.filter((slot) => slot.equipe_id || slot.line_id).length < 2}>{slotAction === `shuffle:${group.id}` ? <Loader2 className="spin" size={14} /> : <Shuffle size={14} />} Sortear slots</button>{moveSourceSlotId ? <button type="button" onClick={() => setMoveSourceSlotId(null)}><X size={14} /> Cancelar movimentação</button> : null}</div>
              <div className="lili-champ-slots manager">{groupSlots.map((slot) => {
                const occupied = Boolean(slot.equipe_id || slot.line_id)
                const selectedSlot = selectedSlotId === String(slot.id)
                const movingSource = moveSourceSlotId === String(slot.id)
                const movingNow = Boolean(slotAction?.startsWith('move:'))
                return <button type="button" className={`${occupied ? 'occupied' : 'free'} ${selectedSlot ? 'selected' : ''} ${movingSource ? 'move-source' : ''}`} key={slot.id} onClick={() => {
                  if (moveSourceSlotId) {
                    if (occupied) {
                      if (movingSource) return
                      const source = slots.find((item) => String(item.id) === moveSourceSlotId)
                      const sourceName = source?.line_nome || source?.equipe_nome || 'a equipe selecionada'
                      const targetName = slot.line_nome || slot.equipe_nome || 'a equipe deste slot'
                      const confirmed = window.confirm(`Trocar ${sourceName} de posição com ${targetName}?`)
                      if (confirmed) void moveTeamToSlot(String(slot.id), true)
                      return
                    }
                    void moveTeamToSlot(String(slot.id))
                    return
                  }
                  if (occupied) {
                    setMoveSourceSlotId(String(slot.id))
                    setSelectedSlotId(null)
                    setFeedback('Equipe selecionada. Escolha um slot livre para mover ou outro ocupado para trocar.')
                    return
                  }
                  setSelectedSlotId(String(slot.id))
                }} disabled={slotAction === `remove:${slot.id}` || movingNow}>
                  <span>{String(slot.slot_numero || slot.numero || '?').padStart(2, '0')}</span><div><strong>{slot.nome_exibicao || slot.line_nome || slot.equipe_nome || 'Slot disponível'}</strong><small>{movingSource ? 'Origem selecionada — escolha o destino' : occupied ? (moveSourceSlotId ? 'Clique para trocar com a equipe selecionada' : (slot.equipe_nome && slot.line_nome ? `${slot.equipe_nome} · ${slot.line_nome}` : slot.equipe_nome || slot.line_nome)) : moveSourceSlotId ? 'Clique para mover a equipe para cá' : selectedSlot ? 'Selecionado para receber uma equipe' : 'Clique para selecionar'}</small></div>
                  {movingSource ? <ArrowRightLeft size={16} /> : null}
                  {occupied && slot.participacao_id ? <span className="lili-slot-remove" onClick={(event) => { event.stopPropagation(); void freeOccupiedSlot(slot) }} title="Liberar slot"><UserMinus size={15} /></span> : null}
                </button>
              })}</div>
              {selectedSlotId ? <div className="lili-slot-search"><div className="lili-slot-search-form"><label>Buscar equipe ou tag<input value={slotSearch} onChange={(event) => setSlotSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchTeams() } }} placeholder="Digite pelo menos 2 letras" /></label><button type="button" onClick={() => void searchTeams()} disabled={searchingTeams || slotSearch.trim().length < 2}>{searchingTeams ? <Loader2 className="spin" size={16} /> : <Search size={16} />} Buscar</button></div>
                {teamResults.length ? <div className="lili-slot-results">{teamResults.map((team) => <section key={team.id}><div className="lili-slot-team"><span>{team.logo_url ? <img src={team.logo_url} alt="" /> : <Users size={16} />}</span><div><strong>{team.nome}</strong><small>{team.tag || 'Sem tag'} · {team.lines_livres || 0} line(s) disponível(is)</small></div></div><div className="lili-slot-lines">{(team.lines || []).map((line: Record<string, any>) => <button type="button" key={line.id} disabled={line.ja_inscrita || Boolean(slotAction)} onClick={() => void assignLineToSlot(selectedSlotId, String(team.id), String(line.id))}><span>{line.nome}</span><small>{line.ja_inscrita ? `Já inscrita${line.slot_letra ? ` no slot ${line.slot_letra}` : ''}` : 'Adicionar neste slot'}</small>{slotAction === `assign:${selectedSlotId}:${line.id}` ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}</button>)}</div></section>)}</div> : null}
              </div> : null}
            </div> : <div className="lili-champ-slots">{groupSlots.map((slot) => <div className={slot.equipe_id || slot.line_id ? 'occupied' : 'free'} key={slot.id}><span>{String(slot.slot_numero || slot.numero || '?').padStart(2, '0')}</span><div><strong>{slot.nome_exibicao || slot.line_nome || slot.equipe_nome || 'Slot disponível'}</strong><small>{slot.equipe_nome && slot.line_nome ? `${slot.equipe_nome} · ${slot.line_nome}` : slot.equipe_nome || slot.line_nome || 'Aguardando equipe'}</small></div></div>)}</div>}
          </article>
        })}</div>
        {!visibleGroups.length ? <div className="lili-champ-empty compact"><Users size={25} /><strong>Nenhum grupo nesta fase</strong><span>O administrador pode criar o primeiro grupo acima.</span></div> : null}
      </> : null}
    </section>
  )
}
