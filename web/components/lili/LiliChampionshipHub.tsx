'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRightLeft, CalendarDays, ChevronRight, CirclePlus, ExternalLink, Link2, Loader2, Map, Minus, Pencil, Plus, RefreshCw, Save, Search, Shield, Shuffle, Sparkles, Trash2, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { LiliPhaseDistributor } from './LiliPhaseDistributor'
import { LiliLinksManager } from './LiliLinksManager'
import { CampeonatoForm, emptyCampeonatoForm, type CampeonatoFormValue } from '@/components/forms/campeonato'
import { SystemModal } from '@/components/layout/SystemModal'

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

type ActiveAccount = {
  id?: string
  profile_type?: string | null
  data?: Record<string, any> | null
}

export function LiliChampionshipHub({ accessToken, activeAccount }: { accessToken?: string | null; activeAccount?: ActiveAccount | null }) {
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
  const [detailTab, setDetailTab] = useState<'overview' | 'groups' | 'links' | 'config'>('overview')
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [slotsExpanded, setSlotsExpanded] = useState(false)
  const [showCreateChampionship, setShowCreateChampionship] = useState(false)
  const [championshipDraft, setChampionshipDraft] = useState<CampeonatoFormValue>({ ...emptyCampeonatoForm })
  const [creatingChampionship, setCreatingChampionship] = useState(false)

  async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(activeAccount?.profile_type ? { 'X-Profile-Type': activeAccount.profile_type } : {}),
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

  async function uploadChampionshipFile(file: File, bucket: string) {
    if (!accessToken) throw new Error('Entre novamente para enviar a imagem.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
      reader.readAsDataURL(file)
    })
    const payload = await request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        bucket,
        file_name: file.name || `${bucket}.png`,
        content_type: file.type || 'image/png',
        data_url: dataUrl,
        upload_intent: 'create_campeonato',
      }),
    })
    if (!payload?.url) throw new Error('O upload terminou sem retornar a imagem.')
    return String(payload.url)
  }

  async function createChampionship() {
    if (activeAccount?.profile_type !== 'produtora') {
      setError('Selecione um perfil de produtora para criar campeonatos.')
      return
    }
    if (!championshipDraft.nome.trim()) {
      setError('Informe o nome do campeonato.')
      return
    }
    if (!championshipDraft.logo_url.trim()) {
      setError('Envie a logo do campeonato.')
      return
    }
    setCreatingChampionship(true)
    setError('')
    setFeedback('')
    try {
      await request('/api/dropzone', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'championship',
          name: championshipDraft.nome.trim(),
          data: championshipDraft,
        }),
      })
      setChampionshipDraft({ ...emptyCampeonatoForm })
      setShowCreateChampionship(false)
      setFeedback('Campeonato criado. Agora ele aguarda pagamento ou liberação administrativa para ser publicado.')
      await loadItems()
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o campeonato.')
    } finally {
      setCreatingChampionship(false)
    }
  }

  async function openChampionship(item: ChampionshipItem) {
    setSelected(item); setStructure(null); setDetailLoading(true); setError(''); setActivePhase('all'); setDetailTab('overview'); setOpenGroupId(null); setSlotsExpanded(false)
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
    const normalizeName = (value: unknown) => String(value || '').trim().toLocaleLowerCase('pt-BR')
    const existingPhaseNames = new Set(phases.map((phase) => normalizeName(phase.nome)))
    const draftPhaseNames = bulkPhases.map((phase) => normalizeName(phase.nome))
    const duplicatedPhase = draftPhaseNames.find((name, index) => existingPhaseNames.has(name) || draftPhaseNames.indexOf(name) !== index)
    const duplicatedGroup = bulkPhases.find((phase) => {
      const names = phase.grupos.map((group) => normalizeName(group.nome))
      return names.some((name, index) => names.indexOf(name) !== index)
    })
    if (invalidPhase || invalidGroup) {
      setFeedback('Preencha o nome de todas as fases e grupos e mantenha ao menos um grupo por fase.')
      return
    }
    if (duplicatedPhase) {
      setFeedback('Já existe uma fase com esse nome. Use outro nome para evitar duplicidade.')
      return
    }
    if (duplicatedGroup) {
      setFeedback('Existem grupos repetidos na montagem. Cada grupo da fase precisa ter um nome diferente.')
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

  async function saveAllStructure() {
    if (!selected) return
    setSavingEntity('structure:all')
    try {
      for (const phase of phases) {
        const phaseId = String(phase.id)
        const draft = editPhases[phaseId]
        if (!draft?.nome.trim()) throw new Error('Todas as fases precisam ter um nome.')
        await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'PATCH', body: JSON.stringify({ entity: 'phase', id: phaseId, nome: draft.nome.trim(), ordem: draft.ordem }) })
      }
      for (const group of groups) {
        const groupId = String(group.id)
        const draft = editGroups[groupId]
        if (!draft?.nome.trim()) throw new Error('Todos os grupos precisam ter um nome.')
        await request(`/api/campeonatos/${selected.id}/estrutura`, { method: 'PATCH', body: JSON.stringify({ entity: 'group', id: groupId, nome: draft.nome.trim(), slots: draft.slots }) })
      }
      setFeedback('Toda a estrutura foi salva com sucesso.')
      await openChampionship(selected)
    } catch (error: any) { setFeedback(error?.message || 'Não foi possível salvar toda a estrutura.') }
    finally { setSavingEntity(null) }
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
      <div className="lili-champ-toolbar"><div><strong>Meus campeonatos</strong><span>Escolha um campeonato para consultar ou administrar.</span></div><div className="lili-champ-toolbar-actions">{activeAccount?.profile_type === 'produtora' ? <button type="button" className="create" onClick={() => setShowCreateChampionship(true)} title="Criar campeonato"><CirclePlus size={17} /><span>Novo</span></button> : null}<button type="button" onClick={() => void loadItems()} aria-label="Atualizar"><RefreshCw size={17} /></button></div></div>
      {loading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando campeonatos…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {feedback ? <div className="lili-champ-feedback">{feedback}</div> : null}
      {!loading && !items.length ? <div className="lili-champ-empty"><Trophy size={30} /><strong>Nenhum campeonato encontrado</strong><span>Quando sua equipe entrar em um grupo ou você criar um campeonato, ele aparecerá aqui.</span><a href="/campeonatos">Explorar campeonatos</a></div> : null}
      <div className="lili-champ-list">{items.map((item) => {
        const registration = item.registrations?.[0]
        return <button type="button" key={item.id} className="lili-champ-list-item" onClick={() => void openChampionship(item)}>
          <span className="lili-champ-logo">{item.logo_url || item.banner_url ? <img src={item.logo_url || item.banner_url || ''} alt="" /> : <Trophy size={22} />}</span>
          <span className="lili-champ-list-copy"><strong>{item.nome}</strong><small>{registration?.grupo_nome ? `${registration.grupo_nome}${registration.slot_numero ? ` · Slot ${registration.slot_numero}` : ''}` : item.relationship === 'admin' ? 'Acesso administrativo' : 'Participante'}</small><span>{item.tipo || 'Campeonato'} · {item.status || 'ativo'}</span></span>
          <span className={`lili-champ-role ${item.relationship}`}>{item.relationship === 'admin' ? 'Admin' : 'Minha equipe'}</span><ChevronRight size={18} />
        </button>
      })}</div>
      <SystemModal open={showCreateChampionship} title="Novo campeonato pela Lili" description="Preencha todas as configurações. Esta opção está disponível somente no perfil de produtora." onClose={() => setShowCreateChampionship(false)} size="wide">
        <CampeonatoForm value={championshipDraft} onChange={setChampionshipDraft} onSubmit={() => void createChampionship()} onCancel={() => setShowCreateChampionship(false)} loading={creatingChampionship} uploadPublicFile={uploadChampionshipFile} />
      </SystemModal>
    </section>
  )

  const occupiedSlots = slots.filter((slot) => slot.equipe_id || slot.line_id).length
  const phaseGroups = activePhase === 'all' ? groups : groups.filter((group) => String(group.fase_id) === activePhase)
  const chosenGroup = phaseGroups.find((group) => String(group.id) === openGroupId) || phaseGroups[0] || null
  const chosenGroupSlots = chosenGroup ? slots.filter((slot) => String(slot.grupo_id) === String(chosenGroup.id)).sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0)) : []
  const chosenGroupGames = chosenGroup ? games.filter((game) => Array.isArray(game.grupos_ids) ? game.grupos_ids.map(String).includes(String(chosenGroup.id)) : String(game.grupo_id || '') === String(chosenGroup.id)) : []

  function selectPhase(phaseId: string) {
    setActivePhase(phaseId)
    const firstGroup = groups.find((group) => phaseId === 'all' || String(group.fase_id) === phaseId)
    setOpenGroupId(firstGroup ? String(firstGroup.id) : null)
    setSlotsExpanded(false)
    setSlotManagerGroup(null)
  }

  function groupLetter(group: Record<string, any>, index: number) {
    const match = String(group.nome || '').match(/(?:grupo\s*)?([A-Z])(?:\b|$)/i)
    return match?.[1]?.toUpperCase() || String.fromCharCode(65 + index)
  }

  function slotLetter(slot: Record<string, any>, index: number) {
    const raw = Number(slot.slot_numero || slot.numero || index + 1)
    if (!Number.isFinite(raw) || raw < 1) return '?'
    let value = Math.floor(raw)
    let label = ''
    while (value > 0) { value -= 1; label = String.fromCharCode(65 + (value % 26)) + label; value = Math.floor(value / 26) }
    return label
  }

  function renderSlotManager() {
    if (!chosenGroup) return null
    return <div className="lili-slot-manager mobile-clean">
      <div className="lili-slot-manager-note"><strong>Toque em uma equipe e depois no destino</strong><span>Um slot livre move; um slot ocupado troca as equipes.</span>{moveSourceSlotId ? <button type="button" onClick={() => setMoveSourceSlotId(null)}><X size={14} /> Cancelar seleção</button> : null}</div>
      <div className="lili-champ-slots manager">{chosenGroupSlots.map((slot, index) => {
        const occupied = Boolean(slot.equipe_id || slot.line_id)
        const selectedSlot = selectedSlotId === String(slot.id)
        const movingSource = moveSourceSlotId === String(slot.id)
        const movingNow = Boolean(slotAction?.startsWith('move:'))
        return <button type="button" className={`${occupied ? 'occupied' : 'free'} ${selectedSlot ? 'selected' : ''} ${movingSource ? 'move-source' : ''}`} key={slot.id} onClick={() => {
          if (moveSourceSlotId) {
            if (occupied) {
              if (movingSource) return
              const source = slots.find((item) => String(item.id) === moveSourceSlotId)
              const confirmed = window.confirm(`Trocar ${source?.line_nome || source?.equipe_nome || 'a equipe selecionada'} com ${slot.line_nome || slot.equipe_nome || 'esta equipe'}?`)
              if (confirmed) void moveTeamToSlot(String(slot.id), true)
              return
            }
            void moveTeamToSlot(String(slot.id)); return
          }
          if (occupied) { setMoveSourceSlotId(String(slot.id)); setSelectedSlotId(null); setFeedback('Equipe selecionada. Escolha o slot de destino.'); return }
          setSelectedSlotId(String(slot.id))
        }} disabled={slotAction === `remove:${slot.id}` || movingNow}>
          <span>{slotLetter(slot, index)}</span><div><strong>{slot.nome_exibicao || slot.line_nome || slot.equipe_nome || 'Slot disponível'}</strong><small>{movingSource ? 'Origem selecionada' : occupied ? (slot.equipe_nome && slot.line_nome ? `${slot.equipe_nome} · ${slot.line_nome}` : slot.equipe_nome || slot.line_nome) : moveSourceSlotId ? 'Mover para cá' : selectedSlot ? 'Selecionado para receber equipe' : 'Disponível'}</small></div>{movingSource ? <ArrowRightLeft size={16} /> : null}{occupied && slot.participacao_id ? <span className="lili-slot-remove" onClick={(event) => { event.stopPropagation(); void freeOccupiedSlot(slot) }} title="Liberar slot"><UserMinus size={15} /></span> : null}
        </button>
      })}</div>
      {selectedSlotId ? <div className="lili-slot-search"><div className="lili-slot-search-form"><label>Buscar equipe<input value={slotSearch} onChange={(event) => setSlotSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchTeams() } }} placeholder="Nome ou tag" /></label><button type="button" onClick={() => void searchTeams()} disabled={searchingTeams || slotSearch.trim().length < 2}>{searchingTeams ? <Loader2 className="spin" size={16} /> : <Search size={16} />}</button></div>{teamResults.length ? <div className="lili-slot-results">{teamResults.map((team) => <section key={team.id}><div className="lili-slot-team"><span>{team.logo_url ? <img src={team.logo_url} alt="" /> : <Users size={16} />}</span><div><strong>{team.nome}</strong><small>{team.tag || 'Sem tag'}</small></div></div><div className="lili-slot-lines">{(team.lines || []).map((line: Record<string, any>) => <button type="button" key={line.id} disabled={line.ja_inscrita || Boolean(slotAction)} onClick={() => void assignLineToSlot(selectedSlotId, String(team.id), String(line.id))}><span>{line.nome}</span><small>{line.ja_inscrita ? 'Já inscrita' : 'Adicionar'}</small>{slotAction === `assign:${selectedSlotId}:${line.id}` ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}</button>)}</div></section>)}</div> : null}</div> : null}
    </div>
  }

  return (
    <section className="lili-champ-hub detail mobile-first">
      <div className="lili-champ-detail-head"><button type="button" onClick={() => { setSelected(null); setStructure(null); setFeedback('') }}><ArrowLeft size={18} /> Voltar</button><a href={structure?.permission?.canManage ? `/?perfil=produtora&campeonato=${encodeURIComponent(String(selected.id))}&section=grupos` : `/campeonatos/${selected.id}`}><ExternalLink size={16} /> {structure?.permission?.canManage ? 'Gerenciar no site' : 'Site completo'}</a></div>
      <div className="lili-champ-title"><span className="lili-champ-logo large">{selected.logo_url || selected.banner_url ? <img src={selected.logo_url || selected.banner_url || ''} alt="" /> : <Trophy size={25} />}</span><div><strong>{selected.nome}</strong><span>{selected.tipo || 'Campeonato'} · {selected.status || 'ativo'}</span></div></div>
      {detailLoading ? <div className="lili-champ-loading"><Loader2 className="spin" size={24} /> Carregando estrutura…</div> : null}
      {error ? <div className="lili-champ-feedback error">{error}</div> : null}
      {feedback ? <div className="lili-champ-feedback">{feedback}</div> : null}
      {structure ? <>
        <nav className="lili-mobile-sections" aria-label="Áreas do campeonato">
          <button type="button" className={detailTab === 'overview' ? 'active' : ''} onClick={() => setDetailTab('overview')}><Trophy size={17} /><span>Resumo</span></button>
          <button type="button" className={detailTab === 'groups' ? 'active' : ''} onClick={() => { setDetailTab('groups'); if (!openGroupId && groups[0]) setOpenGroupId(String(groups[0].id)) }}><Users size={17} /><span>Grupos</span></button>
        </nav>

        {detailTab === 'overview' ? <div className="lili-mobile-panel">
          <div className="lili-mobile-metrics"><div><span>Fases</span><strong>{phases.length}</strong></div><div><span>Grupos</span><strong>{groups.length}</strong></div><div><span>Equipes</span><strong>{occupiedSlots}/{slots.length}</strong></div><div><span>Jogos</span><strong>{games.length}</strong></div></div>
          <section className="lili-mobile-summary-card"><div><strong>Fases, grupos e calendário</strong><span>{phases.length ? `${phases.length} fase(s), ${groups.length} grupo(s) e ${games.length} jogo(s)` : 'Estrutura ainda não configurada'}</span></div><button type="button" onClick={() => { setDetailTab('groups'); if (groups[0]) setOpenGroupId(String(groups[0].id)) }}>Acompanhar <ChevronRight size={16} /></button></section>
          {structure.permission?.canManage ? <section className="lili-mobile-callout"><Sparkles size={20} /><div><strong>Alterações avançadas no site</strong><span>A Lili mantém a consulta rápida. Estrutura, jogos e convites são gerenciados na tela completa.</span></div><a href={`/?perfil=produtora&campeonato=${encodeURIComponent(String(selected.id))}&section=grupos`}>Gerenciar</a></section> : null}
        </div> : null}

        {detailTab === 'groups' ? <div className="lili-mobile-panel">
          <div className="lili-mobile-phase-chips"><button type="button" className={activePhase === 'all' ? 'active' : ''} onClick={() => selectPhase('all')}>Todos</button>{phases.map((phase) => <button type="button" key={phase.id} className={activePhase === String(phase.id) ? 'active' : ''} onClick={() => selectPhase(String(phase.id))}>{phase.nome}</button>)}</div>
          {phaseGroups.length ? <>
            <div className="lili-mobile-group-pills" aria-label="Selecionar grupo">{phaseGroups.map((group, index) => <button type="button" key={group.id} title={group.nome} className={String(chosenGroup?.id) === String(group.id) ? 'active' : ''} onClick={() => { setOpenGroupId(String(group.id)); setSlotsExpanded(false); setSlotManagerGroup(null) }}>{groupLetter(group, index)}</button>)}</div>
            {chosenGroup ? <article className="lili-mobile-group-card">
              <div className="lili-mobile-group-head"><div><strong>{chosenGroup.nome}</strong><span>{chosenGroupSlots.filter((slot) => slot.equipe_id || slot.line_id).length}/{chosenGroupSlots.length || chosenGroup.slots || 0} slots ocupados · {chosenGroupGames.length} jogo(s)</span></div>{structure.permission?.canGenerateToken ? <button type="button" className="icon-action" title="Gerar link" onClick={() => void generateLink(chosenGroup)} disabled={!chosenGroupSlots.some((slot) => !slot.equipe_id && !slot.line_id)}><Link2 size={17} /></button> : null}</div>
              {chosenGroupGames.length ? <div className="lili-mobile-game-preview">{chosenGroupGames.map((game) => {
                const date = game.data_jogo
                  ? new Date(`${String(game.data_jogo).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
                  : null
                const time = game.horario ? String(game.horario).slice(0, 5) : null
                const maps = Array.isArray(game.mapas) ? game.mapas.filter(Boolean) : []
                return <div key={game.id}><CalendarDays size={15} /><span><strong>{game.nome || 'Jogo'}</strong><small>{[date, time].filter(Boolean).join(' às ') || 'Data e horário a definir'}</small>{maps.length ? <small><Map size={13} /> {maps.join(' · ')}</small> : null}</span></div>
              })}</div> : <div className="lili-mobile-game-preview"><div><CalendarDays size={15} /><span><strong>Calendário</strong><small>Data e mapas ainda não definidos para este grupo.</small></span></div></div>}
              {structure.permission?.canManage ? <button type="button" className="lili-mobile-expand" onClick={() => { setSlotsExpanded((value) => !value); if (slotsExpanded) setSlotManagerGroup(null) }}>{slotsExpanded ? 'Fechar equipes' : 'Ver equipes'} <ChevronRight size={16} className={slotsExpanded ? 'rotated' : ''} /></button> : null}
              {slotsExpanded || !structure.permission?.canManage ? <div className="lili-mobile-slots-area">
                {structure.permission?.canManage ? <div className="lili-mobile-slot-toolbar"><button type="button" className={slotManagerGroup === String(chosenGroup.id) ? 'active' : ''} onClick={() => toggleSlotManager(String(chosenGroup.id))}><Users size={15} /> {slotManagerGroup === String(chosenGroup.id) ? 'Finalizar' : 'Organizar'}</button>{slotManagerGroup === String(chosenGroup.id) ? <button type="button" onClick={() => void shuffleGroupSlots(chosenGroup, chosenGroupSlots)} disabled={Boolean(slotAction) || chosenGroupSlots.filter((slot) => slot.equipe_id || slot.line_id).length < 2}><Shuffle size={15} /> Sortear</button> : null}</div> : null}
                {slotManagerGroup === String(chosenGroup.id) ? renderSlotManager() : <div className="lili-champ-slots mobile-list">{chosenGroupSlots.map((slot, index) => <div className={slot.equipe_id || slot.line_id ? 'occupied' : 'free'} key={slot.id}><span>{slotLetter(slot, index)}</span><div><strong>{slot.nome_exibicao || slot.line_nome || slot.equipe_nome || 'Slot disponível'}</strong><small>{slot.equipe_nome && slot.line_nome ? `${slot.equipe_nome} · ${slot.line_nome}` : slot.equipe_nome || slot.line_nome || 'Aguardando equipe'}</small></div></div>)}</div>}
              </div> : null}
            </article> : null}
          </> : <div className="lili-champ-empty compact"><Users size={25} /><strong>Nenhum grupo nesta fase</strong><span>{structure.permission?.canOrganizeGroups ? 'Abra Configurar para montar a estrutura.' : 'A organização ainda não publicou grupos nesta fase.'}</span></div>}
        </div> : null}

        {detailTab === 'links' ? <div className="lili-mobile-panel"><LiliLinksManager championshipId={String(selected.id)} phases={phases} groups={groups} slots={slots} canManage={Boolean(structure.permission?.canGenerateToken)} request={request} onFeedback={setFeedback} /></div> : null}

        {detailTab === 'config' ? <div className="lili-mobile-panel lili-config-panel">
          <section className="lili-existing-structure"><div className="lili-config-title"><div><strong>Estrutura atual</strong><span>Confira o que já existe antes de adicionar ou editar.</span></div><span>{phases.length} fase(s)</span></div>{phases.length ? phases.map((phase) => { const items = groups.filter((group) => String(group.fase_id) === String(phase.id)); return <div className="lili-existing-phase" key={phase.id}><strong>{phase.nome}</strong><div>{items.length ? items.map((group) => <span key={group.id}>{group.nome} · {Number(group.slots_total || group.slots || 0)} slots</span>) : <span>Sem grupos</span>}</div></div> }) : <div className="lili-config-empty">Nenhuma fase criada.</div>}</section>
          {structure.permission?.canOrganizeGroups ? <div className="lili-config-actions"><button type="button" className="primary" onClick={openBulkBuilder}><Sparkles size={17} /><span><strong>{phases.length ? 'Adicionar estrutura' : 'Montar campeonato'}</strong><small>Fluxo guiado para fases, grupos e slots</small></span><ChevronRight size={17} /></button><button type="button" onClick={openStructureManager}><Pencil size={17} /><span><strong>Editar estrutura atual</strong><small>Renomear, ordenar e ajustar slots</small></span><ChevronRight size={17} /></button></div> : null}

          {managingStructure ? <div className="lili-structure-manager mobile-guided compact-editor">
            <div className="lili-structure-manager-head"><div><strong>Editar estrutura</strong><span>Altere somente o necessário e salve tudo de uma vez.</span></div><button type="button" onClick={() => setManagingStructure(false)} aria-label="Fechar"><X size={16} /></button></div>
            <div className="lili-structure-phase-list">{phases.map((phase) => {
              const phaseId = String(phase.id); const phaseDraft = editPhases[phaseId] || { id: phaseId, nome: String(phase.nome || ''), ordem: Number(phase.ordem || 1) }; const phaseItems = groups.filter((group) => String(group.fase_id) === phaseId)
              return <details className="lili-structure-phase" key={phaseId}><summary><span><strong>{phase.nome}</strong><small>{phaseItems.length} grupo(s)</small></span><ChevronRight size={17} /></summary><div className="lili-structure-phase-content">
                <div className="lili-structure-phase-row compact-row"><label>Fase<input value={phaseDraft.nome} onChange={(event) => setEditPhases((current) => ({ ...current, [phaseId]: { ...phaseDraft, nome: event.target.value } }))} /></label><label className="order-field">Ordem<input type="number" min="1" value={phaseDraft.ordem} onChange={(event) => setEditPhases((current) => ({ ...current, [phaseId]: { ...phaseDraft, ordem: Math.max(1, Number(event.target.value || 1)) } }))} /></label><button type="button" className="icon-danger" title="Excluir fase vazia" onClick={() => void deleteStructureEntity('phase', phaseId, `a fase ${phase.nome}`)} disabled={savingEntity === 'structure:all'}><Trash2 size={15} /></button></div>
                <div className="lili-structure-groups">{phaseItems.map((group) => { const groupId = String(group.id); const groupDraft = editGroups[groupId] || { id: groupId, nome: String(group.nome || ''), slots: Number(group.slots_total || group.slots || 12) }; return <div className="lili-structure-group-row compact-row" key={groupId}><label>Grupo<input value={groupDraft.nome} onChange={(event) => setEditGroups((current) => ({ ...current, [groupId]: { ...groupDraft, nome: event.target.value } }))} /></label><label className="slots-field">Slots<input type="number" min="1" max="52" value={groupDraft.slots} onChange={(event) => setEditGroups((current) => ({ ...current, [groupId]: { ...groupDraft, slots: Math.max(1, Math.min(52, Number(event.target.value || 1))) } }))} /></label><small>{Number(group.slots_ocupados || 0)} ocupados</small><button type="button" className="icon-danger" title="Excluir grupo vazio" onClick={() => void deleteStructureEntity('group', groupId, `o grupo ${group.nome}`)} disabled={savingEntity === 'structure:all'}><Trash2 size={15} /></button></div> })}</div>
              </div></details>
            })}</div>
            <div className="lili-structure-savebar"><button type="button" onClick={() => void saveAllStructure()} disabled={savingEntity === 'structure:all'}>{savingEntity === 'structure:all' ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Salvar alterações</button></div>
          </div> : null}

          {creating === 'bulk' ? <div className="lili-bulk-builder mobile-guided"><div className="lili-bulk-builder-head"><div><strong>{phases.length ? 'Adicionar nova estrutura' : 'Montagem guiada'}</strong><span>O sistema mostra acima tudo que já existe para evitar repetição.</span></div><button type="button" onClick={addBulkPhase}><Plus size={16} /> Fase</button></div><div className="lili-bulk-phases">{bulkPhases.map((phase, phaseIndex) => <section className="lili-bulk-phase" key={phase.id}><div className="lili-bulk-phase-head"><strong>Nova fase {phaseIndex + 1}</strong><button type="button" aria-label="Remover fase" onClick={() => removeBulkPhase(phase.id)} disabled={bulkPhases.length === 1}><Trash2 size={16} /></button></div><div className="lili-bulk-phase-fields"><label>Nome da fase<input value={phase.nome} onChange={(event) => updateBulkPhase(phase.id, { nome: event.target.value })} placeholder="Ex.: Semifinal" list="lili-phase-suggestions" /></label><label>Ordem<input type="number" min="1" value={phase.ordem} onChange={(event) => updateBulkPhase(phase.id, { ordem: Math.max(1, Number(event.target.value || 1)) })} /></label></div><datalist id="lili-phase-suggestions"><option value="Fase 1"/><option value="Fase 2"/><option value="Quartas de final"/><option value="Semifinal"/><option value="Grande final"/></datalist><div className="lili-bulk-groups">{phase.grupos.map((group, groupIndex) => <div className="lili-bulk-group" key={group.id}><span>{String.fromCharCode(65 + groupIndex)}</span><label>Grupo<input value={group.nome} onChange={(event) => updateBulkGroup(phase.id, group.id, { nome: event.target.value })} placeholder={`Grupo ${String.fromCharCode(65 + groupIndex)}`} /></label><label>Slots<input type="number" min="1" max="52" value={group.slots} onChange={(event) => updateBulkGroup(phase.id, group.id, { slots: Math.max(1, Math.min(52, Number(event.target.value || 1))) })} /></label><button type="button" aria-label="Remover grupo" onClick={() => removeBulkGroup(phase.id, group.id)} disabled={phase.grupos.length === 1}><Minus size={15} /></button></div>)}</div><button type="button" className="lili-bulk-add-group" onClick={() => addBulkGroup(phase.id)}><Plus size={15} /> Adicionar grupo</button></section>)}</div><div className="lili-bulk-summary"><span>{bulkPhases.length} nova(s) fase(s)</span><span>{bulkPhases.reduce((sum, phase) => sum + phase.grupos.length, 0)} grupo(s)</span><span>{bulkPhases.flatMap((phase) => phase.grupos).reduce((sum, group) => sum + group.slots, 0)} slot(s)</span><button type="button" onClick={() => void createBulkStructure()} disabled={savingBulk}>{savingBulk ? <><Loader2 className="spin" size={16} /> Criando…</> : <><Sparkles size={16} /> Criar estrutura</>}</button></div></div> : null}

          <LiliPhaseDistributor championshipId={String(selected.id)} phases={phases} groups={groups} slots={slots} canManage={Boolean(structure.permission?.canManage)} request={request} onChanged={async () => { await openChampionship(selected) }} onFeedback={setFeedback} />
        </div> : null}
      </> : null}
    </section>
  )
}
