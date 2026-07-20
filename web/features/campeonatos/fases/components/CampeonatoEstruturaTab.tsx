'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { CampeonatoVaga, EquipeBusca } from '@/features/campeonatos/equipes/types/campeonato-equipes.types'

type Fase = { id: string; nome: string; ordem?: number }
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
  groupCount: string
  defaultSlots: string
  customizeSlots: boolean
  grupos: BulkGroupDraft[]
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function slotStatus(slot: Slot): 'livre' | 'reservada' | 'ocupada' {
  if (slot.line_id || slot.equipe_id) return 'ocupada'
  if (slot.status === 'reservado' || slot.status === 'reservada') return 'reservada'
  return 'livre'
}

function sortGroupsByName(a: Grupo, b: Grupo) {
  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', {
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
    groupCount: '4',
    defaultSlots,
    customizeSlots: false,
    grupos: buildGroupsFromCount(4, defaultSlots),
  }
}

export function CampeonatoEstruturaTab({
  campeonatoId,
  onChanged,
}: {
  campeonatoId: string
  /** Chamado após criar/editar/excluir estrutura — útil para recarregar jogos/links no painel pai. */
  onChanged?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fases, setFases] = useState<Fase[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [permission, setPermission] = useState<Permission>({})
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [openAction, setOpenAction] = useState<'phase' | 'group' | 'bulk' | ''>('')
  const [phaseForm, setPhaseForm] = useState({ nome: '', ordem: '1' })
  const [groupForm, setGroupForm] = useState({ nome: 'Grupo A', fase_id: '', slots: '12', whatsapp_url: '' })
  const [bulkPhases, setBulkPhases] = useState<BulkPhaseDraft[]>(() => [createEmptyBulkPhase(1)])
  const [editingPhase, setEditingPhase] = useState<{ id: string; nome: string; ordem: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; nome: string; slots: string; whatsapp_url: string } | null>(null)

  // Slot: adicionar / remover line
  const [slotAlvo, setSlotAlvo] = useState<Slot | null>(null)
  const [slotModo, setSlotModo] = useState<'adicionar' | 'convite' | null>(null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<EquipeBusca[]>([])
  const [equipe, setEquipe] = useState<EquipeBusca | null>(null)
  const [lineId, setLineId] = useState('')
  const [nomeLine, setNomeLine] = useState('')
  const [refEquipe, setRefEquipe] = useState('')
  const [refLine, setRefLine] = useState('')
  const [slotBusy, setSlotBusy] = useState(false)
  const [slotFeedback, setSlotFeedback] = useState('')
  const [vagasIndex, setVagasIndex] = useState<Record<string, CampeonatoVaga>>({})

  const canEdit = Boolean(permission.canOrganizeGroups)
  const canAdd = Boolean(permission.canManage)
  const canRemove = Boolean(permission.canRemove)
  const canInvite = Boolean(permission.canGenerateToken)

  const load = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estrutura`, {
        headers,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar estrutura.')
      setFases(Array.isArray(json.fases) ? json.fases : [])
      setGrupos(Array.isArray(json.grupos) ? json.grupos : [])
      setSlots(Array.isArray(json.slots) ? json.slots : [])
      setPermission(json.permission || {})
      // index de vagas para participacao_id ao remover
      try {
        const eq = await campeonatoEquipesService.listar(campeonatoId) as any
        const map: Record<string, CampeonatoVaga> = {}
        for (const v of eq.vagas || []) {
          if (v.id) map[v.id] = v
        }
        setVagasIndex(map)
        if (eq.permission) {
          setPermission((p) => ({
            ...p,
            canManage: eq.permission.canManage ?? p.canManage,
            canRemove: eq.permission.canRemove ?? p.canRemove,
            canGenerateToken: eq.permission.canGenerateToken ?? p.canGenerateToken,
            canOrganizeGroups: eq.permission.canOrganizeGroups ?? p.canOrganizeGroups,
          }))
        }
      } catch {
        // opcional
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar estrutura.')
      setFases([])
      setGrupos([])
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [campeonatoId])

  useEffect(() => {
    void load()
  }, [load])

  const fasesOrdenadas = useMemo(
    () => [...fases].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)),
    [fases],
  )
  const gruposOrdenados = useMemo(() => [...grupos].sort(sortGroupsByName), [grupos])

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
        if (patch.groupCount != null || patch.defaultSlots != null) {
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
            nome,
            ordem: Number(phase.ordem || index + 1),
            grupos: phase.grupos.map((g) => ({
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
    setEquipe(null)
    setLineId('')
    setNomeLine('')
    setRefEquipe('')
    setRefLine('')
    setSlotFeedback('')
  }

  async function pesquisarEquipe() {
    if (!busca.trim()) return
    setSlotBusy(true)
    setSlotFeedback('')
    try {
      const json = await campeonatoEquipesService.buscarEquipes(campeonatoId, busca.trim()) as any
      setResultados(Array.isArray(json.equipes) ? json.equipes : json.items || [])
      if (!(json.equipes || json.items || []).length) setSlotFeedback('Nenhuma equipe encontrada.')
    } catch (err: any) {
      setSlotFeedback(err?.message || 'Erro na busca.')
      setResultados([])
    } finally {
      setSlotBusy(false)
    }
  }

  async function adicionarNoSlot() {
    if (!slotAlvo?.id || !equipe?.id) {
      setSlotFeedback('Selecione a equipe.')
      return
    }
    setSlotBusy(true)
    setSlotFeedback('')
    try {
      await campeonatoEquipesService.adicionar(campeonatoId, {
        slot_id: slotAlvo.id,
        equipe_id: equipe.id,
        line_id: lineId || undefined,
        nome_line: nomeLine || undefined,
      })
      fecharSlot()
      await load()
      onChanged?.()
    } catch (err: any) {
      setSlotFeedback(err?.message || 'Erro ao adicionar.')
    } finally {
      setSlotBusy(false)
    }
  }

  async function criarConviteSlot() {
    if (!slotAlvo?.id || !refEquipe.trim() || !refLine.trim()) {
      setSlotFeedback('Informe referências da equipe e da line.')
      return
    }
    setSlotBusy(true)
    setSlotFeedback('')
    try {
      const json = await campeonatoEquipesService.criarConvite(campeonatoId, {
        slot_id: slotAlvo.id,
        grupo_id: slotAlvo.grupo_id,
        fixar_slot: true,
        nome_equipe_reservada: refEquipe.trim(),
        nome_line_reservada: refLine.trim(),
      }) as any
      const token = json.token?.token || json.convite?.token || json.token
      if (token) {
        const link = `${window.location.origin}/convite/equipe/${token}`
        await navigator.clipboard?.writeText(link).catch(() => null)
        setSlotFeedback(`Convite criado e copiado: ${link}`)
      } else {
        setSlotFeedback(json.mensagem || 'Convite criado.')
      }
      await load()
    } catch (err: any) {
      setSlotFeedback(err?.message || 'Erro ao criar convite.')
    } finally {
      setSlotBusy(false)
    }
  }

  async function removerDoSlot(slot: Slot) {
    const vaga = vagasIndex[slot.id]
    const participacaoId = vaga?.campeonato_equipe?.id || (vaga as any)?.participacao_id
    if (!participacaoId) {
      setError('Não foi possível identificar a participação deste slot. Use a aba Equipes.')
      return
    }
    if (!window.confirm('Remover a line deste slot?')) return
    setBusy(true)
    setError('')
    try {
      await campeonatoEquipesService.remover(campeonatoId, participacaoId)
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err?.message || 'Erro ao remover line.')
    } finally {
      setBusy(false)
    }
  }

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
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
      await load()
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
        <Loader2 size={18} className="spin" /> Carregando estrutura...
      </div>
    )
  }

  return (
    <div className="ref-section-stack">
      {error ? <div className="message error">{error}</div> : null}

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
                  setPhaseForm({ nome: '', ordem: String((fasesOrdenadas.at(-1)?.ordem || 0) + 1) })
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
                  setGroupForm((g) => ({ ...g, fase_id: phaseId, nome: 'Grupo A', slots: '12', whatsapp_url: '' }))
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
                    <input
                      value={phase.nome}
                      onChange={(e) => updateBulkPhase(phase.key, { nome: e.target.value })}
                      placeholder={phaseIndex === 0 ? 'Fase de grupos' : `Fase ${phaseIndex + 1}`}
                    />
                  </Field>
                  <Field label="Ordem">
                    <input
                      type="number"
                      min={1}
                      value={phase.ordem}
                      onChange={(e) => updateBulkPhase(phase.key, { ordem: e.target.value })}
                    />
                  </Field>
                  <Field label="Nº de grupos (A…Z)">
                    <input
                      type="number"
                      min={1}
                      max={26}
                      value={phase.groupCount}
                      onChange={(e) => updateBulkPhase(phase.key, { groupCount: e.target.value })}
                    />
                  </Field>
                  <Field label="Slots por grupo">
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={phase.defaultSlots}
                      onChange={(e) => updateBulkPhase(phase.key, { defaultSlots: e.target.value })}
                    />
                  </Field>
                  <label className="structure-bulk-customize">
                    <input
                      type="checkbox"
                      checked={phase.customizeSlots}
                      onChange={(e) => updateBulkPhase(phase.key, { customizeSlots: e.target.checked })}
                    />
                    <span>Personalizar slots de cada grupo</span>
                  </label>
                </div>

                <div className="structure-bulk-groups-preview">
                  <small>
                    Grupos: {phase.grupos.map((g) => g.letter).join(', ')}
                    {!phase.customizeSlots
                      ? ` · ${phase.defaultSlots || 12} slots cada`
                      : null}
                  </small>
                  {phase.customizeSlots ? (
                    <div className="structure-bulk-group-slots">
                      {phase.grupos.map((group) => (
                        <label key={group.key} className="structure-bulk-group-slot">
                          <span>Grupo {group.letter}</span>
                          <input
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
            <input
              value={phaseForm.nome}
              onChange={(e) => setPhaseForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Fase de grupos"
            />
          </Field>
          <Field label="Ordem">
            <input
              type="number"
              value={phaseForm.ordem}
              onChange={(e) => setPhaseForm((p) => ({ ...p, ordem: e.target.value }))}
            />
          </Field>
          <div className="button-row">
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await mutate('POST', {
                  action: 'create_phase',
                  nome: phaseForm.nome.trim(),
                  ordem: Number(phaseForm.ordem || 1),
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
                setPhaseForm({ nome: '', ordem: '1' })
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
          const phaseOpen = openPhases[phase.id] !== false

          return (
            <section className="phase-folder" key={phase.id}>
              <header className="folder-row phase-folder-row">
                <button
                  type="button"
                  className="folder-toggle"
                  onClick={() => setOpenPhases((v) => ({ ...v, [phase.id]: !phaseOpen }))}
                >
                  {phaseOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  {phaseOpen ? <FolderOpen size={20} /> : <Folder size={20} />}
                  <span>
                    <strong>{phase.nome}</strong>
                    <small>{groupsOfPhase.length} grupos</small>
                  </span>
                </button>
                {canEdit && phase.id !== 'sem-fase' ? (
                  <div className="folder-actions">
                    <button
                      type="button"
                      title="Adicionar grupo"
                      className="phase-add-group"
                      onClick={() => {
                        setEditingGroup(null)
                        setGroupForm({
                          nome: 'Grupo A',
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
                      onClick={() => {
                        if (window.confirm(`Excluir ${phase.nome} e todos os grupos dela?`)) {
                          void mutate('DELETE', { entity: 'phase', id: phase.id })
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
              </header>

              {phaseOpen ? (
                <div className="phase-folder-content">
                  {editingPhase?.id === phase.id && canEdit ? (
                    <div className="inline-action-panel structure-edit-form mini-grid">
                      <Field label="Nome da fase">
                        <input
                          value={editingPhase.nome}
                          onChange={(e) => setEditingPhase({ ...editingPhase, nome: e.target.value })}
                        />
                      </Field>
                      <Field label="Ordem">
                        <input
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
                        <select
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
                        </select>
                      </Field>
                      <Field label="Slots">
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={groupForm.slots}
                          onChange={(e) => setGroupForm((g) => ({ ...g, slots: e.target.value }))}
                        />
                      </Field>
                      <Field label="Link do WhatsApp">
                        <input
                          value={groupForm.whatsapp_url}
                          onChange={(e) => setGroupForm((g) => ({ ...g, whatsapp_url: e.target.value }))}
                          placeholder="https://chat.whatsapp.com/..."
                        />
                      </Field>
                      <div className="button-row phase-group-form-actions">
                        <button
                          className="button"
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await mutate('POST', {
                              action: 'create_group',
                              nome: groupForm.nome.trim(),
                              fase_id: phase.id,
                              slots: Number(groupForm.slots || 12),
                              whatsapp_url: groupForm.whatsapp_url.trim() || null,
                            })
                            if (ok) setOpenAction('')
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
                    const groupOpen = openGroups[group.id] !== false
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
                                onClick={() => {
                                  if (window.confirm(`Excluir ${group.nome} e seus slots?`)) {
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
                                  <input
                                    value={editingGroup.nome}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, nome: e.target.value })}
                                  />
                                </Field>
                                <Field label="Número de slots">
                                  <input
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={editingGroup.slots}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, slots: e.target.value })}
                                  />
                                </Field>
                                <Field label="Link do WhatsApp">
                                  <input
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

                                  const clickable = (status === 'livre' && (canAdd || canInvite)) || (status === 'ocupada' && canRemove)
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
                                          if (status === 'livre' && (canAdd || canInvite)) {
                                            setSlotAlvo(slot)
                                            setSlotModo(canAdd ? 'adicionar' : 'convite')
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
          slotModo === 'convite'
            ? `Convite · slot ${slotAlvo?.slot_letra || ''}`
            : `Adicionar line · slot ${slotAlvo?.slot_letra || ''}`
        }
        description={
          slotModo === 'convite'
            ? 'Gera link único para a equipe ocupar este slot.'
            : 'Pesquise a equipe (pasta) e escolha/crie a line.'
        }
        onClose={fecharSlot}
        size="medium"
      >
        <div className="seller-invite-modal">
          {slotFeedback ? <div className="message success">{slotFeedback}</div> : null}

          {slotModo === 'adicionar' ? (
            <>
              <Field label="Buscar equipe">
                <div className="staff-search-row">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Nome da equipe"
                    onKeyDown={(e) => { if (e.key === 'Enter') void pesquisarEquipe() }}
                  />
                  <button type="button" className="button secondary" disabled={slotBusy} onClick={() => void pesquisarEquipe()}>
                    Buscar
                  </button>
                </div>
              </Field>
              {resultados.length > 0 ? (
                <div className="staff-search-results">
                  {resultados.map((item: any) => (
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
              {equipe ? (
                <>
                  <Field label="Line existente (opcional)">
                    <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
                      <option value="">Criar line nova</option>
                      {(equipe.lines || []).map((l: any) => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                  </Field>
                  {!lineId ? (
                    <Field label="Nome da line nova">
                      <input value={nomeLine} onChange={(e) => setNomeLine(e.target.value)} placeholder="Ex.: ALOE BASE" />
                    </Field>
                  ) : null}
                </>
              ) : null}
              <div className="modal-form-actions">
                {canInvite ? (
                  <button type="button" className="button secondary" onClick={() => setSlotModo('convite')}>
                    Gerar convite
                  </button>
                ) : null}
                <button type="button" className="button secondary" onClick={fecharSlot}>Cancelar</button>
                <button type="button" className="button" disabled={slotBusy || !equipe} onClick={() => void adicionarNoSlot()}>
                  {slotBusy ? 'Salvando...' : 'Adicionar ao slot'}
                </button>
              </div>
            </>
          ) : (
            <>
              <Field label="Referência da equipe">
                <input value={refEquipe} onChange={(e) => setRefEquipe(e.target.value)} placeholder="Nome interno" />
              </Field>
              <Field label="Referência da line">
                <input value={refLine} onChange={(e) => setRefLine(e.target.value)} placeholder="Nome da line" />
              </Field>
              <div className="modal-form-actions">
                {canAdd ? (
                  <button type="button" className="button secondary" onClick={() => setSlotModo('adicionar')}>
                    Adicionar direto
                  </button>
                ) : null}
                <button type="button" className="button secondary" onClick={fecharSlot}>Cancelar</button>
                <button type="button" className="button" disabled={slotBusy} onClick={() => void criarConviteSlot()}>
                  {slotBusy ? 'Gerando...' : 'Criar convite'}
                </button>
              </div>
            </>
          )}
        </div>
      </SystemModal>
    </div>
  )
}
