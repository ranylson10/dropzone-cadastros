'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Check, Eraser, MapPin, MousePointer2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { campeonatoCallsService } from '../services/campeonato-calls.service'
import './calls.css'

type Row = Record<string, any>
type Point = { x: number; y: number }

function teamLabel(row: Row) {
  const line = row.equipe_lines
  const team = row.equipes
  return row.nome_exibicao || line?.nome || team?.nome || 'Equipe sem nome'
}

function teamLogo(row: Row) {
  return row.equipe_lines?.logo_url || row.equipes?.logo_url || ''
}

function centroid(points: Point[]) {
  if (!points.length) return { x: 0.5, y: 0.5 }
  return points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 })
}

function pointString(points: Point[]) {
  return points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')
}

export function CampeonatoCallsTab({ campeonatoId }: { campeonatoId: string }) {
  const [data, setData] = useState<{ mapas: Row[]; calls: Row[]; equipes: Row[]; vinculos: Row[] }>({ mapas: [], calls: [], equipes: [], vinculos: [] })
  const [mapa, setMapa] = useState('')
  const [selectedCalls, setSelectedCalls] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [color, setColor] = useState('#d6b84b')
  const [opacity, setOpacity] = useState(0.42)
  const [drawing, setDrawing] = useState(false)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    try {
      setMessage('')
      const next = await campeonatoCallsService.listar(campeonatoId)
      setData(next)
      setMapa((current) => current || next.mapas?.[0]?.codigo || '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar calls.')
    }
  }

  useEffect(() => { void load() }, [campeonatoId])
  useEffect(() => { setSelectedCalls([]); setDraftPoints([]); setDrawing(false) }, [mapa])

  const currentMap = useMemo(() => data.mapas.find((item) => item.codigo === mapa), [data.mapas, mapa])
  const calls = useMemo(() => data.calls.filter((item) => item.mapa_codigo === mapa && Array.isArray(item.poligono)), [data.calls, mapa])
  const unshapedCalls = useMemo(() => data.calls.filter((item) => item.mapa_codigo === mapa && !Array.isArray(item.poligono)), [data.calls, mapa])
  const vinculosByCall = useMemo(() => {
    const result = new Map<string, Row[]>()
    for (const item of data.vinculos) result.set(item.call_id, [...(result.get(item.call_id) || []), item])
    return result
  }, [data.vinculos])

  function toggleCall(callId: string) {
    setSelectedCalls((current) => current.includes(callId) ? current.filter((id) => id !== callId) : [...current, callId])
  }

  function addPoint(event: MouseEvent<SVGSVGElement>) {
    if (!drawing) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
    setDraftPoints((current) => [...current, point])
  }

  async function saveRegion() {
    if (!draftName.trim() || draftPoints.length < 3 || !mapa) return
    setBusy(true)
    try {
      await campeonatoCallsService.criarCall(campeonatoId, {
        mapa_codigo: mapa,
        nome: draftName.trim(),
        ordem: calls.length + unshapedCalls.length + 1,
        poligono: draftPoints,
      })
      setDraftName('')
      setDraftPoints([])
      setDrawing(false)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao criar região.')
    } finally { setBusy(false) }
  }

  async function applyTeam() {
    if (!selectedTeam || !selectedCalls.length) return
    setBusy(true)
    try {
      await Promise.all(selectedCalls.map((callId) => campeonatoCallsService.vincular(campeonatoId, {
        call_id: callId,
        campeonato_equipe_id: selectedTeam,
        tipo: 'principal',
        cor: color,
        opacidade: opacity,
      })))
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao aplicar equipe.')
    } finally { setBusy(false) }
  }

  async function clearSelected() {
    const links = selectedCalls.flatMap((callId) => vinculosByCall.get(callId) || [])
    if (!links.length) return
    setBusy(true)
    try {
      await Promise.all(links.map((link) => campeonatoCallsService.removerVinculo(campeonatoId, link.id)))
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao limpar calls.')
    } finally { setBusy(false) }
  }

  async function convertOldCall(call: Row) {
    setDraftName(call.nome)
    setDrawing(true)
    setDraftPoints([])
    setMessage(`Desenhe pelo menos 3 pontos para delimitar “${call.nome}”. Depois salve e exclua o cadastro antigo.`)
  }

  return <section className="xt-calls">
    <header className="xt-calls-head">
      <div><p className="eyebrow">Xtreino</p><h3>Mapa territorial de calls</h3><small>Desenhe as regiões, selecione uma ou mais calls e aplique manualmente equipe, cor e opacidade.</small></div>
      <label>Mapa<select value={mapa} onChange={(event) => setMapa(event.target.value)}>{data.mapas.map((item) => <option key={item.id} value={item.codigo}>{item.nome}</option>)}</select></label>
    </header>

    <div className="xt-territory-layout">
      <div className="xt-map-workspace">
        {currentMap?.imagem_url ? <svg className={`xt-map-svg ${drawing ? 'is-drawing' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" onClick={addPoint} aria-label={`Mapa interativo ${currentMap.nome}`}>
          <image href={currentMap.imagem_url} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
          {calls.map((call) => {
            const links = vinculosByCall.get(call.id) || []
            const assignment = links.find((item) => item.tipo === 'principal') || links[0]
            const team = data.equipes.find((item) => item.id === assignment?.campeonato_equipe_id)
            const points = call.poligono as Point[]
            const center = call.label_x != null && call.label_y != null ? { x: Number(call.label_x), y: Number(call.label_y) } : centroid(points)
            const fill = assignment?.cor || call.cor || '#d6b84b'
            const fillOpacity = assignment?.opacidade ?? 0.22
            const selected = selectedCalls.includes(call.id)
            return <g key={call.id} className={selected ? 'is-selected' : ''} onClick={(event) => { if (!drawing) { event.stopPropagation(); toggleCall(call.id) } }}>
              <polygon points={pointString(points)} fill={fill} fillOpacity={fillOpacity} stroke={selected ? '#ffffff' : fill} strokeWidth={selected ? 0.75 : 0.35} vectorEffect="non-scaling-stroke" />
              <text x={center.x * 100} y={center.y * 100 - (teamLogo(team || {}) ? 2.3 : 0)} textAnchor="middle" className="xt-map-call-name">{call.nome}</text>
              {teamLogo(team || {}) ? <image href={teamLogo(team || {})} x={center.x * 100 - 3.5} y={center.y * 100 - 1.5} width="7" height="7" preserveAspectRatio="xMidYMid meet" className="xt-map-team-logo" /> : null}
              {team ? <text x={center.x * 100} y={center.y * 100 + 7} textAnchor="middle" className="xt-map-team-name">{teamLabel(team)}</text> : null}
            </g>
          })}
          {draftPoints.length ? <g className="xt-draft-region">
            {draftPoints.length > 2 ? <polygon points={pointString(draftPoints)} /> : null}
            <polyline points={pointString(draftPoints)} />
            {draftPoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x * 100} cy={point.y * 100} r="0.65" />)}
          </g> : null}
        </svg> : <div className="empty-state">Cadastre uma imagem de mapa no catálogo para usar o editor territorial.</div>}
        <div className="xt-map-status"><MousePointer2 size={15}/>{drawing ? 'Clique no mapa para marcar os vértices da call.' : `${selectedCalls.length} call(s) selecionada(s).`}</div>
      </div>

      <aside className="xt-call-tools">
        <section>
          <strong>1. Criar região</strong>
          <button className={`button ${drawing ? 'secondary' : ''}`} onClick={() => { setDrawing((value) => !value); setDraftPoints([]) }}>{drawing ? <X size={15}/> : <Plus size={15}/>} {drawing ? 'Cancelar desenho' : 'Desenhar call'}</button>
          {drawing ? <>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Nome da call" />
            <div className="xt-tool-row"><button disabled={!draftPoints.length} onClick={() => setDraftPoints((points) => points.slice(0, -1))}>Desfazer ponto</button><button disabled={draftPoints.length < 3 || !draftName.trim() || busy} onClick={() => void saveRegion()}><Save size={14}/> Salvar região</button></div>
          </> : null}
        </section>

        <section>
          <strong>2. Aplicar equipe</strong>
          <label>Equipe<select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}><option value="">Selecione</option>{data.equipes.map((team) => <option key={team.id} value={team.id}>{teamLabel(team)}</option>)}</select></label>
          <div className="xt-color-row"><label>Cor<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label>Opacidade <b>{Math.round(opacity * 100)}%</b><input type="range" min="0.1" max="0.9" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label></div>
          <button className="button" disabled={!selectedCalls.length || !selectedTeam || busy} onClick={() => void applyTeam()}><Check size={15}/> Aplicar nas calls selecionadas</button>
          <button className="button secondary" disabled={!selectedCalls.length || busy} onClick={() => void clearSelected()}><Eraser size={15}/> Limpar selecionadas</button>
        </section>

        <section>
          <strong>Legenda e edição</strong>
          <div className="xt-call-list">{calls.map((call) => {
            const assignment = (vinculosByCall.get(call.id) || [])[0]
            const team = data.equipes.find((item) => item.id === assignment?.campeonato_equipe_id)
            return <div key={call.id} className={selectedCalls.includes(call.id) ? 'is-selected' : ''}>
              <button className="xt-call-select" onClick={() => toggleCall(call.id)}><span style={{ background: assignment?.cor || call.cor }}/><b>{call.nome}</b><small>{team ? teamLabel(team) : 'Livre'}</small></button>
              <button title="Renomear" onClick={async () => { const next = window.prompt('Novo nome da call', call.nome); if (next?.trim()) { await campeonatoCallsService.editarCall(campeonatoId, { call_id: call.id, nome: next.trim(), cor: call.cor, observacao: call.observacao, poligono: call.poligono }); await load() } }}><Pencil size={13}/></button>
              <button title="Excluir" onClick={async () => { if (window.confirm(`Excluir a call ${call.nome}?`)) { await campeonatoCallsService.excluirCall(campeonatoId, call.id); await load() } }}><Trash2 size={13}/></button>
            </div>
          })}</div>
        </section>

        {unshapedCalls.length ? <section className="xt-legacy-calls"><strong>Calls antigas sem área</strong><small>Converta os cadastros criados na versão anterior desenhando os territórios.</small>{unshapedCalls.map((call) => <div key={call.id}><span><MapPin size={13}/>{call.nome}</span><button onClick={() => void convertOldCall(call)}>Desenhar</button><button onClick={async () => { if (window.confirm(`Excluir a call antiga ${call.nome}?`)) { await campeonatoCallsService.excluirCall(campeonatoId, call.id); await load() } }}><Trash2 size={13}/></button></div>)}</section> : null}
      </aside>
    </div>
    {message ? <small className="error-text">{message}</small> : null}
  </section>
}
