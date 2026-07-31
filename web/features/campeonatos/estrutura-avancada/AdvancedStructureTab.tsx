'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Row = Record<string, any>
type Structure = {
  permission?: { canManage?: boolean }
  edition: Row | null
  franchise: Row | null
  divisions: Row[]
  stages: Row[]
  sources: Row[]
  progressions: Row[]
  prizes: Row[]
  dailyHours: Row[]
  teams: Row[]
  stageTeams: Row[]
  phases: Row[]
  groups: Row[]
  slots: Row[]
  groupChoiceConfigs: Row[]
  groupChoiceBlocks: Row[]
  groupChoiceHistory: Row[]
  progressionExecutions: Row[]
  progressionExecutionItems: Row[]
}

const empty: Structure = { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: [], teams: [], stageTeams: [], phases: [], groups: [], slots: [], groupChoiceConfigs: [], groupChoiceBlocks: [], groupChoiceHistory: [], progressionExecutions: [], progressionExecutionItems: [] }

export function AdvancedStructureTab({ campeonatoId, championshipType }: { campeonatoId: string; championshipType: string }) {
  const [data, setData] = useState<Structure>(empty)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [edition, setEdition] = useState({ franchise_name: '', edition_number: '', season: '', public_title: '' })
  const [division, setDivision] = useState({ name: '', code: '', order: '1' })
  const [stage, setStage] = useState({ division_id: '', name: '', order: '1', type: 'qualificatoria', format: 'mata_mata', capacity: '', direct_sales: '', vacancy_value: '', qualifiers: '', awards_mvp: false })
  const [source, setSource] = useState({ stage_id: '', source_type: 'venda_direta', source_stage_id: '', source_division_id: '', quantity: '' })
  const [progression, setProgression] = useState({ stage_id: '', progression_type: 'promocao', destination_stage_id: '', destination_division_id: '', position_start: '1', position_end: '', quantity: '' })
  const [prize, setPrize] = useState({ stage_id: '', prize_type: 'colocacao', position: '1', title: '', value: '' })
  const [daily, setDaily] = useState({ hour: '', display_name: '', capacity: '', vacancy_value: '', prize_description: '', prize_value: '', map: '', drops: '1' })
  const [assignment, setAssignment] = useState({ stage_id: '', campeonato_equipe_id: '', source_type: 'manual', source_stage_id: '', source_position: '' })
  const [progressionPreview, setProgressionPreview] = useState<Row | null>(null)
  const [selectedProgressionRule, setSelectedProgressionRule] = useState('')
  const [replaceProgressionConflicts, setReplaceProgressionConflicts] = useState(false)
  const [groupAssignment, setGroupAssignment] = useState({ campeonato_equipe_id: '', group_id: '', slot_id: '' })
  const [choiceSchedule, setChoiceSchedule] = useState<Record<string, { opens_at: string; closes_at: string }>>({})
  const [choiceBlock, setChoiceBlock] = useState({ phase_id: '', group_id: '', slot_id: '', reason: '' })
  const [choiceOpsFilter, setChoiceOpsFilter] = useState({ phase_id: '', group_id: '', status: 'all', query: '' })
  const [choiceNoticeType, setChoiceNoticeType] = useState('pending')
  const [choiceHistoryFilter, setChoiceHistoryFilter] = useState({ team_id: '', action: 'all', phase_id: '', group_id: '', date_from: '', date_to: '' })

  const request = useCallback(async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Row) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const response = await fetch(`/api/campeonatos/${campeonatoId}/estrutura-avancada`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || 'Falha na estrutura avançada.')
    return json as Structure
  }, [campeonatoId])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const next = await request('GET')
      setData(next)
      setEdition({
        franchise_name: next.franchise?.nome || '',
        edition_number: next.edition?.numero_edicao ? String(next.edition.numero_edicao) : '',
        season: next.edition?.temporada || '',
        public_title: next.edition?.titulo_publico || '',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar.')
    } finally { setLoading(false) }
  }, [request])

  useEffect(() => { void load() }, [load])

  async function previewProgression(ruleId: string) {
    if (!ruleId) return
    setBusy(true)
    setMessage('')
    try {
      const response = await request('POST', { action: 'preview_progression', rule_id: ruleId }) as any
      setProgressionPreview(response.preview || null)
    } catch (error) {
      setProgressionPreview(null)
      setMessage(error instanceof Error ? error.message : 'Falha ao gerar prévia.')
    } finally { setBusy(false) }
  }

  async function applyProgression() {
    if (!selectedProgressionRule) return
    setBusy(true)
    setMessage('')
    try {
      const response = await request('POST', { action: 'apply_progression', rule_id: selectedProgressionRule, replace_conflicts: replaceProgressionConflicts }) as any
      setData(response)
      setProgressionPreview(response.preview || null)
      setMessage(`${Number(response.applied || 0)} equipe(s) promovida(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao aplicar progressão.')
    } finally { setBusy(false) }
  }

  async function reverseProgression(executionId: string) {
    const reason = window.prompt('Informe o motivo da reversão:')
    if (reason == null) return
    setBusy(true)
    setMessage('')
    try {
      const response = await request('POST', { action: 'reverse_progression', execution_id: executionId, reason }) as any
      setData(response)
      setProgressionPreview(null)
      setMessage(`${Number(response.reversed || 0)} vínculo(s) revertido(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao reverter progressão.')
    } finally { setBusy(false) }
  }

  async function act(body: Row) {
    setBusy(true)
    setMessage('')
    try {
      const method = body.action === 'save_edition' ? 'PATCH' : body.action === 'delete' ? 'DELETE' : 'POST'
      const next = await request(method, body)
      setData(next)
      setMessage('Alteração salva.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar.')
    } finally { setBusy(false) }
  }

  const stagesByDivision = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of data.stages) {
      const key = String(row.divisao_id || 'geral')
      map.set(key, [...(map.get(key) || []), row])
    }
    return map
  }, [data.stages])

  const teamName = useCallback((row: Row) => {
    const line = Array.isArray(row.equipe_lines) ? row.equipe_lines[0] : row.equipe_lines
    const team = Array.isArray(row.equipes) ? row.equipes[0] : row.equipes
    return row.nome_exibicao || line?.tag || line?.nome || team?.tag || team?.nome || 'Equipe sem nome'
  }, [])

  const assignmentsByStage = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of data.stageTeams) map.set(String(row.etapa_id), [...(map.get(String(row.etapa_id)) || []), row])
    return map
  }, [data.stageTeams])

  const choiceOperationalRows = useMemo(() => data.teams.map((team) => {
    const group = data.groups.find((row) => row.id === team.grupo_id)
    const phase = data.phases.find((row) => row.id === group?.fase_id)
    const slot = data.slots.find((row) => row.id === team.slot_id)
    const cancelled = data.groupChoiceHistory.find((row) => row.campeonato_equipe_id === team.id && !row.grupo_novo_id && row.grupo_anterior_id)
    return { team, group, phase, slot, cancelled, status: group && slot ? 'chosen' : cancelled ? 'cancelled' : 'pending' }
  }), [data.teams, data.groups, data.phases, data.slots, data.groupChoiceHistory])

  const filteredChoiceRows = useMemo(() => {
    const query = choiceOpsFilter.query.trim().toLowerCase()
    return choiceOperationalRows.filter((row) => {
      if (choiceOpsFilter.phase_id && row.phase?.id !== choiceOpsFilter.phase_id) return false
      if (choiceOpsFilter.group_id && row.group?.id !== choiceOpsFilter.group_id) return false
      if (choiceOpsFilter.status !== 'all' && row.status !== choiceOpsFilter.status) return false
      if (query && !teamName(row.team).toLowerCase().includes(query)) return false
      return true
    })
  }, [choiceOperationalRows, choiceOpsFilter, teamName])


  async function sendChoiceNotifications(onlyPending = false) {
    const rows = onlyPending ? filteredChoiceRows.filter((row) => row.status === 'pending') : filteredChoiceRows
    if (!rows.length) {
      setMessage('Nenhuma equipe disponível para avisar com os filtros atuais.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await request('POST', {
        action: 'send_group_choice_notifications',
        notification_type: choiceNoticeType,
        campeonato_equipe_ids: rows.map((row) => row.team.id),
      }) as any
      setData(response)
      setMessage(`${Number(response.sent || 0)} aviso(s) enviado(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao enviar avisos.')
    } finally { setBusy(false) }
  }

  function exportChoiceCsv() {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['Equipe/line', 'Fase', 'Grupo', 'Slot', 'Status'], ...filteredChoiceRows.map((row) => [teamName(row.team), row.phase?.nome || '', row.group?.nome || '', row.slot?.slot_letra || row.slot?.slot_numero || '', row.status === 'chosen' ? 'Escolhida' : row.status === 'cancelled' ? 'Cancelada' : 'Pendente'])]
    const blob = new Blob([rows.map((row) => row.map(escape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `escolhas-grupos-${campeonatoId}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const groupChoiceHistoryRows = useMemo(() => data.groupChoiceHistory.map((row) => {
    const team = data.teams.find((item) => item.id === row.campeonato_equipe_id)
    const phase = data.phases.find((item) => item.id === row.fase_id)
    const previousGroup = data.groups.find((item) => item.id === row.grupo_anterior_id)
    const nextGroup = data.groups.find((item) => item.id === row.grupo_novo_id)
    const previousSlot = data.slots.find((item) => item.id === row.slot_anterior_id)
    const nextSlot = data.slots.find((item) => item.id === row.slot_novo_id)
    const action = row.grupo_anterior_id && !row.grupo_novo_id ? 'cancelled' : !row.grupo_anterior_id && row.grupo_novo_id ? (String(row.observacao || '').toLowerCase().includes('restaur') ? 'restored' : 'created') : row.grupo_anterior_id && row.grupo_novo_id ? 'changed' : 'updated'
    return { row, team, phase, previousGroup, nextGroup, previousSlot, nextSlot, action }
  }), [data.groupChoiceHistory, data.teams, data.phases, data.groups, data.slots])

  const filteredGroupChoiceHistory = useMemo(() => groupChoiceHistoryRows.filter((item) => {
    if (choiceHistoryFilter.team_id && item.row.campeonato_equipe_id !== choiceHistoryFilter.team_id) return false
    if (choiceHistoryFilter.action !== 'all' && item.action !== choiceHistoryFilter.action) return false
    if (choiceHistoryFilter.phase_id && item.row.fase_id !== choiceHistoryFilter.phase_id) return false
    if (choiceHistoryFilter.group_id && item.row.grupo_anterior_id !== choiceHistoryFilter.group_id && item.row.grupo_novo_id !== choiceHistoryFilter.group_id) return false
    const createdAt = new Date(item.row.created_at).getTime()
    if (choiceHistoryFilter.date_from && createdAt < new Date(`${choiceHistoryFilter.date_from}T00:00:00`).getTime()) return false
    if (choiceHistoryFilter.date_to && createdAt > new Date(`${choiceHistoryFilter.date_to}T23:59:59.999`).getTime()) return false
    return true
  }), [groupChoiceHistoryRows, choiceHistoryFilter])

  function choiceActionLabel(action: string) {
    if (action === 'created') return 'Confirmada'
    if (action === 'changed') return 'Movida/trocada'
    if (action === 'cancelled') return 'Cancelada'
    if (action === 'restored') return 'Restaurada'
    return 'Atualizada'
  }

  function choicePosition(group?: Row, slot?: Row) {
    if (!group && !slot) return 'Sem grupo/slot'
    return `${group?.nome || 'Grupo'} · ${slot?.slot_letra || (slot?.slot_numero ? `Slot ${slot.slot_numero}` : 'sem slot')}`
  }

  function exportChoiceHistoryCsv() {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['Data', 'Equipe/line', 'Ação', 'Origem', 'Responsável', 'Fase', 'Anterior', 'Novo', 'Motivo'], ...filteredGroupChoiceHistory.map((item) => [new Date(item.row.created_at).toLocaleString('pt-BR'), item.team ? teamName(item.team) : 'Equipe', choiceActionLabel(item.action), item.row.origem || '', item.row.alterado_por_nome || item.row.alterado_por || 'Sistema', item.phase?.nome || '', choicePosition(item.previousGroup, item.previousSlot), choicePosition(item.nextGroup, item.nextSlot), item.row.observacao || ''])]
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(escape).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `historico-escolhas-${campeonatoId}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }


  if (loading) return <div className="advanced-structure-loading"><Loader2 className="button-spinner" size={18} /> Carregando estrutura avançada…</div>

  const canManage = data.permission?.canManage !== false

  return (
    <div className="advanced-structure-stack">
      <header className="advanced-structure-header">
        <div><p className="eyebrow">Estrutura avançada</p><h3>Edições, séries, etapas e lotes</h3><p>Configure qualificatórias, pontos corridos, promoções e horários independentes sem alterar os campeonatos antigos.</p></div>
        <button className="button secondary" onClick={() => void load()}><RefreshCw size={15} /> Atualizar</button>
      </header>
      {message ? <div className="message">{message}</div> : null}

      <section className="advanced-card">
        <h4>Campeonato histórico e edição</h4>
        <div className="mini-grid four">
          <label><span>Nome histórico</span><input value={edition.franchise_name} onChange={(e) => setEdition({ ...edition, franchise_name: e.target.value })} placeholder="Copa ALOE" /></label>
          <label><span>Nº da edição</span><input type="number" min="1" value={edition.edition_number} onChange={(e) => setEdition({ ...edition, edition_number: e.target.value })} /></label>
          <label><span>Temporada</span><input value={edition.season} onChange={(e) => setEdition({ ...edition, season: e.target.value })} placeholder="2027" /></label>
          <label><span>Título público</span><input value={edition.public_title} onChange={(e) => setEdition({ ...edition, public_title: e.target.value })} placeholder="3ª edição" /></label>
        </div>
        <button className="button" disabled={!canManage || busy || !edition.franchise_name.trim()} onClick={() => void act({ action: 'save_edition', franchise_id: data.franchise?.id, ...edition })}>{busy ? 'Salvando…' : 'Salvar edição'}</button>
      </section>

      {data.edition ? <>
        <section className="advanced-card">
          <h4>Séries ou divisões</h4>
          <div className="mini-grid three"><label><span>Nome</span><input value={division.name} onChange={(e) => setDivision({ ...division, name: e.target.value })} placeholder="Série C" /></label><label><span>Código</span><input value={division.code} onChange={(e) => setDivision({ ...division, code: e.target.value })} placeholder="C" /></label><label><span>Ordem</span><input type="number" min="1" value={division.order} onChange={(e) => setDivision({ ...division, order: e.target.value })} /></label></div>
          <button className="button" disabled={!canManage || busy || !division.name.trim()} onClick={() => void act({ action: 'create_division', edition_id: data.edition?.id, ...division })}><Plus size={15} /> Adicionar série</button>
          <div className="advanced-chip-row">{data.divisions.map((row) => <span className="advanced-chip" key={row.id}>{row.codigo || row.nome} · {row.nome}<button title="Excluir" onClick={() => void act({ action: 'delete', table: 'campeonato_divisoes', row_id: row.id })}><Trash2 size={13} /></button></span>)}</div>
        </section>

        <section className="advanced-card">
          <h4>Etapas operacionais</h4>
          <div className="mini-grid four">
            <label><span>Série</span><select value={stage.division_id} onChange={(e) => setStage({ ...stage, division_id: e.target.value })}><option value="">Sem série</option>{data.divisions.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label>
            <label><span>Nome</span><input value={stage.name} onChange={(e) => setStage({ ...stage, name: e.target.value })} placeholder="Qualificatória" /></label>
            <label><span>Tipo</span><select value={stage.type} onChange={(e) => setStage({ ...stage, type: e.target.value })}><option value="qualificatoria">Qualificatória</option><option value="pontos_corridos">Pontos corridos</option><option value="mata_mata">Mata-mata</option><option value="final">Final</option><option value="outra">Outra</option></select></label>
            <label><span>Formato</span><select value={stage.format} onChange={(e) => setStage({ ...stage, format: e.target.value })}><option value="mata_mata">Mata-mata</option><option value="pontos_corridos">Pontos corridos</option><option value="jogo_unico">Jogo único</option><option value="misto">Misto</option><option value="outro">Outro</option></select></label>
            <label><span>Capacidade</span><input type="number" min="1" value={stage.capacity} onChange={(e) => setStage({ ...stage, capacity: e.target.value })} /></label>
            <label><span>Vagas vendidas</span><input type="number" min="0" value={stage.direct_sales} onChange={(e) => setStage({ ...stage, direct_sales: e.target.value })} /></label>
            <label><span>Valor por vaga</span><input type="number" min="0" step="0.01" value={stage.vacancy_value} onChange={(e) => setStage({ ...stage, vacancy_value: e.target.value })} /></label>
            <label><span>Classificam</span><input type="number" min="0" value={stage.qualifiers} onChange={(e) => setStage({ ...stage, qualifiers: e.target.value })} /></label>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={stage.awards_mvp} onChange={(e) => setStage({ ...stage, awards_mvp: e.target.checked })} /> Premia MVP nesta etapa</label>
          <button className="button" disabled={!canManage || busy || !stage.name.trim()} onClick={() => void act({ action: 'create_stage', edition_id: data.edition?.id, ...stage })}><Plus size={15} /> Adicionar etapa</button>
          <div className="advanced-stage-list">{data.divisions.concat([{ id: 'geral', nome: 'Sem série' }]).map((divisionRow) => {
            const rows = stagesByDivision.get(String(divisionRow.id)) || []
            if (!rows.length) return null
            return <div key={divisionRow.id}><strong>{divisionRow.nome}</strong>{rows.map((row) => <article key={row.id}><div><b>{row.nome}</b><small>{row.tipo} · {row.formato} · {row.capacidade_total || 0} vagas · {row.vagas_venda_direta || 0} vendidas</small></div><button className="icon-action-button danger" onClick={() => void act({ action: 'delete', table: 'campeonato_etapas', row_id: row.id })}><Trash2 size={14} /></button></article>)}</div>
          })}</div>
        </section>

        {data.stages.length ? <section className="advanced-card advanced-three-columns">
          <div><h4>Composição de vagas</h4><label><span>Etapa destino</span><select value={source.stage_id} onChange={(e) => setSource({ ...source, stage_id: e.target.value })}><option value="">Selecione</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label><label><span>Origem</span><select value={source.source_type} onChange={(e) => setSource({ ...source, source_type: e.target.value })}><option value="venda_direta">Venda direta</option><option value="qualificatoria">Qualificatória</option><option value="promocao">Promoção</option><option value="convite">Convite</option><option value="manual">Manual</option><option value="outra_etapa">Outra etapa</option></select></label><label><span>Etapa origem</span><select value={source.source_stage_id} onChange={(e) => setSource({ ...source, source_stage_id: e.target.value })}><option value="">Nenhuma</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label><label><span>Quantidade</span><input type="number" min="1" value={source.quantity} onChange={(e) => setSource({ ...source, quantity: e.target.value })} /></label><button className="button" disabled={!source.stage_id || !source.quantity || busy} onClick={() => void act({ action: 'create_source', ...source })}>Adicionar origem</button></div>
          <div><h4>Progressão</h4><label><span>Etapa origem</span><select value={progression.stage_id} onChange={(e) => setProgression({ ...progression, stage_id: e.target.value })}><option value="">Selecione</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label><label><span>Destino</span><select value={progression.progression_type} onChange={(e) => setProgression({ ...progression, progression_type: e.target.value })}><option value="promocao">Promoção</option><option value="avanco">Avanço</option><option value="eliminacao">Eliminação</option><option value="premiacao">Premiação</option><option value="permanencia">Permanência</option><option value="rebaixamento">Rebaixamento</option></select></label><label><span>Etapa destino</span><select value={progression.destination_stage_id} onChange={(e) => setProgression({ ...progression, destination_stage_id: e.target.value })}><option value="">Nenhuma</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label><div className="mini-grid two"><label><span>Posição inicial</span><input type="number" min="1" value={progression.position_start} onChange={(e) => setProgression({ ...progression, position_start: e.target.value })} /></label><label><span>Posição final</span><input type="number" min="1" value={progression.position_end} onChange={(e) => setProgression({ ...progression, position_end: e.target.value })} /></label></div><button className="button" disabled={!progression.stage_id || busy} onClick={() => void act({ action: 'create_progression', ...progression })}>Adicionar regra</button></div>
          <div><h4>Premiação</h4><label><span>Etapa</span><select value={prize.stage_id} onChange={(e) => setPrize({ ...prize, stage_id: e.target.value })}><option value="">Selecione</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label><label><span>Tipo</span><select value={prize.prize_type} onChange={(e) => setPrize({ ...prize, prize_type: e.target.value })}><option value="colocacao">Colocação</option><option value="mvp">MVP</option><option value="outro">Outro</option></select></label><label><span>Posição</span><input type="number" min="1" value={prize.position} onChange={(e) => setPrize({ ...prize, position: e.target.value })} /></label><label><span>Título</span><input value={prize.title} onChange={(e) => setPrize({ ...prize, title: e.target.value })} placeholder="Campeão" /></label><label><span>Valor</span><input type="number" min="0" step="0.01" value={prize.value} onChange={(e) => setPrize({ ...prize, value: e.target.value })} /></label><button className="button" disabled={!prize.stage_id || busy} onClick={() => void act({ action: 'create_prize', ...prize })}>Adicionar prêmio</button></div>
        </section> : null}
      </> : <div className="message">Cadastre primeiro o campeonato histórico e sua edição para liberar séries e etapas.</div>}

      {data.edition && data.stages.length ? <section className="advanced-card">
        <h4>Operação por etapa</h4>
        <p className="advanced-help">Distribua as participações reais entre as etapas. A capacidade é bloqueada no servidor e cada vínculo registra a origem da vaga.</p>
        <div className="mini-grid four">
          <label><span>Etapa</span><select value={assignment.stage_id} onChange={(e) => setAssignment({ ...assignment, stage_id: e.target.value })}><option value="">Selecione</option>{data.stages.map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label>
          <label><span>Equipe/line</span><select value={assignment.campeonato_equipe_id} onChange={(e) => setAssignment({ ...assignment, campeonato_equipe_id: e.target.value })}><option value="">Selecione</option>{data.teams.map((row) => <option value={row.id} key={row.id}>{teamName(row)}</option>)}</select></label>
          <label><span>Origem</span><select value={assignment.source_type} onChange={(e) => setAssignment({ ...assignment, source_type: e.target.value })}><option value="manual">Manual</option><option value="venda_direta">Venda direta</option><option value="qualificatoria">Qualificatória</option><option value="promocao">Promoção</option><option value="convite">Convite</option><option value="outra_etapa">Outra etapa</option></select></label>
          <label><span>Etapa de origem</span><select value={assignment.source_stage_id} onChange={(e) => setAssignment({ ...assignment, source_stage_id: e.target.value })}><option value="">Nenhuma</option>{data.stages.filter((row) => row.id !== assignment.stage_id).map((row) => <option value={row.id} key={row.id}>{row.nome}</option>)}</select></label>
        </div>
        <button className="button" disabled={!canManage || busy || !assignment.stage_id || !assignment.campeonato_equipe_id} onClick={() => void act({ action: 'assign_team', ...assignment })}><Plus size={15} /> Vincular equipe à etapa</button>
        <div className="advanced-operational-grid">{data.stages.map((row) => {
          const linked = assignmentsByStage.get(String(row.id)) || []
          const capacity = Number(row.capacidade_total || 0)
          return <article key={row.id} className="advanced-operation-stage"><div className="advanced-operation-stage-head"><div><b>{row.nome}</b><small>{linked.length}/{capacity || '∞'} ocupadas · {Math.max(0, capacity - linked.length) || (capacity ? 0 : '∞')} disponíveis</small></div></div><div className="advanced-assignment-list">{linked.length ? linked.map((link) => { const team = data.teams.find((item) => item.id === link.campeonato_equipe_id); return <span key={link.id}>{team ? teamName(team) : 'Equipe'}<small>{link.tipo_origem}</small><button title="Retirar da etapa" onClick={() => void act({ action: 'remove_team', stage_team_id: link.id })}><Trash2 size={12} /></button></span> }) : <small>Nenhuma equipe vinculada.</small>}</div></article>
        })}</div>
        {data.phases.length ? <div className="advanced-link-list"><h5>Vincular fases existentes</h5>{data.phases.map((phase) => <label key={phase.id}><span>{phase.nome}</span><select value={phase.etapa_id || ''} onChange={(e) => void act({ action: 'link_phase', phase_id: phase.id, stage_id: e.target.value })}><option value="">Sem etapa</option>{data.stages.map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>)}</div> : null}
      </section> : null}

      {data.phases.length && data.groups.length ? <section className="advanced-card">
        <h4>Grupos: escolha manual ou pela equipe</h4>
        <p className="advanced-help">Nenhum grupo é distribuído automaticamente. O administrador pode escolher manualmente ou liberar a escolha para as equipes.</p>
        <div className="advanced-group-choice-grid">
          <div>
            <h5>Distribuição manual</h5>
            <label><span>Equipe/line</span><select value={groupAssignment.campeonato_equipe_id} onChange={(e) => setGroupAssignment({ ...groupAssignment, campeonato_equipe_id: e.target.value })}><option value="">Selecione</option>{data.teams.map((row) => <option key={row.id} value={row.id}>{teamName(row)}</option>)}</select></label>
            <label><span>Grupo</span><select value={groupAssignment.group_id} onChange={(e) => setGroupAssignment({ ...groupAssignment, group_id: e.target.value, slot_id: '' })}><option value="">Selecione</option>{data.groups.map((group) => { const free = data.slots.filter((slot) => slot.grupo_id === group.id && slot.status === 'livre' && !slot.equipe_id && !slot.line_id).length; return <option key={group.id} value={group.id} disabled={!free}>{group.nome} · {free} vaga(s)</option> })}</select></label>
            <label><span>Slot</span><select value={groupAssignment.slot_id} onChange={(e) => setGroupAssignment({ ...groupAssignment, slot_id: e.target.value })} disabled={!groupAssignment.group_id}><option value="">Selecione o slot</option>{data.slots.filter((slot) => slot.grupo_id === groupAssignment.group_id && slot.status === 'livre' && !slot.equipe_id && !slot.line_id).map((slot) => <option key={slot.id} value={slot.id}>{slot.slot_letra || `Slot ${slot.slot_numero}`}</option>)}</select></label>
            <button className="button" disabled={busy || !groupAssignment.campeonato_equipe_id || !groupAssignment.group_id || !groupAssignment.slot_id} onClick={() => void act({ action: 'assign_group_manual', ...groupAssignment })}>Confirmar grupo e slot</button>
          </div>
          <div>
            <h5>Escolha pelas equipes</h5>
            <div className="advanced-choice-config-list">{data.phases.map((phase) => { const config = data.groupChoiceConfigs.find((row) => row.fase_id === phase.id); const groups = data.groups.filter((row) => row.fase_id === phase.id); if (!groups.length) return null; const draft = choiceSchedule[phase.id] || { opens_at: config?.abre_em ? String(config.abre_em).slice(0, 16) : '', closes_at: config?.fecha_em ? String(config.fecha_em).slice(0, 16) : '' }; return <article key={phase.id}><div><b>{phase.nome}</b><small>{groups.length} grupo(s) disponíveis</small></div><label className="checkbox-row"><input type="checkbox" checked={Boolean(config?.aberta)} onChange={(e) => void act({ action: 'save_group_choice_config', phase_id: phase.id, open: e.target.checked, allow_change: config?.permite_troca !== false, opens_at: draft.opens_at, closes_at: draft.closes_at })} /> Escolha habilitada</label><label className="checkbox-row"><input type="checkbox" checked={config?.permite_troca !== false} onChange={(e) => void act({ action: 'save_group_choice_config', phase_id: phase.id, open: Boolean(config?.aberta), allow_change: e.target.checked, opens_at: draft.opens_at, closes_at: draft.closes_at })} /> Permitir troca</label><div className="mini-grid two"><label><span>Abre em</span><input type="datetime-local" value={draft.opens_at} onChange={(e) => setChoiceSchedule({ ...choiceSchedule, [phase.id]: { ...draft, opens_at: e.target.value } })} /></label><label><span>Fecha em</span><input type="datetime-local" value={draft.closes_at} onChange={(e) => setChoiceSchedule({ ...choiceSchedule, [phase.id]: { ...draft, closes_at: e.target.value } })} /></label></div><button className="button secondary" onClick={() => void act({ action: 'save_group_choice_config', phase_id: phase.id, open: Boolean(config?.aberta), allow_change: config?.permite_troca !== false, opens_at: draft.opens_at, closes_at: draft.closes_at })}>Salvar prazo</button></article> })}</div>
          </div>
          <div className="advanced-choice-blocks">
            <h5>Bloqueios manuais</h5>
            <label><span>Fase</span><select value={choiceBlock.phase_id} onChange={(e) => setChoiceBlock({ phase_id: e.target.value, group_id: '', slot_id: '', reason: choiceBlock.reason })}><option value="">Selecione</option>{data.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nome}</option>)}</select></label>
            <label><span>Grupo</span><select value={choiceBlock.group_id} onChange={(e) => setChoiceBlock({ ...choiceBlock, group_id: e.target.value, slot_id: '' })}><option value="">Nenhum</option>{data.groups.filter((group) => !choiceBlock.phase_id || group.fase_id === choiceBlock.phase_id).map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></label>
            <label><span>Slot</span><select value={choiceBlock.slot_id} onChange={(e) => setChoiceBlock({ ...choiceBlock, slot_id: e.target.value, group_id: '' })}><option value="">Nenhum</option>{data.slots.filter((slot) => !choiceBlock.phase_id || slot.fase_id === choiceBlock.phase_id).map((slot) => <option key={slot.id} value={slot.id}>{slot.slot_letra || `Slot ${slot.slot_numero}`}</option>)}</select></label>
            <label><span>Motivo</span><input value={choiceBlock.reason} onChange={(e) => setChoiceBlock({ ...choiceBlock, reason: e.target.value })} placeholder="Ex.: reservado para convidada" /></label>
            <button className="button secondary" disabled={!choiceBlock.phase_id || (!choiceBlock.group_id && !choiceBlock.slot_id)} onClick={() => void act({ action: 'set_group_choice_block', ...choiceBlock })}>Bloquear opção</button>
            <div className="advanced-chip-row">{data.groupChoiceBlocks.map((row) => { const group = data.groups.find((item) => item.id === row.grupo_id); const slot = data.slots.find((item) => item.id === row.slot_id); return <span className="advanced-chip" key={row.id}>{group?.nome || slot?.slot_letra || `Slot ${slot?.slot_numero || ''}`} {row.motivo ? `· ${row.motivo}` : ''}<button title="Remover bloqueio" onClick={() => void act({ action: 'remove_group_choice_block', block_id: row.id })}><Trash2 size={13} /></button></span> })}</div>
          </div>
        </div>
        <div className="advanced-choice-operations">
          <div className="advanced-choice-operations-head"><div><h5>Painel operacional das escolhas</h5><small>{choiceOperationalRows.filter((row) => row.status === 'chosen').length} escolhidas · {choiceOperationalRows.filter((row) => row.status === 'pending').length} pendentes · {data.slots.filter((row) => row.status === 'livre' && !row.equipe_id && !row.line_id).length} slots livres · {data.groupChoiceBlocks.length} bloqueios</small></div><button className="button secondary" onClick={exportChoiceCsv}>Exportar CSV</button></div>
          <div className="advanced-choice-notices"><label><span>Tipo de aviso</span><select value={choiceNoticeType} onChange={(e) => setChoiceNoticeType(e.target.value)}><option value="pending">Escolha pendente</option><option value="deadline">Prazo próximo</option><option value="general">Aviso geral</option></select></label><button className="button secondary" disabled={busy || !filteredChoiceRows.length} onClick={() => void sendChoiceNotifications(false)}>Avisar filtradas</button><button className="button" disabled={busy || !filteredChoiceRows.some((row) => row.status === 'pending')} onClick={() => void sendChoiceNotifications(true)}>Avisar apenas pendentes</button></div>
          <div className="mini-grid four">
            <label><span>Busca</span><input value={choiceOpsFilter.query} onChange={(e) => setChoiceOpsFilter({ ...choiceOpsFilter, query: e.target.value })} placeholder="Nome ou tag" /></label>
            <label><span>Fase</span><select value={choiceOpsFilter.phase_id} onChange={(e) => setChoiceOpsFilter({ ...choiceOpsFilter, phase_id: e.target.value, group_id: '' })}><option value="">Todas</option>{data.phases.map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
            <label><span>Grupo</span><select value={choiceOpsFilter.group_id} onChange={(e) => setChoiceOpsFilter({ ...choiceOpsFilter, group_id: e.target.value })}><option value="">Todos</option>{data.groups.filter((row) => !choiceOpsFilter.phase_id || row.fase_id === choiceOpsFilter.phase_id).map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
            <label><span>Status</span><select value={choiceOpsFilter.status} onChange={(e) => setChoiceOpsFilter({ ...choiceOpsFilter, status: e.target.value })}><option value="all">Todos</option><option value="chosen">Escolhidas</option><option value="pending">Pendentes</option><option value="cancelled">Canceladas</option></select></label>
          </div>
          <div className="advanced-choice-operations-list">{filteredChoiceRows.length ? filteredChoiceRows.map((row) => <article key={row.team.id} className={`is-${row.status}`}><div><b>{teamName(row.team)}</b><small>{row.phase?.nome || 'Sem fase'} · {row.group?.nome || 'Sem grupo'} · {row.slot?.slot_letra || (row.slot?.slot_numero ? `Slot ${row.slot.slot_numero}` : 'Sem slot')}</small></div><span>{row.status === 'chosen' ? 'Escolhida' : row.status === 'cancelled' ? 'Cancelada' : 'Pendente'}</span><div className="advanced-choice-row-actions">{row.status === 'chosen' ? <><button className="button secondary" onClick={() => setGroupAssignment({ campeonato_equipe_id: row.team.id, group_id: row.group?.id || '', slot_id: '' })}>Mover</button><button className="button secondary danger" onClick={() => void act({ action: 'cancel_group_choice_admin', campeonato_equipe_id: row.team.id })}>Cancelar</button></> : row.status === 'cancelled' ? <button className="button secondary" onClick={() => void act({ action: 'restore_group_choice_admin', campeonato_equipe_id: row.team.id })}>Restaurar</button> : <button className="button secondary" onClick={() => setGroupAssignment({ campeonato_equipe_id: row.team.id, group_id: '', slot_id: '' })}>Definir</button>}</div></article>) : <div className="message">Nenhuma equipe encontrada com esses filtros.</div>}</div>
        </div>
        {data.groupChoiceHistory.length ? <div className="advanced-choice-audit">
          <div className="advanced-choice-audit-head"><div><h5>Histórico e logs das escolhas</h5><small>{filteredGroupChoiceHistory.length} registro(s) exibido(s) de {data.groupChoiceHistory.length}</small></div><button className="button secondary" onClick={exportChoiceHistoryCsv}>Exportar logs CSV</button></div>
          <div className="mini-grid three">
            <label><span>Equipe/line</span><select value={choiceHistoryFilter.team_id} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, team_id: e.target.value })}><option value="">Todas</option>{data.teams.map((row) => <option key={row.id} value={row.id}>{teamName(row)}</option>)}</select></label>
            <label><span>Ação</span><select value={choiceHistoryFilter.action} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, action: e.target.value })}><option value="all">Todas</option><option value="created">Confirmada</option><option value="changed">Movida/trocada</option><option value="cancelled">Cancelada</option><option value="restored">Restaurada</option></select></label>
            <label><span>Fase</span><select value={choiceHistoryFilter.phase_id} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, phase_id: e.target.value, group_id: '' })}><option value="">Todas</option>{data.phases.map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
            <label><span>Grupo</span><select value={choiceHistoryFilter.group_id} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, group_id: e.target.value })}><option value="">Todos</option>{data.groups.filter((row) => !choiceHistoryFilter.phase_id || row.fase_id === choiceHistoryFilter.phase_id).map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
            <label><span>De</span><input type="date" value={choiceHistoryFilter.date_from} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, date_from: e.target.value })} /></label>
            <label><span>Até</span><input type="date" value={choiceHistoryFilter.date_to} onChange={(e) => setChoiceHistoryFilter({ ...choiceHistoryFilter, date_to: e.target.value })} /></label>
          </div>
          <div className="advanced-choice-timeline">{filteredGroupChoiceHistory.length ? filteredGroupChoiceHistory.map((item) => <article key={item.row.id} className={`is-${item.action}`}><span className="advanced-choice-timeline-dot" /><div className="advanced-choice-timeline-main"><div><b>{item.team ? teamName(item.team) : 'Equipe removida'}</b><strong>{choiceActionLabel(item.action)}</strong></div><small>{new Date(item.row.created_at).toLocaleString('pt-BR')} · {item.phase?.nome || 'Fase não informada'} · {item.row.origem === 'administrador' ? 'Administração' : item.row.origem === 'equipe' ? 'Equipe' : item.row.origem || 'Sistema'}</small><p><span>Anterior: {choicePosition(item.previousGroup, item.previousSlot)}</span><span>Novo: {choicePosition(item.nextGroup, item.nextSlot)}</span></p>{item.row.observacao ? <em>Motivo/observação: {item.row.observacao}</em> : null}<small>Responsável: {item.row.alterado_por_nome || item.row.alterado_por || 'Sistema'}</small></div></article>) : <div className="message">Nenhum registro encontrado com esses filtros.</div>}</div>
        </div> : null}
      </section> : null}

      {data.progressions.length ? <section className="advanced-card">
        <h4>Progressão automática</h4>
        <p className="advanced-help">Gere a lista de classificadas usando o ranking da etapa de origem. O grupo de destino permanece sem distribuição automática.</p>
        <div className="mini-grid two">
          <label><span>Regra</span><select value={selectedProgressionRule} onChange={(e) => { setSelectedProgressionRule(e.target.value); setProgressionPreview(null) }}><option value="">Selecione</option>{data.progressions.filter((row) => row.etapa_destino_id).map((row) => { const sourceStage = data.stages.find((stageRow) => stageRow.id === row.etapa_origem_id); const destinationStage = data.stages.find((stageRow) => stageRow.id === row.etapa_destino_id); return <option key={row.id} value={row.id}>{sourceStage?.nome || 'Etapa'} → {destinationStage?.nome || 'Destino'} · {row.posicao_inicio || 1}º a {row.posicao_fim || row.quantidade || '?' }º</option> })}</select></label>
          <div className="advanced-progression-actions"><button className="button secondary" disabled={!selectedProgressionRule || busy} onClick={() => void previewProgression(selectedProgressionRule)}>Gerar prévia</button>{progressionPreview ? <button className="button" disabled={busy || (!progressionPreview.summary?.canApply && !replaceProgressionConflicts) || (!progressionPreview.summary?.newCount && !progressionPreview.summary?.conflictCount)} onClick={() => void applyProgression()}>Aplicar progressão</button> : null}</div>
        </div>
        {progressionPreview ? <div className="advanced-progression-preview">
          <div className="advanced-progression-summary"><span><b>{progressionPreview.summary?.selected || 0}</b> selecionadas</span><span><b>{progressionPreview.summary?.newCount || 0}</b> novas</span><span><b>{progressionPreview.summary?.conflictCount || 0}</b> conflitos</span><span><b>{progressionPreview.summary?.alreadyApplied || 0}</b> já aplicadas</span><span><b>{progressionPreview.summary?.available ?? '∞'}</b> vagas disponíveis</span></div>
          {progressionPreview.summary?.conflictCount ? <label className="advanced-progression-replace"><input type="checkbox" checked={replaceProgressionConflicts} onChange={(e) => setReplaceProgressionConflicts(e.target.checked)} /><span>Substituir vínculos conflitantes e preservar o estado anterior no histórico</span></label> : null}
          {!progressionPreview.summary?.canApply && !progressionPreview.summary?.conflictCount ? <div className="message">A etapa de destino não possui vagas suficientes.</div> : null}
          <div className="advanced-progression-list">{(progressionPreview.candidates || []).map((row: Row) => <article key={row.campeonato_equipe_id} className={row.conflict ? 'has-conflict' : ''}><b>{row.colocacao}º · {row.tag ? `${row.tag} — ` : ''}{row.nome}</b><small>{row.pontos_total || 0} pontos · {row.booyahs || 0} booyah(s) · {row.abates || 0} abates</small><span>{row.alreadyApplied ? 'Já aplicada por esta regra' : row.conflict ? 'Conflito com outra origem' : 'Pronta para aplicar'}</span></article>)}</div>
        </div> : null}
        {data.progressionExecutions.length ? <div className="advanced-progression-history"><h5>Histórico de execuções</h5>{data.progressionExecutions.map((execution) => { const rule = data.progressions.find((row) => row.id === execution.regra_id); const sourceStage = data.stages.find((row) => row.id === rule?.etapa_origem_id); const destinationStage = data.stages.find((row) => row.id === rule?.etapa_destino_id); const items = data.progressionExecutionItems.filter((row) => row.execucao_id === execution.id); return <article key={execution.id}><div><b>{sourceStage?.nome || 'Etapa'} → {destinationStage?.nome || 'Destino'}</b><small>{new Date(execution.aplicada_em || execution.created_at).toLocaleString('pt-BR')} · {items.length} equipe(s) · {execution.status}</small>{execution.motivo_reversao ? <small>Motivo: {execution.motivo_reversao}</small> : null}</div>{execution.status === 'aplicada' ? <button className="button secondary" disabled={busy} onClick={() => void reverseProgression(execution.id)}>Reverter</button> : null}</article> })}</div> : null}
      </section> : null}

      {championshipType === 'diario' ? <section className="advanced-card">
        <h4>Horários independentes do Diário</h4>
        <div className="mini-grid four"><label><span>Horário</span><input type="time" value={daily.hour} onChange={(e) => setDaily({ ...daily, hour: e.target.value })} /></label><label><span>Nome exibido</span><input value={daily.display_name} onChange={(e) => setDaily({ ...daily, display_name: e.target.value })} placeholder="19:00" /></label><label><span>Capacidade</span><input type="number" min="1" value={daily.capacity} onChange={(e) => setDaily({ ...daily, capacity: e.target.value })} /></label><label><span>Valor da vaga</span><input type="number" min="0" step="0.01" value={daily.vacancy_value} onChange={(e) => setDaily({ ...daily, vacancy_value: e.target.value })} /></label><label><span>Premiação</span><input value={daily.prize_description} onChange={(e) => setDaily({ ...daily, prize_description: e.target.value })} /></label><label><span>Valor da premiação</span><input type="number" min="0" step="0.01" value={daily.prize_value} onChange={(e) => setDaily({ ...daily, prize_value: e.target.value })} /></label><label><span>Mapa</span><input value={daily.map} onChange={(e) => setDaily({ ...daily, map: e.target.value })} /></label><label><span>Quedas</span><input type="number" min="1" value={daily.drops} onChange={(e) => setDaily({ ...daily, drops: e.target.value })} /></label></div>
        <button className="button" disabled={!daily.hour || busy} onClick={() => void act({ action: 'create_daily_hour', ...daily })}><Plus size={15} /> Adicionar horário</button>
        <div className="advanced-stage-list">{data.dailyHours.map((row) => <article key={row.id}><div><b>{row.nome_exibicao || String(row.horario).slice(0, 5)}</b><small>{row.capacidade || 0} vagas · {row.numero_quedas} queda(s) · {row.mapa || 'Mapa não definido'}</small><select value={row.grupo_id || ''} onChange={(e) => e.target.value && void act({ action: 'link_daily_group', daily_hour_id: row.id, group_id: e.target.value })}><option value="">Vincular grupo</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></div><button className="icon-action-button danger" onClick={() => void act({ action: 'delete', table: 'campeonato_diario_horarios', row_id: row.id })}><Trash2 size={14} /></button></article>)}</div>
      </section> : null}
    </div>
  )
}
