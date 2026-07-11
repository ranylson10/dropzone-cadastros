'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Check, Clock, Shield, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

export default function EscalaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then((value) => setToken(String(value.token || '').toUpperCase())) }, [params])
  useEffect(() => { if (token) load() }, [token])

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/escalacoes/${token}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar escalação.')
      setData(json)
    } catch (err: any) { setError(err?.message || 'Erro ao carregar escalação.') }
    finally { setLoading(false) }
  }

  async function join() {
    setError(''); setMessage('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) throw new Error('Entre com sua conta de jogador e abra este link novamente.')
      const response = await fetch(`/api/escalacoes/${token}`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao entrar na escalação.')
      setMessage(json.already_registered ? 'Você já está nesta escalação.' : 'Inscrição confirmada na escalação.')
      await load()
    } catch (err: any) { setError(err?.message || 'Erro ao entrar na escalação.') }
  }

  const limit = Number(data?.link?.limite_jogadores || data?.limite_jogadores || 0)
  const players = data?.jogadores || []
  const slots = Array.from({ length: limit }, (_, index) => players.find((player: any) => Number(player.slot_numero) === index + 1))

  return <main className="page public-page"><div className="shell public-shell"><section className="panel span-3 public-card">
    <div className="section-head"><div><p className="eyebrow">Convite de escalação</p><h2>{data?.campeonato_nome || 'Escalação'}</h2><span>{data?.line_nome || ''}</span></div><Shield /></div>
    {loading ? <p className="empty">Carregando...</p> : null}
    {error ? <div className="message error">{error}</div> : null}
    {message ? <div className="message">{message}</div> : null}
    {data ? <>
      <div className="lineup-public-meta">
        <span><Users size={16}/> {players.length}/{limit} jogadores</span>
        <span><CalendarDays size={16}/> {data.data_jogo ? new Date(`${data.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}</span>
        <span><Clock size={16}/> {data.horario ? String(data.horario).slice(0,5) : 'Horário não definido'}</span>
      </div>
      <div className="lineup-slots public-lineup-slots">{slots.map((player: any, index) => <div className={`lineup-slot ${player ? 'occupied' : ''}`} key={index}><b>{index + 1}</b>{player ? <><img src={player.foto_url || '/favicon.ico'} alt=""/><div><strong>{player.nick}</strong><span>{player.funcao}{player.capitao ? ' · Capitão' : ''}</span></div></> : <span>Disponível</span>}</div>)}</div>
      <button className="button" disabled={players.length >= limit} onClick={join}><Check size={16}/> {players.length >= limit ? 'Escalação completa' : 'Entrar nesta escalação'}</button>
    </> : null}
  </section></div></main>
}
