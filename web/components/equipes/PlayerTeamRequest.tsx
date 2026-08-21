'use client'

import { useState } from 'react'
import { Search, Send, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { currentInternalPath, redirectToLogin } from '@/features/auth/auth-return'

export function PlayerTeamRequest({ mode, equipeId, accessToken }: { mode: 'invite_player' | 'request_join'; equipeId?: string; accessToken?: string | null }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function token() {
    if (accessToken) return accessToken
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) {
      redirectToLogin(null, currentInternalPath())
      throw new Error('Redirecionando para o login…')
    }
    return data.session.access_token
  }

  async function search() {
    if (query.trim().length < 2) return
    setBusy(true); setMessage('')
    try {
      const auth = await token()
      const endpoint = mode === 'invite_player' ? '/api/jogadores/busca' : '/api/equipes/busca-publica'
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${auth}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro na busca.')
      setItems(payload.items || [])
      if (!(payload.items || []).length) setMessage('Nenhum resultado encontrado.')
    } catch (cause: any) { setMessage(cause?.message || 'Erro na busca.') }
    finally { setBusy(false) }
  }

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
      setItems([]); setQuery('')
    } catch (cause: any) { setMessage(cause?.message || 'Não foi possível enviar.') }
    finally { setBusy(false) }
  }

  return <section className="player-team-request">
    <div className="player-team-request-title"><UserPlus size={18}/><div><strong>{mode === 'invite_player' ? 'Convidar jogador diretamente' : 'Pedir para entrar em uma equipe'}</strong><span>O destinatário recebe no correio e pode aceitar ou recusar.</span></div></div>
    <div className="player-team-request-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search() }} placeholder={mode === 'invite_player' ? 'Nick, @usuário ou ID' : 'Nome, tag ou @equipe'}/><button type="button" onClick={() => void search()} disabled={busy || query.trim().length < 2}><Search size={16}/></button></div>
    {message ? <p>{message}</p> : null}
    <div className="player-team-request-results">{items.map((item) => <article key={item.id}><span>{item.avatar_url || item.logo_url ? <img src={item.avatar_url || item.logo_url} alt=""/> : String(item.nick || item.nome || 'DZ').slice(0, 2)}</span><div><strong>{item.nick || item.nome}</strong><small>{item.username ? `@${item.username}` : item.tag || item.funcao || ''}</small></div><button type="button" onClick={() => void send(item)} disabled={busy}><Send size={15}/> Enviar</button></article>)}</div>
  </section>
}
