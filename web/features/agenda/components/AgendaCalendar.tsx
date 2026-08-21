'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, Search } from 'lucide-react'
import {
  createAgendaItem,
  deleteAgendaItem,
  fetchAgenda,
  updateAgendaGame,
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

function formatEventDay(value: string) {
  const [year, month, day] = String(value).slice(0, 10).split('-')
  if (!year || !month || !day) return value
  const weekday = WEEKDAY_SHORT_PT[new Date(Number(year), Number(month) - 1, Number(day)).getDay()]
  return `${weekday}, ${day}`
}

function monthGroupKey(value: string) {
  return String(value).slice(0, 7)
}

function formatMonthGroup(value: string) {
  const [year, month] = value.split('-')
  return `${MONTH_NAMES_PT[Number(month) - 1]} ${year}`
}

export function AgendaCalendar(props: AgendaCalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(props.initialYear || now.getFullYear())
  const [month, setMonth] = useState(props.initialMonth || now.getMonth() + 1)
  const [items, setItems] = useState<AgendaItem[]>([])
  const [unscheduled, setUnscheduled] = useState<AgendaItem[]>([])
  const [allItems, setAllItems] = useState<AgendaItem[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [managedChampionships, setManagedChampionships] = useState<Array<{ id: string; nome: string }>>([])
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [defaults, setDefaults] = useState<Partial<AgendaEventForm>>({})
  const [editingGame, setEditingGame] = useState<AgendaItem | null>(null)
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')

  // A agenda é uma única central de consulta. Datas oficiais vêm dos jogos;
  // não há mais calendário livre criado dentro de perfis ou pela página /agenda.
  const canCreate = false
  const contextualMode = false
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [result, directory] = await Promise.all([
      fetchAgenda({ scope: props.scope, scopeId: props.scopeId, year, month }),
      fetchAgenda({ scope: props.scope, scopeId: props.scopeId, year, month, all: true }),
    ])
    if (result.error) setError(result.error)
    setItems(result.items)
    setUnscheduled(result.unscheduled)
    setAllItems([...directory.items, ...directory.unscheduled])
    setCanManage(result.can_manage)
    setManagedChampionships(result.managed_championships)
    setLoading(false)
  }, [props.scope, props.scopeId, year, month, contextualMode])

  useEffect(() => {
    void load()
  }, [load])

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1)
    const nextYear = date.getFullYear()
    const nextMonth = date.getMonth() + 1
    setYear(nextYear)
    setMonth(nextMonth)
    setSelectedDate(padDate(nextYear, nextMonth, 1))
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

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) || days.find((day) => day.isToday) || days[0],
    [days, selectedDate],
  )

  const visibleDayStrip = useMemo(() => {
    if (!days.length) return []
    const selectedIndex = Math.max(0, days.findIndex((day) => day.date === selectedDay?.date))
    const start = Math.max(0, Math.min(days.length - 7, selectedIndex - 3))
    return days.slice(start, start + 7)
  }, [days, selectedDay?.date])


  const eventMonths = useMemo(() => {
    const dates = new Map<string, AgendaItem[]>()
    items
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data) || a.horario_inicio.localeCompare(b.horario_inicio))
      .forEach((item) => {
        const current = dates.get(item.data) || []
        current.push(item)
        dates.set(item.data, current)
      })

    const months = new Map<string, Array<{ date: string; items: AgendaItem[] }>>()
    Array.from(dates.entries()).forEach(([date, dateItems]) => {
      const key = monthGroupKey(date)
      const current = months.get(key) || []
      current.push({ date, items: dateItems })
      months.set(key, current)
    })

    return Array.from(months.entries()).map(([key, datesInMonth]) => ({
      key,
      label: formatMonthGroup(key),
      dates: datesInMonth,
    }))
  }, [items])

  function shiftSelectedDay(delta: number) {
    if (!selectedDay) return
    const date = new Date(`${selectedDay.date}T12:00:00`)
    date.setDate(date.getDate() + delta)
    const nextYear = date.getFullYear()
    const nextMonth = date.getMonth() + 1
    const nextDate = padDate(nextYear, nextMonth, date.getDate())
    if (nextYear !== year || nextMonth !== month) {
      setYear(nextYear)
      setMonth(nextMonth)
    }
    setSelectedDate(nextDate)
  }

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
      campeonato_id: props.scope === 'campeonato' ? props.scopeId || '' : managedChampionships[0]?.id || '',
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
    if (canCreate && item.source === 'livre' && item.editable) {
      setModalMode('edit')
    } else {
      setModalMode('view')
    }
    setModalOpen(true)
  }

  function openGameEditor(item: AgendaItem) {
    if (!item.editable || !item.meta.jogo_id) return
    setEditingGame(item)
    setGameDate(item.data)
    setGameTime(item.horario_inicio.slice(0, 5))
  }

  function jumpToEvent(item: AgendaItem) {
    if (!item.data) {
      if (item.editable) openGameEditor(item)
      else openItem(item)
      return
    }
    const [nextYear, nextMonth] = item.data.split('-').map(Number)
    if (Number.isFinite(nextYear) && Number.isFinite(nextMonth)) {
      setYear(nextYear)
      setMonth(nextMonth)
      setSelectedDate(item.data)
    }
  }

  const visibleListItems = useMemo(() => {
    const search = eventSearch.trim().toLocaleLowerCase('pt-BR')
    const unique = [...new Map(allItems.map((item) => [item.id, item])).values()]
    return unique
      .filter((item) => !search || [item.titulo, item.meta.campeonato_nome, item.data].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(search))
      .sort((a, b) => (a.data || '9999-12-31').localeCompare(b.data || '9999-12-31') || a.horario_inicio.localeCompare(b.horario_inicio))
  }, [allItems, eventSearch])

  async function saveGameSchedule() {
    if (!editingGame?.meta.jogo_id) return
    setSaving(true)
    try {
      await updateAgendaGame(editingGame.meta.jogo_id, gameDate, gameTime)
      setEditingGame(null)
      await load()
    } catch (saveError: any) {
      setError(saveError?.message || 'Não foi possível reorganizar o jogo.')
    } finally {
      setSaving(false)
    }
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

  const rawTitle = props.title || 'CALENDÁRIO'
  const title = rawTitle.replace(/^CALENDÁRIO/i, 'AGENDA')

  return (
    <div className={`agenda-root ${props.compact ? 'is-compact' : ''} ${props.className || ''}`}>
      <div className="agenda-toolbar">
        <div className="agenda-toolbar-copy">
          <p className="eyebrow">Agenda</p>
          {props.compact ? <h3>{title}</h3> : <h2>{title}</h2>}
        </div>
        <div className="agenda-toolbar-actions">
          {!contextualMode ? <div className="agenda-month-nav">
            <button type="button" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <strong>
              {MONTH_NAMES_PT[month - 1]} {year}
            </strong>
            <button type="button" aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div> : null}
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

      {!contextualMode ? (
        <div className="agenda-legend">
          <span>
            <i style={{ background: '#3b82f6' }} /> Jogos de campeonato
          </span>
          <span>
            <i style={{ background: '#16a34a', border: '1px dashed #fff' }} /> Agenda livre
          </span>
          {canCreate ? <span>Clique em um horário vazio para adicionar</span> : <span>Agenda somente para consulta</span>}
        </div>
      ) : null}

      {error ? <div className="agenda-error">{error}</div> : null}

      <div className="agenda-content-grid">
      <div className={`agenda-sheet ${props.compact ? 'is-compact' : ''}`}>
        <div className="agenda-sheet-title">{title}</div>
        {!contextualMode ? (
          <div className="agenda-sheet-month">
            {MONTH_NAMES_PT[month - 1]} {year}
          </div>
        ) : null}

        {loading ? (
          <div className="agenda-loading" aria-label="Carregando calendário">
            <span />
            <span />
            <span />
          </div>
        ) : contextualMode ? (
          <div className="agenda-sequence" data-testid="agenda-event-only">
            {eventMonths.length === 0 ? (
              <div className="agenda-day-empty">Nenhum jogo ou compromisso agendado nos próximos meses.</div>
            ) : (
              eventMonths.map((monthGroup) => (
                <section key={monthGroup.key} className="agenda-sequence-month">
                  <header className="agenda-sequence-month-head">
                    <CalendarDays size={16} />
                    <strong>{monthGroup.label}</strong>
                    <span>{monthGroup.dates.reduce((total, entry) => total + entry.items.length, 0)} compromisso(s)</span>
                  </header>
                  <div className="agenda-sequence-days">
                    {monthGroup.dates.map((entry) => (
                      <div key={entry.date} className="agenda-sequence-day">
                        <div className="agenda-sequence-date">
                          <strong>{formatEventDay(entry.date)}</strong>
                          <small>{entry.items.length} compromisso(s)</small>
                        </div>
                        <div className="agenda-sequence-events">
                          {entry.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`agenda-sequence-event ${item.source === 'jogo' ? 'is-jogo' : 'is-livre'}`}
                              style={{ ['--agenda-event-color' as string]: item.cor }}
                              onClick={() => openItem(item)}
                            >
                              <span className="agenda-sequence-time">
                                <Clock3 size={14} />
                                <strong>{item.horario_inicio}</strong>
                                {item.horario_fim ? <small>{item.horario_fim}</small> : null}
                              </span>
                              <span className="agenda-sequence-copy">
                                <strong>{item.titulo}</strong>
                                <small>{item.meta.campeonato_nome || item.meta.equipe_nome || item.tipo}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="agenda-day-navigation">
              <button type="button" aria-label="Dia anterior" onClick={() => shiftSelectedDay(-1)}>
                <ChevronLeft size={17} />
              </button>
              <div className="agenda-day-strip">
                {visibleDayStrip.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className={`${day.date === selectedDay?.date ? 'is-active' : ''} ${day.isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <small>{day.weekdayLabel}</small>
                    <strong>{String(day.day).padStart(2, '0')}</strong>
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Próximo dia" onClick={() => shiftSelectedDay(1)}>
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="agenda-day-panel">
              <div className="agenda-day-panel-head">
                <span>
                  <CalendarDays size={16} />
                  {selectedDay ? `${selectedDay.weekdayLabel}, ${String(selectedDay.day).padStart(2, '0')} ${MONTH_NAMES_PT[month - 1].slice(0, 3)}` : 'Agenda'}
                </span>
                <small>{selectedDay?.items.length || 0} compromisso(s)</small>
              </div>
              <div className="agenda-day-events">
                {selectedDay?.items.length ? (
                  selectedDay.items
                    .slice()
                    .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`agenda-timeline-event ${item.source === 'jogo' ? 'is-jogo' : 'is-livre'}`}
                        style={{ ['--agenda-event-color' as string]: item.cor }}
                        onClick={() => openItem(item)}
                      >
                        <span className="agenda-timeline-time">
                          <Clock3 size={14} />
                          {item.horario_inicio}
                          {item.horario_fim ? <small>{item.horario_fim}</small> : null}
                        </span>
                        <span className="agenda-timeline-copy">
                          <strong>{item.titulo}</strong>
                          <small>
                            {item.meta.campeonato_nome || item.meta.equipe_nome || (item.source === 'jogo' ? 'Jogo de campeonato' : item.tipo)}
                          </small>
                        </span>
                      </button>
                    ))
                ) : (
                  <div className="agenda-day-empty">Nenhum compromisso neste dia.</div>
                )}
                {canCreate ? (
                  <div className="agenda-available-slots">
                    {AGENDA_TIME_SLOTS.filter(
                      (slot) => !selectedDay?.items.some((item) => nearestSlotIndex(item.horario_inicio, AGENDA_TIME_SLOTS) === AGENDA_TIME_SLOTS.indexOf(slot)),
                    ).map((slot) => (
                      <button key={slot} type="button" onClick={() => openCreate(selectedDay?.date, slot)}>
                        <Plus size={13} /> {slot} livre
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

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

          </>
        )}
      </div>

      <aside className="agenda-event-list" aria-label="Lista de eventos do mês">
        <header>
          <div>
            <p className="eyebrow">Compromissos</p>
            <h3>{visibleListItems.length} compromisso{visibleListItems.length === 1 ? '' : 's'}</h3>
          </div>
          <small>{MONTH_NAMES_PT[month - 1].slice(0, 3)} {year}</small>
        </header>
        <label className="agenda-event-search">
          <Search size={14} />
          <input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Pesquisar evento ou campeonato" />
        </label>
        <div className="agenda-event-list-items">
          {visibleListItems.length ? <>
            {visibleListItems.map((item) => (
            <article key={`list-${item.id}`} className="agenda-event-list-item">
              <button type="button" className="agenda-event-list-open" onClick={() => jumpToEvent(item)}>
                <time>{item.data ? `${item.data.slice(8, 10)}/${item.data.slice(5, 7)} · ${item.horario_inicio.slice(0, 5)}` : 'PARA AGENDAR'}</time>
                <strong>{item.titulo}</strong>
                <small>{item.meta.campeonato_nome || 'Campeonato'}</small>
              </button>
              {item.editable ? <button type="button" className="agenda-event-list-edit" onClick={() => openGameEditor(item)}>Ajustar</button> : null}
            </article>
            ))}
          </> : <p className="agenda-event-list-empty">Nenhum jogo neste mês.</p>}
        </div>
      </aside>
      </div>

      {editingGame ? (
        <section className="agenda-game-editor" role="dialog" aria-modal="true" aria-label="Reorganizar jogo">
          <div>
            <p className="eyebrow">Organizar jogo</p>
            <h3>{editingGame.titulo}</h3>
            <p>{editingGame.meta.campeonato_nome}</p>
          </div>
          <label>Data<input type="date" value={gameDate} onChange={(event) => setGameDate(event.target.value)} /></label>
          <label>Horário<input type="time" value={gameTime} onChange={(event) => setGameTime(event.target.value)} /></label>
          <div className="agenda-game-editor-actions">
            <button type="button" className="button secondary" onClick={() => setEditingGame(null)} disabled={saving}>Cancelar</button>
            <button type="button" className="button" onClick={() => void saveGameSchedule()} disabled={saving || !gameDate || !gameTime}>{saving ? 'Salvando...' : 'Salvar jogo'}</button>
          </div>
        </section>
      ) : null}

      <AgendaEventModal
        open={modalOpen}
        mode={modalMode}
        item={selected}
        defaults={defaults}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={canCreate ? handleDelete : undefined}
        championships={managedChampionships}
      />
    </div>
  )
}
