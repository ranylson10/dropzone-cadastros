'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Search, Shield, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Manager = { id: string; nome: string; username: string }
type Grant = { manager_id: string; pode_ver: boolean; pode_editar: boolean; manager: Manager | null }

export function PlayerManagersPanel({ playerId }: { playerId: string }) {
  const [staff, setStaff] = useState<Grant[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Manager[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const endpoint = `/api/jogadores/${encodeURIComponent(playerId)}/staff`
  async function headers() {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, { headers: await headers(), cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setStaff(data.staff || [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os acessos.') }
    finally { setLoading(false) }
  }, [endpoint])
  useEffect(() => { void load() }, [load])

  async function search(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/managers/busca?q=${encodeURIComponent(query.trim())}`, { headers: await headers() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setResults(data.items || [])
      if (!data.items?.length) setMessage('Nenhum manager encontrado. Confira o nome ou @usuário.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível buscar.') }
    finally { setBusy(false) }
  }
  async function save(grant: Pick<Grant, 'manager_id' | 'pode_ver' | 'pode_editar'>, remove = false) {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(endpoint, { method: remove ? 'DELETE' : 'PATCH', headers: await headers(), body: JSON.stringify(grant) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await load()
      setResults([])
      setMessage(remove ? 'Acesso removido.' : 'Funções atualizadas. O vice-líder usa o mesmo painel do jogador.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }
  return <section className="dz-player-delegates" aria-label="Vice-líderes do jogador">
    <h3>Você escolhe quem ajuda.</h3>
    <p>O vice-líder abre este mesmo painel e acessa apenas as funções que você liberar.</p>
    <form onSubmit={search} className="dz-delegate-search">
      <label htmlFor="player-manager-search">Buscar manager pelo nome ou @usuário</label>
      <div><input id="player-manager-search" value={query} onChange={event => setQuery(event.target.value)} minLength={2} required placeholder="@usuário do manager" /><button className="button" disabled={busy || query.trim().length < 2}><Search size={16} /> Buscar</button></div>
    </form>
    {error ? <p role="alert" className="message error">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {results.filter(manager => !staff.some(row => row.manager_id === manager.id)).map(manager => <div className="dz-delegate-row" key={manager.id}><span><strong>{manager.nome}</strong><small>@{manager.username}</small></span><button className="button secondary" disabled={busy} onClick={() => void save({ manager_id: manager.id, pode_ver: true, pode_editar: false })}>Liberar consulta</button></div>)}
    {loading ? <p role="status">Carregando acessos…</p> : null}
    {!loading && !staff.length ? <p>Nenhum vice-líder adicionado.</p> : null}
    {staff.map((row, index) => <div className="dz-delegate-row" key={row.manager_id}>
      <span><Shield size={18} /><strong>{row.manager?.nome || 'Manager'}</strong><small>@{row.manager?.username || 'manager'}</small></span>
      <label><input type="checkbox" checked={row.pode_ver} disabled={busy} onChange={event => setStaff(items => items.map((item, i) => i === index ? { ...item, pode_ver: event.target.checked, pode_editar: event.target.checked && item.pode_editar } : item))} /> Consultar painel</label>
      <label><input type="checkbox" checked={row.pode_editar} disabled={busy || !row.pode_ver} onChange={event => setStaff(items => items.map((item, i) => i === index ? { ...item, pode_editar: event.target.checked } : item))} /> Editar perfil</label>
      <button className="button" disabled={busy} onClick={() => void save(row)}>Salvar funções</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void save(row, true)} aria-label={`Remover acesso de ${row.manager?.nome || 'manager'}`}><Trash2 size={16} /> Remover</button>
    </div>)}
  </section>
}
