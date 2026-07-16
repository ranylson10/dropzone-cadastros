'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { Field } from '@/features/dropzone/components/form-fields'
import { supabase } from '@/lib/supabase-browser'
import { GROUP_LETTERS } from '@/lib/dropzone-constants'

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
  role?: string
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

export function CampeonatoEstruturaTab({ campeonatoId }: { campeonatoId: string }) {
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
  const [openAction, setOpenAction] = useState<'phase' | 'group' | ''>('')
  const [phaseForm, setPhaseForm] = useState({ nome: '', ordem: '1' })
  const [groupForm, setGroupForm] = useState({ nome: 'Grupo A', fase_id: '', slots: '12', whatsapp_url: '' })
  const [editingPhase, setEditingPhase] = useState<{ id: string; nome: string; ordem: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; nome: string; slots: string; whatsapp_url: string } | null>(null)

  const canEdit = Boolean(permission.canOrganizeGroups)

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
                  <small>Nova etapa do campeonato</small>
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

      <div className="phase-folder-tree">
        {(fasesOrdenadas.length
          ? fasesOrdenadas
          : [{ id: 'sem-fase', nome: 'Sem fase', ordem: 0 }]
        ).map((phase) => {
          const groupsOfPhase =
            phase.id === 'sem-fase'
              ? grupos.filter((g) => !g.fase_id)
              : grupos.filter((g) => g.fase_id === phase.id)
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

                                  return (
                                    <article
                                      key={slot.id}
                                      className={`championship-vaga-row status-${status}`}
                                    >
                                      <div className="vaga-row-summary" style={{ cursor: 'default' }}>
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
                                        <span className="vaga-row-meta" />
                                        <span className="vaga-row-chevron" aria-hidden />
                                      </div>
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
    </div>
  )
}
