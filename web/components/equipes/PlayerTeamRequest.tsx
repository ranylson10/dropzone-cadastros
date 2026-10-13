'use client'

import { Input as UiInput } from '@/components/ui/Field'
import { useEffect, useState } from 'react'
import { Search, Send, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { currentInternalPath, redirectToLogin } from '@/features/auth/auth-return'
import { usePagedSearch } from '@/hooks/usePagedSearch'

export function PlayerTeamRequest({ mode, equipeId, accessToken }: { mode: 'invite_player' | 'request_join'; equipeId?: string; accessToken?: string | null }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const directory = usePagedSearch<any>(mode === 'invite_player' ? '/api/jogadores/busca' : '/api/equipes/busca-publica', { authenticated: mode === 'invite_player', accessToken })
  const items = directory.items

  async function token() {
    if (accessToken) return accessToken
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) {
      redirectToLogin(null, currentInternalPath())
      throw new Error('Redirecionando para o login…')
    }
    return data.session.access_token
  }

  async function search(value = query.trim()) {
    const normalized = value.trim()
    if (normalized.length < 2) return
    setMessage('')
    await directory.search(normalized)
  }

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      directory.clear()
      if (!value) setMessage('')
      return
    }
    const timer = window.setTimeout(() => void search(value), 420)
    return () => window.clearTimeout(timer)
  }, [query, mode])

  async function send(item: any) {
    setBusy(true); setMessage('')
    try {
      const auth = await token()
      const response = await fetch('/api/equipes/relacionamentos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, equipe_id: mode === 'invite_player' ? equipeId : item.id, jogador_id: mode === 'invite_player' ? item.id : undefined }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar.')
      setMessage(mode === 'invite_player' ? 'Convite enviado ao correio do jogador.' : 'Pedido enviado ao correio da equipe.')
      directory.clear(); setQuery('')
    } catch (cause: any) { setMessage(cause?.message || 'Não foi possível enviar.') }
    finally { setBusy(false) }
  }

  return <section className="player-team-request">
    <div className="player-team-request-title"><UserPlus size={18}/><div><strong>{mode === 'invite_player' ? 'Convidar jogador diretamente' : 'Pedir para entrar em uma equipe'}</strong><span>Digite ao menos 2 caracteres. A busca acontece automaticamente; o destinatário recebe no correio e pode aceitar ou recusar.</span></div></div>
    <div className="player-team-request-search"><UiInput value={query} onChange={(event) => { directory.clear(); setQuery(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') void search() }} aria-label={mode === 'invite_player' ? 'Buscar jogador' : 'Buscar equipe'} placeholder={mode === 'invite_player' ? 'Nick, @usuário ou ID' : 'Nome, tag ou @equipe'}/><button type="button" aria-label="Pesquisar" onClick={() => void search()} disabled={busy || directory.loading || query.trim().length < 2}><Search size={16}/></button></div>
    {message ? <p>{message}</p> : null}
    {directory.error ? <p role="alert">{directory.error}</p> : null}
    {directory.loading ? <p role="status">Buscando...</p> : null}
    {directory.term && !directory.loading && !directory.error && !items.length ? <p role="status">Nenhum resultado encontrado.</p> : null}
    <div className="player-team-request-results">{items.map((item) => <article key={item.id}><span>{item.avatar_url || item.logo_url ? <img src={item.avatar_url || item.logo_url} alt=""/> : String(item.nick || item.nome || 'DZ').slice(0, 2)}</span><div><strong>{item.nick || item.nome}</strong><small>{item.username ? `@${item.username}` : item.tag || item.funcao || ''}</small></div><button type="button" onClick={() => void send(item)} disabled={busy}><Send size={15}/> Enviar</button></article>)}</div>
    {directory.nextCursor ? <button type="button" disabled={busy || directory.loading} onClick={() => void directory.more()}>Carregar mais resultados</button> : null}
  </section>
}
