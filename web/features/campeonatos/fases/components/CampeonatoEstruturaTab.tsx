'use client'
import { usePagedSearch } from '@/hooks/usePagedSearch'
import { useStructureGroupMutation } from '@/hooks/useStructureGroupMutation'
import { StructureGroupRecovery } from './StructureGroupRecovery'
import type { StructureGroupReadContract } from '@/lib/structure-group-write'

import { confirmAction } from '@/components/feedback'
import { Input as UiInput, Select as UiSelect } from '@/components/ui/Field'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { Field } from '@/features/dropzone/components/form-fields'
import { SystemModal } from '@/components/layout/SystemModal'
import { supabase } from '@/lib/supabase-browser'
import { GROUP_LETTERS } from '@/lib/dropzone-constants'
import { campeonatoEquipesService } from '@/features/campeonatos/equipes/services/campeonato-equipes.service'
import type { EquipeBusca } from '@/features/campeonatos/equipes/types/campeonato-equipes.types'
import './campeonato-estrutura-batch.css'
import type { ParticipationReadContract } from '@/lib/participation-write'
import { ParticipationRecovery } from '@/features/campeonatos/equipes/components/ParticipationRecovery'
import { LigaOriginField } from '@/features/campeonatos/equipes/components/LigaOriginField'
import { validateLigaOrigin, type LigaPlan } from '@backend/campeonatos/liga-plan'
import type { ParticipationExpected } from '@backend/campeonatos/participation-contract'

type Fase = { id: string; nome: string; ordem?: number; tipo?: 'normal' | 'grande_final'; oculta?: boolean; data?: { oculta?: boolean } }
type Grupo = {
  id: string
  nome: string
  fase_id: string
  slots?: number
  slots_total?: number
  slots_ocupados?: number
  slots_livres?: number
  whatsapp_url?: string | null
}
type Slot = {
  participation_expected?: ParticipationExpected | null
  id: string
  grupo_id: string
  fase_id?: string | null
  slot_numero?: number
  slot_letra?: string | null
  equipe_id?: string | null
  line_id?: string | null
  status?: string | null
  line_nome?: string | null
  equipe_nome?: string | null
  line_logo_url?: string | null
  origem_entrada?: string | null
  participacao_id?: string | null
}

type Permission = {
  canOrganizeGroups?: boolean
  canManage?: boolean
  canRemove?: boolean
  canGenerateToken?: boolean
  role?: string
}

/** Rascunho local do formulário "montar tudo de uma vez". */
type BulkGroupDraft = {
  key: string
  letter: string
  slots: string
}
type BulkPhaseDraft = {
  key: string
  nome: string
  ordem: string
  grandeFinal: boolean
  groupCount: string
  defaultSlots: string
  customizeSlots: boolean
  grupos: BulkGroupDraft[]
}
type BatchSlotAssignment = { slotId: string; equipeId: string; lineId: string; lineName: string; teamQuery: string; origin: string }

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function slotStatus(slot: Slot): 'livre' | 'reservada' | 'ocupada' | 'bloqueada' {
  if (slot.participacao_id || slot.line_id || slot.equipe_id || slot.status === 'ocupado' || slot.status === 'ocupada') return 'ocupada'
  if (slot.status === 'reservado' || slot.status === 'reservada') return 'reservada'
  if (slot.status === 'bloqueado' || slot.status === 'bloqueada') return 'bloqueada'
  return 'livre'
}

function sortGroupsByName(a: Grupo, b: Grupo) {
  const groupA = String(a.nome || '').match(/\bgrupo\s+([a-z]+)/i)?.[1] || a.nome || ''
  const groupB = String(b.nome || '').match(/\bgrupo\s+([a-z]+)/i)?.[1] || b.nome || ''
  return String(groupA).localeCompare(String(groupB), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function newDraftKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function buildGroupsFromCount(
  count: number,
  defaultSlots: string,
  previous: BulkGroupDraft[] = [],
): BulkGroupDraft[] {
  const safe = Math.max(1, Math.min(26, Math.floor(Number(count) || 1)))
  return Array.from({ length: safe }, (_, index) => {
    const letter = GROUP_LETTERS[index] || String.fromCharCode(65 + index)
    const prev = previous[index]
    return {
      key: prev?.key || newDraftKey(),
      letter,
      slots: prev?.slots || defaultSlots || '12',
    }
  })
}

function createEmptyBulkPhase(ordem: number): BulkPhaseDraft {
  const defaultSlots = '12'
  return {
    key: newDraftKey(),
    nome: ordem === 1 ? 'Fase de grupos' : `Fase ${ordem}`,
    ordem: String(ordem),
    grandeFinal: false,
    groupCount: '4',
    defaultSlots,
    customizeSlots: false,
    grupos: buildGroupsFromCount(4, defaultSlots),
  }
}

export function CampeonatoEstruturaTab(props: { campeonatoId: string; onChanged?: () => void }) {
  return <CampeonatoEstruturaContent key={props.campeonatoId} {...props} />
}

function CampeonatoEstruturaContent({
  campeonatoId,
  onChanged,
}: {
  campeonatoId: string
  /** Chamado após criar/editar/excluir estrutura — útil para recarregar jogos/links no painel pai. */
  onChanged?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const groupMutation = useStructureGroupMutation(campeonatoId)
  const [groupContract, setGroupContract] = useState<StructureGroupReadContract>({})
  const [groupFeedback, setGroupFeedback] = useState<{ key: string; text: string }>({ key: '', text: '' })
  const [error, setError] = useState('')
  const [fases, setFases] = useState<Fase[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [permission, setPermission] = useState<Permission>({})
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [openAction, setOpenAction] = useState<'phase' | 'group' | 'bulk' | ''>('')
  const [phaseForm, setPhaseForm] = useState({ nome: '', ordem: '1', grandeFinal: false, finalSlots: '12' })
  const [groupForm, setGroupForm] = useState({ nome: 'Grupo A', fase_id: '', slots: '12', whatsapp_url: '' })
  const [bulkPhases, setBulkPhases] = useState<BulkPhaseDraft[]>(() => [createEmptyBulkPhase(1)])
  const [editingPhase, setEditingPhase] = useState<{ id: string; nome: string; ordem: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; nome: string; slots: string; whatsapp_url: string; slot_start_letter: string } | null>(null)

  // Slot: adicionar / remover line
  const [slotAlvo, setSlotAlvo] = useState<Slot | null>(null)
  const [slotModo, setSlotModo] = useState<'adicionar' | null>(null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<EquipeBusca[]>([])
  const directory = usePagedSearch<EquipeBusca>(`/api/campeonatos/${campeonatoId}/equipes/busca`, { authenticated: true, itemsKey: 'equipes' })
  useEffect(() => { setResultados([]) }, [campeonatoId])
  const [equipe, setEquipe] = useState<EquipeBusca | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeLine, setNomeLine] = useState('')
  const [origin, setOrigin] = useState('')
  const [ligaPlan, setLigaPlan] = useState<LigaPlan | null>(null)
  const [slotBusy, setSlotBusy] = useState(false)
  const slotOperation = useRef(false)
  const [slotFeedback, setSlotFeedback] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [batchSlots, setBatchSlots] = useState<Slot[]>([])
  const [batchAssignments, setBatchAssignments] = useState<BatchSlotAssignment[]>([])
  const [batchTeamOpenIndex, setBatchTeamOpenIndex] = useState<number | null>(null)
  const batchBlurTimer = useRef<number | null>(null)
  useEffect(() => () => { if (batchBlurTimer.current != null) window.clearTimeout(batchBlurTimer.current) }, [])
  const [participationContract, setParticipationContract] = useState<ParticipationReadContract>({})
  const loadGeneration = useRef(0)
  const [enrollmentGroupId, setEnrollmentGroupId] = useState('')

  const canEdit = Boolean(permission.canOrganizeGroups)
  const canAdd = Boolean(permission.canManage)
  const canRemove = Boolean(permission.canRemove)

  const load = useCallback(async (options?: { silent?: boolean; reconcileDraft?: boolean }) => {
    if (!campeonatoId) return
    const generation = ++loadGeneration.current
    if (!options?.silent) setLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estrutura`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (generation !== loadGeneration.current || !groupMutation.scope.isCurrent()) return
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar estrutura.')
      setFases(Array.isArray(json.fases) ? json.fases : [])
      setGrupos(Array.isArray(json.grupos) ? json.grupos : [])
      setSlots(Array.isArray(json.slots) ? json.slots : [])
      if (options?.reconcileDraft) setBatchAssignments(current => current.filter(row => (json.slots || []).some((slot: Slot) => slot.id === row.slotId && slotStatus(slot) === 'livre')))
      setPermission(json.permission || {})
      setGroupContract({ structure_group_write_mode: json.structure_group_write_mode, structure_group_actor_id: json.structure_group_actor_id })
      setParticipationContract({ participation_write_mode: json.participation_write_mode, participation_actor_id: json.participation_actor_id })
      setLigaPlan(json.liga || null)
    } catch (err: any) {
      if (generation !== loadGeneration.current || !groupMutation.scope.isCurrent()) return
      setError(err?.message || 'Erro ao carregar estrutura.')
      setFases([])
      setGrupos([])
      setSlots([])
      setPermission({})
      setGroupContract({})
      setParticipationContract({})
      setLigaPlan(null)
    } finally {
      if (generation === loadGeneration.current && groupMutation.scope.isCurrent()) setLoading(false)
    }
  }, [campeonatoId, groupMutation.scope.key])

  useEffect(() => {
    void load()
  }, [load])

  const fasesOrdenadas = useMemo(
    () => [...fases].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)),
    [fases],
  )
  const gruposOrdenados = useMemo(() => [...grupos].sort(sortGroupsByName), [grupos])

  const enrollmentGroups = useMemo(
    () => [...grupos].sort((a, b) => {
      const phaseDiff = Number(fases.find((phase) => phase.id === a.fase_id)?.ordem || 0) - Number(fases.find((phase) => phase.id === b.fase_id)?.ordem || 0)
      return phaseDiff || sortGroupsByName(a, b)
    }),
    [fases, grupos],
  )
  const selectedEnrollmentGroup = enrollmentGroups.find((group) => group.id === enrollmentGroupId) || null
  const enrollmentFreeSlots = selectedEnrollmentGroup
    ? slots.filter((slot) => slot.grupo_id === selectedEnrollmentGroup.id && slotStatus(slot) === 'livre')
    : []
  const batchSelectedCount = batchAssignments.filter((row) => row.equipeId && (row.lineId || row.lineName.trim())).length

  useEffect(() => {
    if (!enrollmentGroupId && enrollmentGroups[0]?.id) setEnrollmentGroupId(enrollmentGroups[0].id)
  }, [enrollmentGroupId, enrollmentGroups])

  function startEnrollmentInGroup(groupId = enrollmentGroupId) {
    const group = enrollmentGroups.find((item) => item.id === groupId) || null
    const freeSlots = group
      ? slots.filter((slot) => slot.grupo_id === group.id && slotStatus(slot) === 'livre')
      : []
    const slot = freeSlots[0]
    if (!slot) {
      setError('Este grupo não possui slots livres. Selecione outro grupo.')
      return
    }
    setEnrollmentGroupId(groupId)
    setSlotAlvo(slot)
    setSlotModo('adicionar')
    setBatchMode(true)
    setBatchSlots(freeSlots)
    setOrigin('')
    setBatchAssignments(freeSlots.map((freeSlot) => ({ slotId: freeSlot.id, equipeId: '', lineId: '', lineName: '', teamQuery: '', origin: '' })))
    setBatchTeamOpenIndex(null)
    setBusca('')
    setEquipe(null)
    setSlotFeedback('')
    void buscarEquipesParaSelecao('')
  }

  function nextGroupName(phaseId: string) {
    const used = new Set(
      grupos
        .filter((group) => group.fase_id === phaseId)
        .map((group) => String(group.nome || '').match(/\bgrupo\s+([a-z]+)/i)?.[1]?.toUpperCase())
        .filter(Boolean),
    )
    const next = GROUP_LETTERS.find((letter) => !used.has(letter)) || 'A'
    return `Grupo ${next}`
  }

  const bulkResumo = useMemo(() => {
    const totalGrupos = bulkPhases.reduce((sum, phase) => sum + phase.grupos.length, 0)
    const totalSlots = bulkPhases.reduce(
      (sum, phase) =>
        sum +
        phase.grupos.reduce((s, g) => {
          const n = Math.max(1, Math.min(52, Number(g.slots || phase.defaultSlots || 12)))
          return s + n
        }, 0),
      0,
    )
    return { fases: bulkPhases.length, grupos: totalGrupos, slots: totalSlots }
  }, [bulkPhases])

  function openBulkForm() {
    const nextOrdem = (fasesOrdenadas.at(-1)?.ordem || 0) + 1
    setBulkPhases([createEmptyBulkPhase(nextOrdem || 1)])
    setOpenAction('bulk')
    setCreateMenuOpen(false)
    setEditingPhase(null)
    setEditingGroup(null)
  }

  function updateBulkPhase(key: string, patch: Partial<BulkPhaseDraft>) {
    setBulkPhases((list) =>
      list.map((phase) => {
        if (phase.key !== key) return phase
        const next = { ...phase, ...patch }
        if (patch.grandeFinal === true) {
          next.nome = next.nome.trim() && next.nome !== 'Fase de grupos' ? next.nome : 'Grande Final'
          next.groupCount = '1'
          next.customizeSlots = false
          next.grupos = [{ key: next.grupos[0]?.key || newDraftKey(), letter: 'FINAL', slots: next.defaultSlots || '12' }]
        } else if (patch.grandeFinal === false && phase.grandeFinal) {
          next.groupCount = '4'
          next.grupos = buildGroupsFromCount(4, next.defaultSlots || '12')
        }
        if (!next.grandeFinal && (patch.groupCount != null || patch.defaultSlots != null)) {
          const count = Number(patch.groupCount ?? next.groupCount)
          const slots = String(patch.defaultSlots ?? next.defaultSlots)
          // Ao mudar o padrão sem personalizar, propaga slots para todos os grupos.
          const prevGroups =
            patch.defaultSlots != null && !next.customizeSlots
              ? next.grupos.map((g) => ({ ...g, slots }))
              : next.grupos
          next.grupos = buildGroupsFromCount(count, slots, prevGroups)
        }
        if (patch.customizeSlots === false) {
          next.grupos = next.grupos.map((g) => ({ ...g, slots: next.defaultSlots }))
        }
        return next
      }),
    )
  }

  function updateBulkGroupSlots(phaseKey: string, groupKey: string, slots: string) {
    setBulkPhases((list) =>
      list.map((phase) => {
        if (phase.key !== phaseKey) return phase
        return {
          ...phase,
          grupos: phase.grupos.map((g) => (g.key === groupKey ? { ...g, slots } : g)),
        }
      }),
    )
  }

  function addBulkPhase() {
    setBulkPhases((list) => {
      const maxOrdem = list.reduce((max, p) => Math.max(max, Number(p.ordem) || 0), 0)
      const base = Math.max(maxOrdem, Number(fasesOrdenadas.at(-1)?.ordem || 0))
      return [...list, createEmptyBulkPhase(base + 1)]
    })
  }

  function removeBulkPhase(key: string) {
    setBulkPhases((list) => (list.length <= 1 ? list : list.filter((p) => p.key !== key)))
  }

  async function salvarBulk() {
    try {
      const payload = {
        action: 'create_bulk',
        fases: bulkPhases.map((phase, index) => {
          const nome = phase.nome.trim()
          if (!nome) throw new Error(`Informe o nome da fase ${index + 1}.`)
          if (!phase.grupos.length) throw new Error(`A fase "${nome}" precisa de grupos.`)
          return {
            nome: phase.grandeFinal ? (nome || 'Grande Final') : nome,
            ordem: Number(phase.ordem || index + 1),
            tipo: phase.grandeFinal ? 'grande_final' : 'normal',
            grande_final: phase.grandeFinal,
            final_slots: phase.grandeFinal ? Math.max(1, Math.min(52, Number(phase.defaultSlots || 12))) : undefined,
            grupos: phase.grandeFinal ? [{
              nome: 'Grupo da Final',
              slots: Math.max(1, Math.min(52, Number(phase.defaultSlots || 12))),
            }] : phase.grupos.map((g) => ({
              nome: `Grupo ${g.letter}`,
              slots: Math.max(1, Math.min(52, Number(g.slots || phase.defaultSlots || 12))),
            })),
          }
        }),
      }
      const ok = await mutate('POST', payload)
      if (ok) setOpenAction('')
    } catch (err: any) {
      setError(err?.message || 'Erro ao montar estrutura.')
    }
  }

  function fecharSlot() {
    setSlotAlvo(null)
    setSlotModo(null)
    setBusca('')
    setResultados([])
    directory.clear()
    setEquipe(null)
    setLineId('')
    setNomeLine('')
    setOrigin('')
    setSlotFeedback('')
    setBatchMode(false)
    setBatchSlots([])
    setBatchAssignments([])
    setBatchTeamOpenIndex(null)
  }

  function updateBatchAssignment(index: number, patch: Partial<BatchSlotAssignment>) {
    setBatchAssignments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  function mergeResultados(found: EquipeBusca[]) {
    setResultados((current) => [...new Map([...current, ...found].map((item) => [item.id, item])).values()])
  }

  async function buscarEquipesParaSelecao(termo: string) {
    const found = await directory.search(termo)
    if (found) mergeResultados(found)
    return found || []
  }

  const batchSearchTerm = batchTeamOpenIndex == null ? '' : batchAssignments[batchTeamOpenIndex]?.equipeId ? '' : batchAssignments[batchTeamOpenIndex]?.teamQuery || ''
  useEffect(() => {
    if (!batchMode || batchTeamOpenIndex == null) return
    const termo = batchSearchTerm
    const timer = window.setTimeout(() => {
      void buscarEquipesParaSelecao(termo)
    }, termo ? 220 : 0)
    return () => window.clearTimeout(timer)
  }, [batchSearchTerm, batchMode, batchTeamOpenIndex])

  function batchTeamOptions(index: number) {
    const selectedIds = new Set(batchAssignments.filter((_, rowIndex) => rowIndex !== index).map((item) => item.equipeId).filter(Boolean))
    return directory.items
      .filter((item) => !selectedIds.has(item.id))
  }

  function selectBatchTeam(index: number, team: EquipeBusca | null, unavailableLineIds: Set<string>) {
    if (!team) {
      updateBatchAssignment(index, { equipeId: '', lineId: '', lineName: '', teamQuery: '', origin: '' })
      return
    }
    const selectableLines = (team.lines || []).filter((line) => !line.ja_inscrita && !unavailableLineIds.has(String(line.id)))
    updateBatchAssignment(index, {
      equipeId: team.id,
      lineId: selectableLines[0]?.id || '',
      lineName: '',
      teamQuery: `${team.nome}${team.tag ? ` · ${team.tag}` : ''}`,
      origin: '',
    })
    setBatchTeamOpenIndex(null)
  }

  async function adicionarVariosSlots() {
    if (slotOperation.current) return
    const incomplete = batchAssignments.some((row) => Boolean(row.equipeId) !== Boolean(row.lineId || row.lineName.trim()))
    const valid = batchAssignments.filter((row) => row.slotId && row.equipeId && (row.lineId || row.lineName.trim()))
    if (incomplete) {
      setSlotFeedback('Escolha uma line para cada equipe selecionada.')
      return
    }
    if (!valid.length) {
      setSlotFeedback('Selecione ao menos uma equipe e sua line.')
      return
    }
    if (new Set(valid.map((row) => row.slotId)).size !== valid.length) {
      setSlotFeedback('Cada equipe precisa usar um slot diferente.')
      return
    }
    const selectedLineIds = valid.map((row) => row.lineId).filter(Boolean)
    if (new Set(selectedLineIds).size !== selectedLineIds.length) {
      setSlotFeedback('A mesma line não pode ocupar dois slots diferentes neste grupo.')
      return
    }
    slotOperation.current = true
    setSlotBusy(true)
    setSlotFeedback('')
    try {
      // Validate the whole draft before the first write, including shared quotas.
      const pending: Array<{ grupo_id: string; origem_entrada: string }> = []
      const origins = new Map<string, string | undefined>()
      if (ligaPlan && new Set(valid.map(row => row.equipeId)).size !== valid.length) throw new Error('Uma equipe só pode ocupar uma vaga nesta Liga.')
      for (const row of valid) {
        const target = slots.find(slot => slot.id === row.slotId)
        if (!target || slotStatus(target) !== 'livre') throw new Error('Um slot selecionado deixou de estar disponível. Atualize a estrutura.')
        if (ligaPlan && slots.some(slot => slot.equipe_id === row.equipeId)) throw new Error('Esta equipe já ocupa uma vaga nesta Liga.')
        const entry = validateLigaOrigin(ligaPlan, grupos.find(group => group.id === target.grupo_id)?.nome || '', target.grupo_id, row.origin, slots, pending)
        origins.set(row.slotId, entry)
        if (entry) pending.push({ grupo_id: target.grupo_id, origem_entrada: entry })
      }
      // Each confirmed row leaves the draft; an uncertain row remains recoverable.
      for (const row of valid) {
        await campeonatoEquipesService.adicionar(campeonatoId, {
          slot_id: row.slotId,
          equipe_id: row.equipeId,
          line_id: row.lineId || undefined,
          nome_line: row.lineId ? undefined : row.lineName.trim(),
          ...(origins.get(row.slotId) ? { origem_entrada: origins.get(row.slotId) } : {}),
        }, participationContract)
        setBatchAssignments(current => current.filter(item => item.slotId !== row.slotId))
      }
      fecharSlot()
      await load({ silent: true })
      onChanged?.()
    } catch (err: any) {
      setSlotFeedback(err?.message || 'Erro ao adicionar as equipes em lote.')
      await load({ silent: true })
    } finally {
      slotOperation.current = false
      setSlotBusy(false)
    }
  }

  async function pesquisarEquipe() {
    if (!busca.trim()) return
    setSlotFeedback('')
      const found = await directory.search(busca.trim())
      if (!found) return
      if (batchMode) mergeResultados(found)
      else setResultados(found)
      if (!found.length) setSlotFeedback('Nenhuma equipe encontrada.')
      else if (batchMode) {
        setBusca('')
        setSlotFeedback(`${found.length} equipe(s) adicionada(s) à lista de seleção.`)
      }
  }

  async function carregarMaisEquipes() {
    const found = await directory.more()
    if (found) mergeResultados(found)
  }

  async function adicionarNoSlot() {
    if (slotOperation.current) return
    if (!slotAlvo?.id || !equipe?.id) {
      setSlotFeedback('Selecione a equipe.')
      return
    }
    slotOperation.current = true
    setSlotBusy(true)
    setSlotFeedback('')
    try {
      const target = slots.find(slot => slot.id === slotAlvo.id)
      if (!target || slotStatus(target) !== 'livre') throw new Error('Este slot deixou de estar disponível. Atualize a estrutura.')
      if (ligaPlan && slots.some(slot => slot.equipe_id === equipe.id)) throw new Error('Esta equipe já ocupa uma vaga nesta Liga.')
      const entry = validateLigaOrigin(ligaPlan, grupos.find(group => group.id === target.grupo_id)?.nome || '', target.grupo_id, origin, slots)
      await campeonatoEquipesService.adicionar(campeonatoId, {
        slot_id: slotAlvo.id,
        equipe_id: equipe.id,
        line_id: lineId || undefined,
        nome_line: nomeLine || undefined,
        ...(entry ? { origem_entrada: entry } : {}),
      }, participationContract)
      fecharSlot()
      await load({ silent: true })
      onChanged?.()
    } catch (err: any) {
      setSlotFeedback(err?.message || 'Erro ao adicionar.')
    } finally {
      slotOperation.current = false
      setSlotBusy(false)
    }
  }


  async function removerDoSlot(slot: Slot) {
    const participacaoId = slot.participacao_id
    if (!participacaoId) {
      setError('Não foi possível identificar a participação deste slot. Use a aba Equipes.')
      return
    }
    if (!await confirmAction('Remover a line deste slot?')) return
    setBusy(true)
    setError('')
    try {
      await campeonatoEquipesService.remover(campeonatoId, participacaoId, participationContract, slot.participation_expected)
      await load({ silent: true })
      onChanged?.()
    } catch (err: any) {
      setError(err?.message || 'Erro ao remover line.')
    } finally {
      setBusy(false)
    }
  }

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    if (body.action === 'create_group') {
      setGroupFeedback({ key: groupMutation.scope.key, text: '' })
      try {
        await groupMutation.run(groupContract, body)
        if (!groupMutation.scope.isCurrent()) return false
        setGroupFeedback({ key: groupMutation.scope.key, text: 'Grupo e slots confirmados.' })
        await load({ silent: true })
        if (groupMutation.scope.isCurrent()) onChanged?.()
        return groupMutation.scope.isCurrent()
      } catch { return false }
    }
    setBusy(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estrutura`, {
        method,
        headers,
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar estrutura.')
      await load({ silent: true })
      onChanged?.()
      return true
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar estrutura.')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="teams-tab-loading">
        <StructureGroupRecovery mutation={groupMutation} onConfirmed={() => load({ silent: true })} />
        <Loader2 size={18} className="spin" /> Carregando estrutura...
      </div>
    )
  }

  return (
    <div className="ref-section-stack">
      <StructureGroupRecovery mutation={groupMutation} onConfirmed={() => load({ silent: true })} />
      {groupFeedback.key === groupMutation.scope.key && groupFeedback.text ? <p role="status">{groupFeedback.text}</p> : null}
      {canEdit && groupContract.structure_group_write_mode !== 'atomic' ? <p className="notice">Criação de grupo temporariamente indisponível.</p> : null}
      {canAdd || canRemove ? <ParticipationRecovery championshipId={campeonatoId} contract={participationContract} onConfirmed={() => load({ silent: true, reconcileDraft: true })} /> : null}
      {error ? <div className="message error">{error}</div> : null}

      {canAdd && enrollmentGroups.length ? (
        <section className="championship-enrollment-launcher">
          <div>
            <p className="eyebrow">Inscrições</p>
            <h3>Inscrever equipes</h3>
            <span>Escolha o grupo, selecione várias equipes e lines e salve todas de uma vez.</span>
          </div>
          <div className="championship-enrollment-controls">
            <label>
              <span>Grupo</span>
              <UiSelect value={enrollmentGroupId} onChange={(event) => setEnrollmentGroupId(event.target.value)}>
                {enrollmentGroups.map((group) => {
                  const phase = fases.find((item) => item.id === group.fase_id)
                  const free = slots.filter((slot) => slot.grupo_id === group.id && slotStatus(slot) === 'livre').length
                  return <option key={group.id} value={group.id}>{phase?.nome || 'Fase 1'} · {group.nome} · {free} vaga(s)</option>
                })}
              </UiSelect>
            </label>
            <button type="button" className="button" disabled={!enrollmentFreeSlots.length} onClick={() => startEnrollmentInGroup()}>
              {enrollmentFreeSlots.length ? `Adicionar equipes · ${enrollmentFreeSlots.length} vaga(s)` : 'Grupo sem vagas'}
            </button>
          </div>
        </section>
      ) : null}

      {canEdit ? (
        <div className="structure-quick-create">
          <button
            className="structure-plus-button"
            type="button"
            title="Adicionar fase ou grupo"
            aria-label="Adicionar fase ou grupo"
            aria-expanded={createMenuOpen}
            onClick={() => setCreateMenuOpen((value) => !value)}
          >
            <Plus size={20} />
          </button>
          {createMenuOpen ? (
            <div className="structure-create-menu">
              <button type="button" onClick={openBulkForm}>
                <Layers size={17} />
                <span>
                  <strong>Montar estrutura</strong>
                  <small>Fases, grupos e slots de uma vez</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhaseForm({ nome: '', ordem: String((fasesOrdenadas.at(-1)?.ordem || 0) + 1), grandeFinal: false, finalSlots: '12' })
                  setOpenAction('phase')
                  setCreateMenuOpen(false)
                }}
              >
                <FolderOpen size={17} />
                <span>
                  <strong>Criar fase</strong>
                  <small>Uma fase por vez</small>
                </span>
              </button>
              <button
                type="button"
                disabled={!fasesOrdenadas.length}
                onClick={() => {
                  const phaseId = groupForm.fase_id || fasesOrdenadas[0]?.id || ''
                  if (!phaseId) return
                  setGroupForm((g) => ({ ...g, fase_id: phaseId, nome: nextGroupName(phaseId), slots: '12', whatsapp_url: '' }))
                  setOpenPhases((value) => ({ ...value, [phaseId]: true }))
                  setOpenAction('group')
                  setCreateMenuOpen(false)
                }}
              >
                <Folder size={17} />
                <span>
                  <strong>Criar grupo</strong>
                  <small>{fasesOrdenadas.length ? 'Dentro de uma fase' : 'Crie uma fase primeiro'}</small>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {openAction === 'bulk' && canEdit ? (
        <div className="inline-action-panel structure-bulk-form">
          <div className="structure-bulk-header">
            <div>
              <strong>Montar estrutura completa</strong>
              <p>
                Defina as fases, quantos grupos (A, B, C…) e quantos slots cada um tem.
                Tudo é salvo de uma vez — depois você ainda pode editar, adicionar ou remover individualmente.
              </p>
            </div>
            <div className="structure-bulk-summary" aria-live="polite">
              <span><b>{bulkResumo.fases}</b> fase{bulkResumo.fases === 1 ? '' : 's'}</span>
              <span><b>{bulkResumo.grupos}</b> grupo{bulkResumo.grupos === 1 ? '' : 's'}</span>
              <span><b>{bulkResumo.slots}</b> slot{bulkResumo.slots === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="structure-bulk-phases">
            {bulkPhases.map((phase, phaseIndex) => (
              <article className="structure-bulk-phase" key={phase.key}>
                <header className="structure-bulk-phase-head">
                  <strong>Fase {phaseIndex + 1}</strong>
                  {bulkPhases.length > 1 ? (
                    <button
                      type="button"
                      className="danger structure-bulk-remove"
                      title="Remover esta fase do rascunho"
                      onClick={() => removeBulkPhase(phase.key)}
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  ) : null}
                </header>

                <div className="mini-grid three structure-bulk-phase-fields">
                  <Field label="Nome da fase">
                    <UiInput
                      value={phase.nome}
                      onChange={(e) => updateBulkPhase(phase.key, { nome: e.target.value })}
                      placeholder={phaseIndex === 0 ? 'Fase de grupos' : `Fase ${phaseIndex + 1}`}
                    />
                  </Field>
                  <Field label="Ordem">
                    <UiInput
                      type="number"
                      min={1}
                      value={phase.ordem}
                      onChange={(e) => updateBulkPhase(phase.key, { ordem: e.target.value })}
                    />
                  </Field>
                  <label className="structure-bulk-customize">
                    <UiInput
                      type="checkbox"
                      checked={phase.grandeFinal}
                      disabled={bulkPhases.some((item) => item.key !== phase.key && item.grandeFinal)}
                      onChange={(e) => updateBulkPhase(phase.key, { grandeFinal: e.target.checked })}
                    />
                    <span>Grande Final</span>
                  </label>
                  <Field label={phase.grandeFinal ? 'Grupo da final' : 'Nº de grupos (A…Z)'}>
                    <UiInput
                      type="number"
                      min={1}
                      max={26}
                      disabled={phase.grandeFinal}
                      value={phase.grandeFinal ? '1' : phase.groupCount}
                      onChange={(e) => updateBulkPhase(phase.key, { groupCount: e.target.value })}
                    />
                  </Field>
                  <Field label={phase.grandeFinal ? 'Slots da final' : 'Slots por grupo'}>
                    <UiInput
                      type="number"
                      min={1}
                      max={52}
                      value={phase.defaultSlots}
                      onChange={(e) => updateBulkPhase(phase.key, { defaultSlots: e.target.value })}
                    />
                  </Field>
                  <label className="structure-bulk-customize">
                    <UiInput
                      type="checkbox"
                      checked={phase.customizeSlots}
                      disabled={phase.grandeFinal}
                      onChange={(e) => updateBulkPhase(phase.key, { customizeSlots: e.target.checked })}
                    />
                    <span>Personalizar slots de cada grupo</span>
                  </label>
                </div>

                <div className="structure-bulk-groups-preview">
                  <small>
                    {phase.grandeFinal ? 'Grupo da Final' : `Grupos: ${phase.grupos.map((g) => g.letter).join(', ')}`}
                    {!phase.grandeFinal && !phase.customizeSlots
                      ? ` · ${phase.defaultSlots || 12} slots cada`
                      : null}
                  </small>
                  {phase.customizeSlots ? (
                    <div className="structure-bulk-group-slots">
                      {phase.grupos.map((group) => (
                        <label key={group.key} className="structure-bulk-group-slot">
                          <span>Grupo {group.letter}</span>
                          <UiInput
                            type="number"
                            min={1}
                            max={52}
                            value={group.slots}
                            onChange={(e) => updateBulkGroupSlots(phase.key, group.key, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="button-row structure-bulk-actions">
            <button className="button secondary" type="button" onClick={addBulkPhase} disabled={busy}>
              <Plus size={15} />
              Adicionar fase
            </button>
            <button
              className="button"
              type="button"
              disabled={busy || bulkResumo.grupos === 0}
              onClick={() => void salvarBulk()}
            >
              {busy ? (
                <><Loader2 size={15} className="button-spinner" /> Salvando tudo...</>
              ) : (
                `Salvar tudo (${bulkResumo.fases} fase${bulkResumo.fases === 1 ? '' : 's'} · ${bulkResumo.slots} slots)`
              )}
            </button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => setOpenAction('')}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {openAction === 'phase' && canEdit ? (
        <div className="inline-action-panel structure-phase-form mini-grid">
          <Field label="Nome da fase">
            <UiInput
              value={phaseForm.nome}
              onChange={(e) => setPhaseForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Fase de grupos"
            />
          </Field>
          <Field label="Ordem">
            <UiInput
              type="number"
              value={phaseForm.ordem}
              onChange={(e) => setPhaseForm((p) => ({ ...p, ordem: e.target.value }))}
            />
          </Field>
          <Field label="Tipo da fase">
            <UiSelect
              value={phaseForm.grandeFinal ? 'grande_final' : 'normal'}
              onChange={(e) => setPhaseForm((p) => ({
                ...p,
                grandeFinal: e.target.value === 'grande_final',
                nome: e.target.value === 'grande_final' && !p.nome.trim() ? 'Grande Final' : p.nome,
              }))}
            >
              <option value="normal">Fase normal</option>
              <option value="grande_final" disabled={fases.some((fase) => fase.tipo === 'grande_final')}>Grande Final</option>
            </UiSelect>
          </Field>
          {phaseForm.grandeFinal ? (
            <Field label="Slots do Grupo da Final">
              <UiInput type="number" min={1} max={52} value={phaseForm.finalSlots} onChange={(e) => setPhaseForm((p) => ({ ...p, finalSlots: e.target.value }))} />
            </Field>
          ) : null}
          <div className="button-row">
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await mutate('POST', {
                  action: 'create_phase',
                  nome: phaseForm.nome.trim() || (phaseForm.grandeFinal ? 'Grande Final' : ''),
                  ordem: Number(phaseForm.ordem || 1),
                  grande_final: phaseForm.grandeFinal,
                  final_slots: Number(phaseForm.finalSlots || 12),
                })
                if (ok) setOpenAction('')
              }}
            >
              {busy ? <><Loader2 size={15} className="button-spinner" /> Criando...</> : 'Criar fase'}
            </button>
            <button className="button secondary" type="button" onClick={() => setOpenAction('')}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {canEdit && !fasesOrdenadas.length && openAction !== 'bulk' && openAction !== 'phase' ? (
        <div className="structure-empty-cta">
          <p>Nenhuma fase criada ainda. Monte a estrutura inteira de uma vez ou adicione fase a fase.</p>
          <div className="button-row">
            <button className="button" type="button" onClick={openBulkForm}>
              <Layers size={15} />
              Montar estrutura
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setPhaseForm({ nome: '', ordem: '1', grandeFinal: false, finalSlots: '12' })
                setOpenAction('phase')
              }}
            >
              Criar só uma fase
            </button>
          </div>
        </div>
      ) : null}

      <div className="phase-folder-tree">
        {(fasesOrdenadas.length
          ? fasesOrdenadas
          : [{ id: 'sem-fase', nome: 'Sem fase', ordem: 0 }]
        ).map((phase) => {
          const groupsOfPhase =
            phase.id === 'sem-fase'
              ? gruposOrdenados.filter((g) => !g.fase_id)
              : gruposOrdenados.filter((g) => g.fase_id === phase.id)
          if (phase.id === 'sem-fase' && groupsOfPhase.length === 0 && fasesOrdenadas.length > 0) return null
          const phaseHidden = Boolean((phase as Fase).oculta || (phase as Fase).data?.oculta)
          const phaseOpen = phaseHidden || openPhases[phase.id] === true

          return (
            <section className={phaseHidden ? 'phase-folder phase-folder-hidden-shell' : 'phase-folder'} key={phase.id}>
              {!phaseHidden ? <header className="folder-row phase-folder-row">
                <button
                  type="button"
                  className="folder-toggle"
                  onClick={() => setOpenPhases((v) => ({ ...v, [phase.id]: !phaseOpen }))}
                >
                  {phaseOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  {phaseOpen ? <FolderOpen size={20} /> : <Folder size={20} />}
                  <span>
                    <strong>{phase.nome}</strong>
                    <small>{phase.tipo === 'grande_final' ? 'Grande Final · Grupo da Final' : `${groupsOfPhase.length} grupos`}</small>
                  </span>
                </button>
                {canEdit && phase.id !== 'sem-fase' ? (
                  <div className="folder-actions">
                    <button
                      type="button"
                      title={phase.tipo === 'grande_final' ? 'A Grande Final usa somente o Grupo da Final' : 'Adicionar grupo'}
                      className="phase-add-group"
                      disabled={phase.tipo === 'grande_final'}
                      onClick={() => {
                        setEditingGroup(null)
                        setGroupForm({
                          nome: nextGroupName(phase.id),
                          fase_id: phase.id,
                          slots: '12',
                          whatsapp_url: '',
                        })
                        setOpenPhases((value) => ({ ...value, [phase.id]: true }))
                        setOpenAction('group')
                      }}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      title="Editar fase"
                      onClick={() => {
                        setEditingGroup(null)
                        setEditingPhase({
                          id: phase.id,
                          nome: phase.nome,
                          ordem: String(phase.ordem || 1),
                        })
                        setOpenPhases((value) => ({ ...value, [phase.id]: true }))
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      title="Excluir fase"
                      className="danger"
                      onClick={async () => {
                        if (await confirmAction(`Excluir ${phase.nome} e todos os grupos dela?`)) {
                          void mutate('DELETE', { entity: 'phase', id: phase.id })
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
              </header> : (
                <div className="structure-hidden-phase-note">
                  <strong>Horários</strong>
                  <small>Cada horário abaixo é um grupo independente. A Fase 1 fica oculta e existe somente para o motor do campeonato.</small>
                </div>
              )}

              {phaseOpen ? (
                <div className="phase-folder-content">
                  {editingPhase?.id === phase.id && canEdit ? (
                    <div className="inline-action-panel structure-edit-form mini-grid">
                      <Field label="Nome da fase">
                        <UiInput
                          value={editingPhase.nome}
                          onChange={(e) => setEditingPhase({ ...editingPhase, nome: e.target.value })}
                        />
                      </Field>
                      <Field label="Ordem">
                        <UiInput
                          type="number"
                          min={1}
                          value={editingPhase.ordem}
                          onChange={(e) => setEditingPhase({ ...editingPhase, ordem: e.target.value })}
                        />
                      </Field>
                      <div className="button-row structure-edit-actions">
                        <button
                          className="button"
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await mutate('PATCH', {
                              entity: 'phase',
                              id: phase.id,
                              nome: editingPhase.nome.trim(),
                              ordem: Number(editingPhase.ordem || 1),
                              grande_final: phase.tipo === 'grande_final',
                            })
                            if (ok) setEditingPhase(null)
                          }}
                        >
                          Salvar
                        </button>
                        <button className="button secondary" type="button" onClick={() => setEditingPhase(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {openAction === 'group' && groupForm.fase_id === phase.id && canEdit ? (
                    <div className="inline-action-panel phase-inline-group-form mini-grid three">
                      <Field label="Letra do grupo">
                        <UiSelect
                          value={groupForm.nome.replace(/^Grupo\s+/i, '').trim() || 'A'}
                          onChange={(e) =>
                            setGroupForm((g) => ({
                              ...g,
                              nome: `Grupo ${e.target.value}`,
                              fase_id: phase.id,
                            }))
                          }
                        >
                          {GROUP_LETTERS.map((letter) => (
                            <option key={letter} value={letter}>
                              Grupo {letter}
                            </option>
                          ))}
                        </UiSelect>
                      </Field>
                      <Field label="Slots">
                        <UiInput
                          type="number"
                          min={1}
                          max={52}
                          value={groupForm.slots}
                          onChange={(e) => setGroupForm((g) => ({ ...g, slots: e.target.value }))}
                        />
                      </Field>
                      <Field label="Link do WhatsApp">
                        <UiInput
                          value={groupForm.whatsapp_url}
                          onChange={(e) => setGroupForm((g) => ({ ...g, whatsapp_url: e.target.value }))}
                          placeholder="https://chat.whatsapp.com/..."
                        />
                      </Field>
                      <div className="button-row phase-group-form-actions">
                        <button
                          className="button"
                          type="button"
                          disabled={busy || groupMutation.busy || !groupMutation.ready || !!groupMutation.pending || groupContract.structure_group_write_mode !== 'atomic' || groupContract.structure_group_actor_id !== groupMutation.scope.actor}
                          onClick={async () => {
                            const ok = await mutate('POST', {
                              action: 'create_group',
                              nome: groupForm.nome.trim(),
                              fase_id: phase.id,
                              slots: Number(groupForm.slots || 12),
                              whatsapp_url: groupForm.whatsapp_url.trim() || null,
                            })
                            if (ok && groupMutation.scope.isCurrent()) setOpenAction('')
                          }}
                        >
                          {busy ? <><Loader2 size={15} className="button-spinner" /> Criando...</> : 'Criar grupo'}
                        </button>
                        <button className="button secondary" type="button" onClick={() => setOpenAction('')}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {groupsOfPhase.map((group) => {
                    const slotsOfGroup = slots
                      .filter((s) => s.grupo_id === group.id)
                      .sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0))
                    const groupOpen = openGroups[group.id] === true
                    const slotCount = Number(group.slots_total || group.slots || slotsOfGroup.length || 12)

                    return (
                      <article className="group-folder" key={group.id}>
                        <header className="folder-row group-folder-row">
                          <button
                            type="button"
                            className="folder-toggle"
                            onClick={() => setOpenGroups((v) => ({ ...v, [group.id]: !groupOpen }))}
                          >
                            {groupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <Folder size={18} />
                            <span>
                              <strong>{group.nome}</strong>
                              <small className={group.whatsapp_url ? 'whatsapp-ready' : 'whatsapp-missing'}>
                                {group.whatsapp_url ? (
                                  <>
                                    <CheckCircle2 size={13} /> WhatsApp configurado
                                  </>
                                ) : (
                                  <>WhatsApp não configurado</>
                                )}
                                {' · '}
                                {slotCount} slots
                              </small>
                            </span>
                          </button>
                          {canEdit ? (
                            <div className="folder-actions">
                              {canAdd ? (
                                <button
                                  type="button"
                                  className="button group-batch-enrollment"
                                  title={`Adicionar várias equipes ao ${group.nome}`}
                                  disabled={!slotsOfGroup.some((slot) => slotStatus(slot) === 'livre')}
                                  onClick={() => startEnrollmentInGroup(group.id)}
                                >
                                  <Users size={15} />
                                  <span>Adicionar equipes</span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                title="Editar grupo"
                                onClick={() => {
                                  setEditingPhase(null)
                                  setEditingGroup({
                                    id: group.id,
                                    nome: group.nome,
                                    slots: String(slotCount),
                                    whatsapp_url: String(group.whatsapp_url || ''),
                                    slot_start_letter: String(slotsOfGroup[0]?.slot_letra || 'A'),
                                  })
                                  setOpenGroups((value) => ({ ...value, [group.id]: true }))
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                title="Excluir grupo"
                                className="danger"
                                onClick={async () => {
                                  if (await confirmAction(`Excluir ${group.nome} e seus slots?`)) {
                                    void mutate('DELETE', { entity: 'group', id: group.id })
                                  }
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : null}
                        </header>

                        {groupOpen ? (
                          <>
                            {editingGroup?.id === group.id && canEdit ? (
                              <div className="inline-action-panel group-edit-form mini-grid three">
                                <Field label="Nome do grupo">
                                  <UiInput
                                    value={editingGroup.nome}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, nome: e.target.value })}
                                  />
                                </Field>
                                <Field label="Número de slots">
                                  <UiInput
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={editingGroup.slots}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, slots: e.target.value })}
                                  />
                                </Field>
                                <Field label="Iniciar sequência dos slots em">
                                  <UiInput
                                    value={editingGroup.slot_start_letter}
                                    maxLength={3}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, slot_start_letter: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
                                    placeholder="Ex.: A, G, M"
                                  />
                                </Field>
                                <Field label="Link do WhatsApp">
                                  <UiInput
                                    value={editingGroup.whatsapp_url}
                                    onChange={(e) =>
                                      setEditingGroup({ ...editingGroup, whatsapp_url: e.target.value })
                                    }
                                    placeholder="https://chat.whatsapp.com/..."
                                  />
                                </Field>
                                <div className="button-row structure-edit-actions">
                                  <button
                                    className="button"
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      const ok = await mutate('PATCH', {
                                        entity: 'group',
                                        id: group.id,
                                        nome: editingGroup.nome.trim(),
                                        slots: Number(editingGroup.slots || 1),
                                        whatsapp_url: editingGroup.whatsapp_url.trim() || null,
                                        slot_start_letter: editingGroup.slot_start_letter.trim().toUpperCase() || undefined,
                                      })
                                      if (ok) setEditingGroup(null)
                                    }}
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => setEditingGroup(null)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <div className="championship-vagas-list group-slots-list">
                              {slotsOfGroup.length === 0 ? (
                                <div className="vagas-empty-filter">Nenhum slot neste grupo.</div>
                              ) : (
                                slotsOfGroup.map((slot) => {
                                  const status = slotStatus(slot)
                                  const letter =
                                    slot.slot_letra
                                    || (slot.slot_numero
                                      ? String.fromCharCode(64 + Math.min(Number(slot.slot_numero), 26))
                                      : '?')
                                  const nomePrincipal =
                                    status === 'ocupada'
                                      ? slot.line_nome || 'Line inscrita'
                                      : status === 'reservada'
                                        ? 'Convite reservado'
                                        : `Slot ${letter}`
                                  const detalhe =
                                    status === 'ocupada'
                                      ? [
                                          slot.equipe_nome,
                                          group.nome,
                                          slot.origem_entrada ? `via ${slot.origem_entrada}` : null,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || group.nome
                                      : [phase.nome, group.nome].filter(Boolean).join(' · ')

                                  const clickable = (status === 'livre' && canAdd) || (status === 'ocupada' && canRemove)
                                  return (
                                    <article
                                      key={slot.id}
                                      className={`championship-vaga-row status-${status}`}
                                    >
                                      <button
                                        type="button"
                                        className="vaga-row-summary"
                                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                                        onClick={() => {
                                          if (status === 'livre' && canAdd) {
                                            setSlotAlvo(slot)
                                            setSlotModo('adicionar')
                                            setBatchMode(false)
                                            setOrigin('')
                                            setSlotFeedback('')
                                          } else if (status === 'ocupada' && canRemove) {
                                            void removerDoSlot(slot)
                                          }
                                        }}
                                      >
                                        <span className="vaga-row-number">{letter}</span>
                                        <span className={`vaga-row-avatar status-${status}`} aria-hidden>
                                          {status === 'ocupada' && slot.line_logo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={slot.line_logo_url} alt="" />
                                          ) : status === 'ocupada' ? (
                                            <Users size={18} />
                                          ) : (
                                            <span className="vaga-avatar-dot" />
                                          )}
                                        </span>
                                        <span className="vaga-row-identity">
                                          <strong>{nomePrincipal}</strong>
                                          <small>{detalhe}</small>
                                        </span>
                                        <span className="vaga-row-meta">
                                          {status === 'livre' && canAdd ? (
                                            <span className="vaga-status-pill status-livre">Add</span>
                                          ) : null}
                                          {status === 'ocupada' && canRemove ? (
                                            <span className="vaga-status-pill status-ocupada">Remover</span>
                                          ) : null}
                                        </span>
                                        <span className="vaga-row-chevron" aria-hidden>
                                          {clickable ? <ChevronRight size={17} /> : null}
                                        </span>
                                      </button>
                                    </article>
                                  )
                                })
                              )}
                            </div>
                          </>
                        ) : null}
                      </article>
                    )
                  })}

                  {groupsOfPhase.length === 0 ? <p className="empty">Nenhum grupo nesta fase.</p> : null}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      <SystemModal
        open={Boolean(slotAlvo && slotModo)}
        title={
          batchMode ? `Adicionar equipes · ${selectedEnrollmentGroup?.nome || 'grupo'}` : `Adicionar line · slot ${slotAlvo?.slot_letra || ''}`
        }
        description={
          batchMode ? 'Clique no campo da equipe, digite para filtrar, escolha a line e salve tudo de uma vez.' : 'Pesquise a equipe (pasta) e escolha/crie a line para este slot.'
        }
        onClose={fecharSlot}
        size={batchMode ? 'wide' : 'medium'}
      >
        <div className="seller-invite-modal">
          {slotFeedback ? <div className="message success">{slotFeedback}</div> : null}
          {directory.error ? <p role="alert">{directory.error}</p> : null}
          {directory.loading ? <p role="status">Buscando equipes...</p> : null}

          <>
            {!batchMode ? (
              <Field label="Buscar equipe">
                <div className="staff-search-row">
                  <UiInput
                    value={busca}
                    onChange={(e) => { directory.clear(); setEquipe(null); setBusca(e.target.value) }}
                    placeholder="Nome da equipe"
                    onKeyDown={(e) => { if (e.key === 'Enter') void pesquisarEquipe() }}
                  />
                  <button type="button" className="button secondary" disabled={slotBusy || directory.loading} onClick={() => void pesquisarEquipe()}>
                    Buscar
                  </button>
                </div>
              </Field>
            ) : null}
              {!batchMode && directory.nextCursor ? <button type="button" className="button secondary" disabled={directory.loading} onClick={() => void carregarMaisEquipes()}>Carregar mais equipes</button> : null}
              {!batchMode && directory.items.length > 0 ? (
                <div className="staff-search-results">
                  {directory.items.map((item: any) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`staff-search-card ${equipe?.id === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        setEquipe(item)
                        setLineId('')
                        setNomeLine('')
                      }}
                    >
                      <strong>{item.nome}</strong>
                      <span>{item.tag || 'Equipe'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {batchMode ? (
                <div className="slot-batch-editor">
                  <div className="slot-batch-head"><strong>Preencha os slots desejados</strong><span>{batchSelectedCount} de {batchSlots.length} slot(s) selecionado(s)</span></div>
                  {!resultados.length ? <p className="slot-batch-hint">Clique no campo e digite o nome, TAG ou ID da equipe.</p> : null}
                  <div className="slot-batch-table">
                    <div className="slot-batch-labels"><span>Slot</span><span>Equipe</span><span>Line</span></div>
                    {batchAssignments.map((row, index) => {
                      const selectedTeam = resultados.find((item) => item.id === row.equipeId)
                      const groupId = batchSlots[0]?.grupo_id
                      const unavailableLineIds = new Set([
                        ...slots.filter((slot) => slot.grupo_id === groupId && slot.line_id).map((slot) => String(slot.line_id)),
                        ...batchAssignments.filter((_, rowIndex) => rowIndex !== index).map((item) => item.lineId).filter(Boolean),
                      ])
                      const availableLines = (selectedTeam?.lines || []).filter((line) => !line.ja_inscrita && !unavailableLineIds.has(String(line.id)))
                      const teamOptions = batchTeamOptions(index)
                      return <div key={`${row.slotId}-${index}`}>
                        <strong className="slot-batch-slot">{batchSlots.find((slot) => slot.id === row.slotId)?.slot_letra || `Slot ${batchSlots.find((slot) => slot.id === row.slotId)?.slot_numero || index + 1}`}</strong>
                        <div className="slot-team-combobox">
                          <UiInput
                            aria-label={`Equipe ${index + 1}`}
                            value={row.teamQuery}
                            placeholder="Clique e busque a equipe"
                            onFocus={() => {
                              if (batchBlurTimer.current != null) window.clearTimeout(batchBlurTimer.current)
                              if (batchTeamOpenIndex !== index) directory.clear()
                              setBatchTeamOpenIndex(index)
                            }}
                            onBlur={() => {
                              if (batchBlurTimer.current != null) window.clearTimeout(batchBlurTimer.current)
                              batchBlurTimer.current = window.setTimeout(() => setBatchTeamOpenIndex((current) => current === index ? null : current), 120)
                            }}
                            onChange={(event) => {
                              directory.clear()
                              setBatchTeamOpenIndex(index)
                              updateBatchAssignment(index, { teamQuery: event.target.value, equipeId: '', lineId: '', lineName: '' })
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') setBatchTeamOpenIndex(null)
                              if (event.key === 'Enter' && teamOptions[0]) {
                                event.preventDefault()
                                selectBatchTeam(index, teamOptions[0], unavailableLineIds)
                              }
                            }}
                          />
                          {row.equipeId ? <button type="button" aria-label={`Limpar equipe ${index + 1}`} onClick={() => selectBatchTeam(index, null, unavailableLineIds)}>×</button> : null}
                          {batchTeamOpenIndex === index ? (
                            <div className="slot-team-options">
                              <button type="button" className="slot-team-empty" onMouseDown={(event) => event.preventDefault()} onClick={() => selectBatchTeam(index, null, unavailableLineIds)}>Deixar slot livre</button>
                              {teamOptions.map((item) => (
                                <button
                                  type="button"
                                  key={item.id}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => selectBatchTeam(index, item, unavailableLineIds)}
                                >
                                  <strong>{item.nome}</strong>
                                  <span>{item.tag || 'Equipe'} · {(item.lines || []).filter((line) => !line.ja_inscrita).length} line(s) livre(s)</span>
                                </button>
                              ))}
                              {directory.nextCursor ? <button type="button" disabled={directory.loading} onMouseDown={(event) => event.preventDefault()} onClick={() => void carregarMaisEquipes()}>Carregar mais equipes</button> : null}
                              {!directory.loading && !directory.error && !directory.nextCursor && !teamOptions.length ? <div className="slot-team-no-results">Nenhuma equipe encontrada.</div> : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="slot-batch-line">
                        <span className="slot-batch-line-label">Line</span>
                        {selectedTeam && !availableLines.length ? (
                          <UiInput aria-label={`Nova line ${index + 1}`} value={row.lineName} maxLength={80} placeholder="Nome da nova line" onChange={(event) => updateBatchAssignment(index, { lineId: '', lineName: event.target.value })}/>
                        ) : (
                          <UiSelect aria-label={`Line ${index + 1}`} value={row.lineId} disabled={!selectedTeam} onChange={(event) => updateBatchAssignment(index, { lineId: event.target.value, lineName: '' })}>
                            <option value="">Selecione a line</option>
                            {availableLines.map((line) => <option key={line.id} value={line.id}>{line.nome}</option>)}
                          </UiSelect>
                        )}
                        <LigaOriginField plan={ligaPlan} groupId={groupId || ''} groupName={grupos.find(group => group.id === groupId)?.nome || ''} slots={slots}
                          pending={batchAssignments.filter((item, other) => other !== index && item.equipeId && (item.lineId || item.lineName.trim()) && item.origin).map(item => ({ grupo_id: batchSlots.find(slot => slot.id === item.slotId)?.grupo_id || '', origem_entrada: item.origin }))}
                          value={row.origin} onChange={value => updateBatchAssignment(index, { origin: value })} disabled={slotBusy || !selectedTeam} label={`Origem da equipe ${index + 1} na Liga`} />
                        </div>
                      </div>
                    })}
                  </div>
                </div>
              ) : equipe ? (
                <>
                  <Field label="Line existente (opcional)">
                    <UiSelect value={lineId} onChange={(e) => setLineId(e.target.value)}>
                      <option value="">Criar line nova</option>
                      {(equipe.lines || []).map((l: any) => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </UiSelect>
                  </Field>
                  {!lineId ? (
                    <Field label="Nome da line nova">
                      <UiInput value={nomeLine} onChange={(e) => setNomeLine(e.target.value)} placeholder="Ex.: ALOE BASE" />
                    </Field>
                  ) : null}
                  <LigaOriginField plan={ligaPlan} groupId={slotAlvo?.grupo_id || ''} groupName={grupos.find(group => group.id === slotAlvo?.grupo_id)?.nome || ''} slots={slots} value={origin} onChange={setOrigin} disabled={slotBusy} />
                </>
              ) : null}
              <div className="modal-form-actions">
                <button type="button" className="button secondary" onClick={fecharSlot}>Cancelar</button>
                <button type="button" className="button" disabled={slotBusy || (batchMode ? !batchSelectedCount : !equipe)} onClick={() => void (batchMode ? adicionarVariosSlots() : adicionarNoSlot())}>
                  {slotBusy ? 'Salvando...' : batchMode ? `Salvar ${batchSelectedCount} equipe(s)` : 'Adicionar ao slot'}
                </button>
              </div>
          </>
        </div>
      </SystemModal>
    </div>
  )
}
