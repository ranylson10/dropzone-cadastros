'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckSquare, Clock3, Copy, Layers3, Loader2, Pencil, Plus, Save, Swords, Trash2, WandSparkles, X } from 'lucide-react'

type RecordItem = Record<string, any>

type Props = {
  championshipId: string
  phases: RecordItem[]
  groups: RecordItem[]
  games: RecordItem[]
  canManage: boolean
  request: (url: string, options?: RequestInit) => Promise<any>
  onChanged: () => Promise<void>
  onFeedback: (message: string) => void
}

type Draft = {
  id?: string
  nome: string
  fase_id: string
  data_jogo: string
  horario: string
  numero_partidas: number
  mapas: string[]
  grupos_ids: string[]
  status: string
}

type BulkDraft = {
  fase_id: string
  grupos_ids: string[]
  prefixo: string
  data_jogo: string
  horario_inicial: string
  intervalo_minutos: number
  numero_partidas: number
  mapas: string[]
  status: string
}

function emptyDraft(phases: RecordItem[]): Draft {
  return { nome: '', fase_id: String(phases[0]?.id || ''), data_jogo: '', horario: '', numero_partidas: 4, mapas: ['', '', '', ''], grupos_ids: [], status: 'agendado' }
}

function emptyBulk(phases: RecordItem[]): BulkDraft {
  return { fase_id: String(phases[0]?.id || ''), grupos_ids: [], prefixo: 'Rodada 1', data_jogo: '', horario_inicial: '20:00', intervalo_minutos: 30, numero_partidas: 4, mapas: ['', '', '', ''], status: 'agendado' }
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time
  const total = hour * 60 + minute + minutes
  const normalized = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export function LiliGamesManager({ championshipId, phases, groups, games, canManage, request, onChanged, onFeedback }: Props) {
  const [open, setOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(phases))
  const [bulk, setBulk] = useState<BulkDraft>(() => emptyBulk(phases))
  const [maps, setMaps] = useState<RecordItem[]>([])
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('agendado')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)

  useEffect(() => {
    if (!maps.length) void request('/api/mapas').then((payload) => setMaps(payload.mapas || [])).catch(() => setMaps([]))
  }, [maps.length, request])

  const phaseGroups = useMemo(() => groups.filter((group) => String(group.fase_id) === String(draft.fase_id)), [groups, draft.fase_id])
  const bulkGroups = useMemo(() => groups.filter((group) => String(group.fase_id) === String(bulk.fase_id)), [groups, bulk.fase_id])
  const visibleGames = useMemo(() => phaseFilter === 'all' ? games : games.filter((game) => String(game.fase_id) === phaseFilter), [games, phaseFilter])

  function beginCreate() { setDraft(emptyDraft(phases)); setBulkOpen(false); setOpen(true) }
  function beginBulk() { setBulk(emptyBulk(phases)); setOpen(false); setBulkOpen(true) }

  function beginEdit(game: RecordItem) {
    const number = Math.max(1, Number(game.numero_partidas || 1))
    const currentMaps = Array.isArray(game.mapas) ? game.mapas.map(String) : []
    setDraft({ id: String(game.id), nome: String(game.nome || ''), fase_id: String(game.fase_id || phases[0]?.id || ''), data_jogo: String(game.data_jogo || ''), horario: String(game.horario || ''), numero_partidas: number, mapas: Array.from({ length: number }, (_, index) => currentMaps[index] || ''), grupos_ids: Array.isArray(game.grupos_ids) ? game.grupos_ids.map(String) : [], status: String(game.status || 'agendado') })
    setBulkOpen(false); setOpen(true)
  }

  function changeNumber(value: number) {
    const numero = Math.max(1, Math.min(12, value || 1))
    setDraft((current) => ({ ...current, numero_partidas: numero, mapas: Array.from({ length: numero }, (_, index) => current.mapas[index] || '') }))
  }

  function changeBulkNumber(value: number) {
    const numero = Math.max(1, Math.min(12, value || 1))
    setBulk((current) => ({ ...current, numero_partidas: numero, mapas: Array.from({ length: numero }, (_, index) => current.mapas[index] || '') }))
  }

  function toggleGroup(groupId: string) {
    setDraft((current) => ({ ...current, grupos_ids: current.grupos_ids.includes(groupId) ? current.grupos_ids.filter((id) => id !== groupId) : [...current.grupos_ids, groupId] }))
  }

  function toggleBulkGroup(groupId: string) {
    setBulk((current) => ({ ...current, grupos_ids: current.grupos_ids.includes(groupId) ? current.grupos_ids.filter((id) => id !== groupId) : [...current.grupos_ids, groupId] }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft.nome.trim() || !draft.fase_id || !draft.grupos_ids.length || draft.mapas.some((map) => !map)) return onFeedback('Preencha nome, fase, grupos e um mapa para cada queda.')
    setSaving(true)
    try {
      const body = JSON.stringify({ nome: draft.nome.trim(), fase_id: draft.fase_id, data_jogo: draft.data_jogo || null, horario: draft.horario || null, numero_partidas: draft.numero_partidas, mapas: draft.mapas, grupos_ids: draft.grupos_ids, status: draft.status })
      if (draft.id) await request(`/api/campeonatos/${championshipId}/jogos/${draft.id}`, { method: 'PATCH', body })
      else await request(`/api/campeonatos/${championshipId}/jogos`, { method: 'POST', body })
      onFeedback(draft.id ? 'Jogo atualizado com sucesso.' : 'Jogo criado com sucesso.')
      setOpen(false); await onChanged()
    } catch (error: any) { onFeedback(error?.message || 'Não foi possível salvar o jogo.') } finally { setSaving(false) }
  }

  async function generateBulk(event: FormEvent) {
    event.preventDefault()
    if (!bulk.fase_id || !bulk.grupos_ids.length || !bulk.prefixo.trim() || bulk.mapas.some((map) => !map)) return onFeedback('Selecione a fase, ao menos um grupo, o nome-base e todos os mapas.')
    setBulkSaving(true)
    let created = 0
    try {
      for (let index = 0; index < bulk.grupos_ids.length; index += 1) {
        const groupId = bulk.grupos_ids[index]
        const group = groups.find((item) => String(item.id) === groupId)
        await request(`/api/campeonatos/${championshipId}/jogos`, {
          method: 'POST',
          body: JSON.stringify({
            nome: `${bulk.prefixo.trim()} — ${group?.nome || `Grupo ${index + 1}`}`,
            fase_id: bulk.fase_id,
            data_jogo: bulk.data_jogo || null,
            horario: bulk.horario_inicial ? addMinutes(bulk.horario_inicial, index * Math.max(0, bulk.intervalo_minutos)) : null,
            numero_partidas: bulk.numero_partidas,
            mapas: bulk.mapas,
            grupos_ids: [groupId],
            status: bulk.status,
          }),
        })
        created += 1
      }
      onFeedback(`${created} jogo(s) criados automaticamente, com horários e mapas configurados.`)
      setBulkOpen(false); await onChanged()
    } catch (error: any) { onFeedback(`${created} jogo(s) foram criados antes da falha. ${error?.message || 'Não foi possível concluir a geração em lote.'}`) } finally { setBulkSaving(false) }
  }

  async function duplicate(game: RecordItem) {
    setAction(`copy:${game.id}`)
    try {
      await request(`/api/campeonatos/${championshipId}/jogos`, { method: 'POST', body: JSON.stringify({ nome: `${game.nome || 'Jogo'} — cópia`, fase_id: game.fase_id, data_jogo: game.data_jogo || null, horario: game.horario || null, numero_partidas: Number(game.numero_partidas || 1), mapas: Array.isArray(game.mapas) ? game.mapas : [], grupos_ids: Array.isArray(game.grupos_ids) ? game.grupos_ids : [], status: 'agendado' }) })
      onFeedback('Jogo duplicado. Agora você pode editar data e horário.'); await onChanged()
    } catch (error: any) { onFeedback(error?.message || 'Não foi possível duplicar o jogo.') } finally { setAction(null) }
  }

  async function remove(game: RecordItem) {
    if (!window.confirm(`Excluir ${game.nome || 'este jogo'}?`)) return
    setAction(`delete:${game.id}`)
    try { await request(`/api/campeonatos/${championshipId}/jogos/${game.id}`, { method: 'DELETE' }); onFeedback('Jogo excluído com sucesso.'); await onChanged() }
    catch (error: any) {
      const force = window.confirm(`${error?.message || 'O jogo possui dados vinculados.'}\n\nDeseja tentar a exclusão definitiva?`)
      if (force) try { await request(`/api/campeonatos/${championshipId}/jogos/${game.id}?force=1`, { method: 'DELETE' }); onFeedback('Jogo excluído definitivamente.'); await onChanged() } catch (forceError: any) { onFeedback(forceError?.message || 'Não foi possível excluir o jogo.') }
    } finally { setAction(null) }
  }

  async function applyBulkStatus() {
    if (!selectedGames.length) return onFeedback('Selecione ao menos um jogo.')
    setAction('bulk-status')
    let updated = 0
    try {
      for (const gameId of selectedGames) {
        await request(`/api/campeonatos/${championshipId}/jogos/${gameId}`, { method: 'PATCH', body: JSON.stringify({ status: bulkStatus }) })
        updated += 1
      }
      onFeedback(`${updated} jogo(s) atualizados para “${bulkStatus.replace('_', ' ')}”.`)
      setSelectedGames([]); await onChanged()
    } catch (error: any) { onFeedback(`${updated} jogo(s) atualizados antes da falha. ${error?.message || ''}`) } finally { setAction(null) }
  }

  function selectAllVisible() {
    const ids = visibleGames.map((game) => String(game.id))
    setSelectedGames(ids.every((id) => selectedGames.includes(id)) ? selectedGames.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedGames, ...ids])))
  }

  return (
    <section className="lili-games-manager">
      <div className="lili-games-head">
        <div><strong>Jogos e quedas</strong><span>Crie, automatize e atualize vários jogos sem sair da Lili.</span></div>
        {canManage ? <div className="lili-games-head-actions"><button type="button" onClick={beginBulk}><WandSparkles size={16} /> Gerar em lote</button><button type="button" onClick={beginCreate}><Plus size={16} /> Novo jogo</button></div> : null}
      </div>

      {bulkOpen ? <form className="lili-game-form lili-bulk-game-form" onSubmit={generateBulk}>
        <div className="lili-game-form-title"><div><strong>Gerar jogos automaticamente</strong><span>Um jogo por grupo, com horários sequenciais e a mesma programação de mapas.</span></div><button type="button" onClick={() => setBulkOpen(false)} aria-label="Fechar"><X size={16} /></button></div>
        <div className="lili-game-grid lili-bulk-grid">
          <label>Fase<select value={bulk.fase_id} onChange={(event) => setBulk((current) => ({ ...current, fase_id: event.target.value, grupos_ids: [] }))}><option value="">Selecione</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label>
          <label>Nome-base<input value={bulk.prefixo} onChange={(event) => setBulk((current) => ({ ...current, prefixo: event.target.value }))} placeholder="Ex.: Rodada 1" /></label>
          <label>Data<input type="date" value={bulk.data_jogo} onChange={(event) => setBulk((current) => ({ ...current, data_jogo: event.target.value }))} /></label>
          <label>Primeiro horário<input type="time" value={bulk.horario_inicial} onChange={(event) => setBulk((current) => ({ ...current, horario_inicial: event.target.value }))} /></label>
          <label>Intervalo (min)<input type="number" min="0" max="720" value={bulk.intervalo_minutos} onChange={(event) => setBulk((current) => ({ ...current, intervalo_minutos: Number(event.target.value) }))} /></label>
          <label>Quedas<input type="number" min="1" max="12" value={bulk.numero_partidas} onChange={(event) => changeBulkNumber(Number(event.target.value))} /></label>
          <label>Status<select value={bulk.status} onChange={(event) => setBulk((current) => ({ ...current, status: event.target.value }))}><option value="rascunho">Rascunho</option><option value="agendado">Agendado</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></label>
        </div>
        <fieldset><legend>Grupos que receberão um jogo</legend><div className="lili-game-checks"><label><input type="checkbox" checked={bulkGroups.length > 0 && bulkGroups.every((group) => bulk.grupos_ids.includes(String(group.id)))} onChange={() => setBulk((current) => ({ ...current, grupos_ids: bulkGroups.every((group) => current.grupos_ids.includes(String(group.id))) ? [] : bulkGroups.map((group) => String(group.id)) }))} /> Selecionar todos</label>{bulkGroups.map((group) => <label key={group.id}><input type="checkbox" checked={bulk.grupos_ids.includes(String(group.id))} onChange={() => toggleBulkGroup(String(group.id))} /> {group.nome}</label>)}</div></fieldset>
        <fieldset><legend>Sequência de mapas</legend><div className="lili-game-maps">{bulk.mapas.map((map, index) => <label key={index}>Queda {index + 1}<select value={map} onChange={(event) => setBulk((current) => ({ ...current, mapas: current.mapas.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))}><option value="">Selecione</option>{maps.map((item) => <option key={item.id || item.codigo} value={item.codigo}>{item.nome}</option>)}</select></label>)}</div></fieldset>
        <div className="lili-bulk-preview"><Clock3 size={16} /><span>{bulk.grupos_ids.length || 0} jogo(s) · início {bulk.horario_inicial || '--:--'} · intervalo de {bulk.intervalo_minutos || 0} min</span></div>
        <button className="lili-game-save" type="submit" disabled={bulkSaving}>{bulkSaving ? <Loader2 className="spin" size={16} /> : <WandSparkles size={16} />} {bulkSaving ? 'Gerando jogos…' : `Gerar ${bulk.grupos_ids.length || 0} jogo(s)`}</button>
      </form> : null}

      {open ? <form className="lili-game-form" onSubmit={save}>
        <div className="lili-game-form-title"><strong>{draft.id ? 'Editar jogo' : 'Novo jogo'}</strong><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={16} /></button></div>
        <div className="lili-game-grid">
          <label>Nome<input value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex.: Rodada 1 — Grupo A" required /></label>
          <label>Fase<select value={draft.fase_id} onChange={(event) => setDraft((current) => ({ ...current, fase_id: event.target.value, grupos_ids: [] }))} required><option value="">Selecione</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label>
          <label>Data<input type="date" value={draft.data_jogo} onChange={(event) => setDraft((current) => ({ ...current, data_jogo: event.target.value }))} /></label>
          <label>Horário<input type="time" value={draft.horario} onChange={(event) => setDraft((current) => ({ ...current, horario: event.target.value }))} /></label>
          <label>Quedas<input type="number" min="1" max="12" value={draft.numero_partidas} onChange={(event) => changeNumber(Number(event.target.value))} /></label>
          <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="rascunho">Rascunho</option><option value="agendado">Agendado</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></label>
        </div>
        <fieldset><legend>Grupos do jogo</legend><div className="lili-game-checks">{phaseGroups.map((group) => <label key={group.id}><input type="checkbox" checked={draft.grupos_ids.includes(String(group.id))} onChange={() => toggleGroup(String(group.id))} /> {group.nome}</label>)}</div></fieldset>
        <fieldset><legend>Mapa de cada queda</legend><div className="lili-game-maps">{draft.mapas.map((map, index) => <label key={index}>Queda {index + 1}<select value={map} onChange={(event) => setDraft((current) => ({ ...current, mapas: current.mapas.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))}><option value="">Selecione</option>{maps.map((item) => <option key={item.id || item.codigo} value={item.codigo}>{item.nome}</option>)}</select></label>)}</div></fieldset>
        <button className="lili-game-save" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} {saving ? 'Salvando…' : 'Salvar jogo'}</button>
      </form> : null}

      {games.length ? <div className="lili-games-toolbar">
        <div className="lili-games-filter"><Layers3 size={15} /><select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}><option value="all">Todas as fases</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></div>
        {canManage ? <div className="lili-games-bulk-actions"><button type="button" onClick={selectAllVisible}><CheckSquare size={15} /> {selectedGames.length ? `${selectedGames.length} selecionado(s)` : 'Selecionar visíveis'}</button><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="rascunho">Rascunho</option><option value="agendado">Agendado</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select><button type="button" onClick={() => void applyBulkStatus()} disabled={!selectedGames.length || action === 'bulk-status'}>{action === 'bulk-status' ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Aplicar status</button></div> : null}
      </div> : null}

      <div className="lili-games-list compact">{visibleGames.map((game) => {
        const gameGroups = groups.filter((group) => (game.grupos_ids || []).map(String).includes(String(group.id)))
        const selected = selectedGames.includes(String(game.id))
        const expanded = expandedGameId === String(game.id)
        return <article key={game.id} className={`${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''}`}>
          <div className="lili-game-row-top compact-row">
            {canManage ? <label className="lili-game-select"><input type="checkbox" checked={selected} onChange={() => setSelectedGames((current) => selected ? current.filter((id) => id !== String(game.id)) : [...current, String(game.id)])} /><span /></label> : null}
            <button type="button" className="lili-game-summary" onClick={() => setExpandedGameId(expanded ? null : String(game.id))}>
              <span className="lili-game-icon"><Swords size={16} /></span>
              <span className="lili-game-copy"><strong>{game.nome || 'Jogo'}</strong><small>{game.data_jogo ? new Date(`${game.data_jogo}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'}{game.horario ? ` · ${String(game.horario).slice(0, 5)}` : ''} · {game.numero_partidas || 0} quedas</small><em>{gameGroups.map((group) => group.nome).join(', ') || 'Sem grupo'} · {String(game.status || 'agendado').replace('_', ' ')}</em></span>
              <span className={`lili-game-chevron ${expanded ? 'open' : ''}`}>›</span>
            </button>
          </div>
          {expanded ? <div className="lili-game-details">
            <div className="lili-game-maps-inline">{(game.mapas || []).map((map: string, index: number) => <span key={`${game.id}-${index}`}>{index + 1}. {maps.find((item) => item.codigo === map)?.nome || map}</span>)}</div>
            {canManage ? <div className="lili-game-actions compact-actions"><button type="button" onClick={() => beginEdit(game)}><Pencil size={14} /> Editar</button><button type="button" onClick={() => void duplicate(game)} disabled={Boolean(action)}>{action === `copy:${game.id}` ? <Loader2 className="spin" size={14} /> : <Copy size={14} />} Duplicar</button><button type="button" className="danger" onClick={() => void remove(game)} disabled={Boolean(action)}>{action === `delete:${game.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} Excluir</button></div> : null}
          </div> : null}
        </article>
      })}</div>
      {!visibleGames.length ? <div className="lili-games-empty"><CalendarDays size={24} /><strong>Nenhum jogo encontrado</strong><span>Crie manualmente ou use a geração automática por grupos.</span></div> : null}
    </section>
  )
}
