'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import {
  createAgendaItem,
  deleteAgendaItem,
  fetchAgenda,
  updateAgendaItem,
} from '../services/agenda-client'
import {
  AGENDA_TIME_SLOTS,
  MONTH_NAMES_PT,
  WEEKDAY_SHORT_PT,
  type AgendaCalendarProps,
  type AgendaEventForm,
  type AgendaItem,
} from '../types/agenda.types'
import { AgendaEventModal } from './AgendaEventModal'
import '../agenda.css'

type SlotPlacement = {
  item: AgendaItem
  startIndex: number
  span: number
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const match = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function nearestSlotIndex(time: string, slots: readonly string[]) {
  const minutes = timeToMinutes(time)
  if (minutes == null) return 0
  let best = 0
  let bestDiff = Infinity
  slots.forEach((slot, index) => {
    const slotMin = timeToMinutes(slot) ?? 0
    const diff = Math.abs(slotMin - minutes)
    if (diff < bestDiff) {
      best = index
      bestDiff = diff
    }
  })
  // se o horário for depois do slot, prefira o slot anterior ou igual
  const slotMin = timeToMinutes(slots[best]) ?? 0
  if (minutes < slotMin && best > 0) {
    // se está mais perto do anterior
    const prev = timeToMinutes(slots[best - 1]) ?? 0
    if (Math.abs(minutes - prev) <= Math.abs(minutes - slotMin)) return best - 1
  }
  return best
}

function endSlotIndex(startIndex: number, endTime: string | null, slots: readonly string[]) {
  if (!endTime) return Math.min(slots.length - 1, startIndex + 1)
  const endMinutes = timeToMinutes(endTime)
  if (endMinutes == null) return Math.min(slots.length - 1, startIndex + 1)

  let endIndex = startIndex
  for (let i = startIndex; i < slots.length; i += 1) {
    const slotMin = timeToMinutes(slots[i]) ?? 0
    if (slotMin < endMinutes) endIndex = i
    else break
  }
  // se o fim cai exatamente no slot, não inclui esse slot se start == end
  if (endIndex < startIndex) endIndex = startIndex
  // garantir ao menos 1 coluna
  if (endIndex === startIndex) {
    // se duração passa o slot atual, abre 1 a mais quando possível
    const next = startIndex + 1
    const startMin = timeToMinutes(slots[startIndex]) ?? 0
    if (next < slots.length && endMinutes - startMin > 30) return next
  }
  return endIndex
}

function placeDayEvents(items: AgendaItem[], slots: readonly string[]): {
  placements: SlotPlacement[]
  occupied: Set<number>
} {
  const sorted = [...items].sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
  const occupied = new Set<number>()
  const placements: SlotPlacement[] = []

  for (const item of sorted) {
    let start = nearestSlotIndex(item.horario_inicio, slots)
    // se o slot inicial já está ocupado, tenta o próximo livre
    while (occupied.has(start) && start < slots.length - 1) start += 1
    if (occupied.has(start)) continue

    let end = endSlotIndex(start, item.horario_fim, slots)
    // encolher se colidir
    while (end > start && Array.from({ length: end - start + 1 }, (_, i) => start + i).some((idx) => occupied.has(idx) && idx !== start)) {
      end -= 1
    }
    // se ainda colide no meio, reduz span para 1
    const spanSlots = []
    for (let i = start; i <= end; i += 1) {
      if (i !== start && occupied.has(i)) break
      spanSlots.push(i)
    }
    const finalEnd = spanSlots[spanSlots.length - 1] ?? start
    const span = finalEnd - start + 1
    for (let i = start; i <= finalEnd; i += 1) occupied.add(i)
    placements.push({ item, startIndex: start, span })
  }

  return { placements, occupied }
}

function todayISO() {
  const now = new Date()
  return padDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function AgendaCalendar(props: AgendaCalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(props.initialYear || now.getFullYear())
  const [month, setMonth] = useState(props.initialMonth || now.getMonth() + 1)
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [defaults, setDefaults] = useState<Partial<AgendaEventForm>>({})

  const canCreate = props.canCreate !== undefined
    ? Boolean(props.canCreate)
    : props.scope === 'me'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await fetchAgenda({
      scope: props.scope,
      scopeId: props.scopeId,
      year,
      month,
    })
    if (result.error) setError(result.error)
    setItems(result.items)
    setSetupRequired(result.setup_required)
    setLoading(false)
  }, [props.scope, props.scopeId, year, month])

  useEffect(() => {
    void load()
  }, [load])

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1)
    setYear(date.getFullYear())
    setMonth(date.getMonth() + 1)
  }

  const days = useMemo(() => {
    const total = daysInMonth(year, month)
    return Array.from({ length: total }, (_, index) => {
      const day = index + 1
      const date = padDate(year, month, day)
      const weekday = new Date(year, month - 1, day).getDay()
      const dayItems = items.filter((item) => item.data === date)
      const placement = placeDayEvents(dayItems, AGENDA_TIME_SLOTS)
      return {
        day,
        date,
        weekday,
        weekdayLabel: WEEKDAY_SHORT_PT[weekday],
        isWeekend: weekday === 0 || weekday === 6,
        isToday: date === todayISO(),
        items: dayItems,
        ...placement,
      }
    })
  }, [year, month, items])

  function openCreate(date?: string, time?: string) {
    if (!canCreate) return
    setSelected(null)
    setDefaults({
      data_evento: date || todayISO(),
      horario_inicio: time || '18:00',
      horario_fim: time
        ? (() => {
            const m = timeToMinutes(time)
            if (m == null) return '20:00'
            const end = Math.min(23 * 60 + 59, m + 120)
            const h = Math.floor(end / 60)
            const min = end % 60
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
          })()
        : '20:00',
      campeonato_id: props.scope === 'campeonato' ? props.scopeId || '' : '',
      equipe_id: props.scope === 'equipe' ? props.scopeId || '' : '',
      visibilidade:
        props.scope === 'campeonato'
          ? 'campeonato'
          : props.scope === 'equipe'
            ? 'equipe'
            : 'privada',
    })
    setModalMode('create')
    setModalOpen(true)
  }

  function openItem(item: AgendaItem) {
    setSelected(item)
    if (item.source === 'livre' && item.editable) {
      setModalMode('edit')
    } else {
      setModalMode('view')
    }
    setModalOpen(true)
  }

  async function handleSave(form: AgendaEventForm) {
    setSaving(true)
    try {
      if (form.id) await updateAgendaItem(form)
      else await createAgendaItem(form)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteAgendaItem(id)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const title = props.title || 'CALENDÁRIO'

  return (
    <div className={`agenda-root ${props.compact ? 'is-compact' : ''} ${props.className || ''}`}>
      <div className="agenda-toolbar">
        <div className="agenda-toolbar-copy">
          <p className="eyebrow">Agenda</p>
          {props.compact ? <h3>{title}</h3> : <h2>{title}</h2>}
        </div>
        <div className="agenda-toolbar-actions">
          <div className="agenda-month-nav">
            <button type="button" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <strong>
              {MONTH_NAMES_PT[month - 1]} {year}
            </strong>
            <button type="button" aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <button type="button" className="button secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> Atualizar
          </button>
          {canCreate ? (
            <button type="button" className="button" onClick={() => openCreate()}>
              <Plus size={16} /> Novo horário
            </button>
          ) : null}
        </div>
      </div>

      <div className="agenda-legend">
        <span>
          <i style={{ background: '#3b82f6' }} /> Jogos de campeonato
        </span>
        <span>
          <i style={{ background: '#16a34a', border: '1px dashed #fff' }} /> Agenda livre
        </span>
        <span>Clique em um horário vazio para adicionar</span>
      </div>

      {setupRequired ? (
        <div className="agenda-setup-banner">
          Agenda livre ainda precisa da migration <code>20260719_agenda_eventos.sql</code> no Supabase.
          Os jogos de campeonato já aparecem normalmente.
        </div>
      ) : null}

      {error ? <div className="agenda-error">{error}</div> : null}

      <div className={`agenda-sheet ${props.compact ? 'is-compact' : ''}`}>
        <div className="agenda-sheet-title">{title}</div>
        <div className="agenda-sheet-month">
          {MONTH_NAMES_PT[month - 1]} {year}
        </div>

        {loading ? (
          <div className="agenda-empty-month">Carregando calendário...</div>
        ) : (
          <>
            <div className="agenda-sheet-scroll">
              <table className="agenda-sheet-table">
                <thead>
                  <tr>
                    <th className="sticky-meta">Dia</th>
                    <th className="sticky-meta">Nº</th>
                    {AGENDA_TIME_SLOTS.map((slot) => (
                      <th key={slot}>{slot}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((row) => {
                    const placementByStart = new Map(row.placements.map((p) => [p.startIndex, p]))
                    const covered = new Set<number>()
                    row.placements.forEach((p) => {
                      for (let i = p.startIndex + 1; i < p.startIndex + p.span; i += 1) covered.add(i)
                    })

                    return (
                      <tr
                        key={row.date}
                        className={`${row.isWeekend ? 'is-weekend' : ''} ${row.isToday ? 'is-today' : ''}`}
                      >
                        <td className="day-name">{row.weekdayLabel}</td>
                        <td className="day-num">{row.day}</td>
                        {AGENDA_TIME_SLOTS.map((slot, slotIndex) => {
                          if (covered.has(slotIndex)) return null
                          const placement = placementByStart.get(slotIndex)
                          if (placement) {
                            return (
                              <td
                                key={slot}
                                className="slot-cell is-occupied"
                                colSpan={placement.span}
                              >
                                <button
                                  type="button"
                                  className={`agenda-event-block ${placement.item.source === 'jogo' ? 'is-jogo' : 'is-livre'}`}
                                  style={{ background: placement.item.cor }}
                                  title={`${placement.item.titulo} · ${placement.item.horario_inicio}${placement.item.horario_fim ? `–${placement.item.horario_fim}` : ''}`}
                                  onClick={() => openItem(placement.item)}
                                >
                                  {placement.item.titulo}
                                </button>
                              </td>
                            )
                          }

                          return (
                            <td
                              key={slot}
                              className={`slot-cell ${canCreate ? 'is-selectable' : ''}`}
                              onClick={() => canCreate && openCreate(row.date, slot)}
                            >
                              {slot}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* lista mobile auxiliar */}
            <div className="agenda-list-mobile" style={{ padding: 12 }}>
              {items.length === 0 ? (
                <div className="agenda-empty-month">Nenhum compromisso neste mês.</div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="agenda-list-card"
                    style={{ borderLeftColor: item.cor, textAlign: 'left', width: '100%' }}
                    onClick={() => openItem(item)}
                  >
                    <strong>{item.titulo}</strong>
                    <small>
                      {formatDateBr(item.data)} · {item.horario_inicio}
                      {item.horario_fim ? `–${item.horario_fim}` : ''}
                      {item.meta.campeonato_nome ? ` · ${item.meta.campeonato_nome}` : ''}
                    </small>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <AgendaEventModal
        open={modalOpen}
        mode={modalMode}
        item={selected}
        defaults={defaults}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={canCreate ? handleDelete : undefined}
      />
    </div>
  )
}

function formatDateBr(value: string) {
  const [y, m, d] = String(value).slice(0, 10).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}
