'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { campeonatoCallsService } from '../services/campeonato-calls.service'
import './calls.css'

type Row = Record<string, any>

function teamLabel(row: Row) {
  const line = row.equipe_lines
  const team = row.equipes
  return row.nome_exibicao || line?.nome || team?.nome || 'Equipe sem nome'
}

export function CampeonatoCallsTab({ campeonatoId }: { campeonatoId: string }) {
  const [data, setData] = useState<{ mapas: Row[]; calls: Row[]; equipes: Row[]; vinculos: Row[] }>({ mapas: [], calls: [], equipes: [], vinculos: [] })
  const [mapa, setMapa] = useState('')
  const [nome, setNome] = useState('')
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

  const calls = useMemo(() => data.calls.filter((item) => item.mapa_codigo === mapa), [data.calls, mapa])
  const vinculosByCall = useMemo(() => {
    const result = new Map<string, Row[]>()
    for (const item of data.vinculos) result.set(item.call_id, [...(result.get(item.call_id) || []), item])
    return result
  }, [data.vinculos])

  async function createCall() {
    if (!nome.trim() || !mapa) return
    setBusy(true)
    try {
      await campeonatoCallsService.criarCall(campeonatoId, { mapa_codigo: mapa, nome: nome.trim(), ordem: calls.length + 1 })
      setNome('')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao criar call.') }
    finally { setBusy(false) }
  }

  async function assign(callId: string, participacaoId: string) {
    setBusy(true)
    try {
      if (participacaoId) await campeonatoCallsService.vincular(campeonatoId, { call_id: callId, campeonato_equipe_id: participacaoId, tipo: 'principal' })
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao vincular equipe.') }
    finally { setBusy(false) }
  }

  return <section className="xt-calls">
    <header className="xt-calls-head">
      <div><p className="eyebrow">Xtreino</p><h3>Calls dos mapas</h3><small>Definição manual. Nenhuma equipe é distribuída automaticamente.</small></div>
      <label>Mapa<select value={mapa} onChange={(event) => setMapa(event.target.value)}>{data.mapas.map((item) => <option key={item.id} value={item.codigo}>{item.nome}</option>)}</select></label>
    </header>

    {data.mapas.find((item) => item.codigo === mapa)?.imagem_url ? <div className="xt-map-preview"><img src={data.mapas.find((item) => item.codigo === mapa)?.imagem_url} alt={`Mapa ${mapa}`} /></div> : null}

    <div className="xt-call-create"><input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome da call" /><button className="button" disabled={busy || !nome.trim()} onClick={() => void createCall()}><Plus size={16}/> Adicionar call</button></div>
    {message ? <small className="error-text">{message}</small> : null}

    <div className="xt-call-grid">
      {calls.map((call) => {
        const assignments = vinculosByCall.get(call.id) || []
        return <article key={call.id} className="xt-call-card">
          <div className="xt-call-title"><span style={{ background: call.cor }}><MapPin size={15}/></span><strong>{call.nome}</strong><button title="Renomear" onClick={async () => { const next = window.prompt('Novo nome da call', call.nome); if (next?.trim()) { await campeonatoCallsService.editarCall(campeonatoId, { call_id: call.id, nome: next.trim(), cor: call.cor, observacao: call.observacao }); await load() } }}><Pencil size={14}/></button><button title="Excluir call" onClick={async () => { if (window.confirm(`Excluir a call ${call.nome}?`)) { await campeonatoCallsService.excluirCall(campeonatoId, call.id); await load() } }}><Trash2 size={14}/></button></div>
          <label>Equipe principal<select disabled={busy} value={assignments.find((item) => item.tipo === 'principal')?.campeonato_equipe_id || ''} onChange={(event) => { const value = event.target.value; const current = assignments.find((item) => item.tipo === 'principal'); if (!value && current) { void campeonatoCallsService.removerVinculo(campeonatoId, current.id).then(load).catch((error) => setMessage(error instanceof Error ? error.message : 'Erro ao remover vínculo.')) } else { void assign(call.id, value) } }}><option value="">Sem equipe</option>{data.equipes.map((team) => <option key={team.id} value={team.id}>{teamLabel(team)}</option>)}</select></label>
          {assignments.map((assignment) => <div className="xt-call-assignment" key={assignment.id}><span>{teamLabel(data.equipes.find((team) => team.id === assignment.campeonato_equipe_id) || {})}</span><button title="Remover vínculo" onClick={async () => { await campeonatoCallsService.removerVinculo(campeonatoId, assignment.id); await load() }}><Trash2 size={13}/></button></div>)}
        </article>
      })}
      {!calls.length ? <div className="empty-state">Nenhuma call cadastrada neste mapa.</div> : null}
    </div>
  </section>
}
