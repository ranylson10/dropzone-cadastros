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
}

const empty: Structure = { edition: null, franchise: null, divisions: [], stages: [], sources: [], progressions: [], prizes: [], dailyHours: [], teams: [], stageTeams: [], phases: [], groups: [] }

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

      {championshipType === 'diario' ? <section className="advanced-card">
        <h4>Horários independentes do Diário</h4>
        <div className="mini-grid four"><label><span>Horário</span><input type="time" value={daily.hour} onChange={(e) => setDaily({ ...daily, hour: e.target.value })} /></label><label><span>Nome exibido</span><input value={daily.display_name} onChange={(e) => setDaily({ ...daily, display_name: e.target.value })} placeholder="19:00" /></label><label><span>Capacidade</span><input type="number" min="1" value={daily.capacity} onChange={(e) => setDaily({ ...daily, capacity: e.target.value })} /></label><label><span>Valor da vaga</span><input type="number" min="0" step="0.01" value={daily.vacancy_value} onChange={(e) => setDaily({ ...daily, vacancy_value: e.target.value })} /></label><label><span>Premiação</span><input value={daily.prize_description} onChange={(e) => setDaily({ ...daily, prize_description: e.target.value })} /></label><label><span>Valor da premiação</span><input type="number" min="0" step="0.01" value={daily.prize_value} onChange={(e) => setDaily({ ...daily, prize_value: e.target.value })} /></label><label><span>Mapa</span><input value={daily.map} onChange={(e) => setDaily({ ...daily, map: e.target.value })} /></label><label><span>Quedas</span><input type="number" min="1" value={daily.drops} onChange={(e) => setDaily({ ...daily, drops: e.target.value })} /></label></div>
        <button className="button" disabled={!daily.hour || busy} onClick={() => void act({ action: 'create_daily_hour', ...daily })}><Plus size={15} /> Adicionar horário</button>
        <div className="advanced-stage-list">{data.dailyHours.map((row) => <article key={row.id}><div><b>{row.nome_exibicao || String(row.horario).slice(0, 5)}</b><small>{row.capacidade || 0} vagas · {row.numero_quedas} queda(s) · {row.mapa || 'Mapa não definido'}</small><select value={row.grupo_id || ''} onChange={(e) => e.target.value && void act({ action: 'link_daily_group', daily_hour_id: row.id, group_id: e.target.value })}><option value="">Vincular grupo</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></div><button className="icon-action-button danger" onClick={() => void act({ action: 'delete', table: 'campeonato_diario_horarios', row_id: row.id })}><Trash2 size={14} /></button></article>)}</div>
      </section> : null}
    </div>
  )
}
