'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Clock, Loader2, Shield, UserRound, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'

type Player = {
  id: string
  jogador_id: string | null
  nick: string
  foto_url: string | null
  id_jogo: string
  funcao: string
  slot_numero: number | null
  capitao: boolean
}

type PlayerProfile = {
  id: string
  username: string
  nome: string
  avatar_url: string | null
  id_jogo: string | null
  funcao: string | null
}

type ScalePayload = {
  error?: string
  autenticado?: boolean
  jogador?: PlayerProfile | null
  ja_inscrito?: boolean
  inscricao_atual?: Player | null
  campeonato_nome?: string
  line_nome?: string
  fase_nome?: string | null
  grupo_nome?: string | null
  slot_equipe?: number | null
  data_jogo?: string | null
  horario?: string | null
  limite_jogadores?: number
  link?: {
    token: string
    limite_jogadores?: number | null
    expira_em?: string | null
  }
  jogadores?: Player[]
}

export default function EscalaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').trim().toUpperCase()
  const [data, setData] = useState<ScalePayload | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`/api/escalacoes/${encodeURIComponent(token)}`, {
        headers: sessionData.session
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar escalação.')
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar escalação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) void load()
  }, [token])

  async function join() {
    setError('')
    setMessage('')
    setJoining(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) throw new Error('Entre com uma conta de jogador para continuar.')

      const response = await fetch(`/api/escalacoes/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao entrar na escalação.')
      setMessage(json.already_registered ? 'Você já está nesta escalação.' : 'Inscrição confirmada na escalação.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar na escalação.')
    } finally {
      setJoining(false)
    }
  }

  const limit = Number(data?.link?.limite_jogadores || data?.limite_jogadores || 0)
  const players = data?.jogadores || []
  const slots = useMemo(
    () => Array.from({ length: limit }, (_, index) => players.find((player) => Number(player.slot_numero) === index + 1)),
    [limit, players],
  )
  const full = limit > 0 && players.length >= limit

  if (loading) {
    return <main className="invite-page"><Loader2 className="spin" /></main>
  }

  if (!data || data.error) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Convite inválido</h1>
          <p>{data?.error || error || 'Não foi possível carregar esta escalação.'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page public-page">
      <div className="shell public-shell">
        <section className="panel span-3 public-card scale-invite-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Convite de escalação</p>
              <h2>{data.campeonato_nome || 'Escalação'}</h2>
              <span>{data.line_nome || ''}</span>
            </div>
            <Shield />
          </div>

          <div className="lineup-public-meta">
            <span><Users size={16} /> {players.length}/{limit} jogadores</span>
            <span><CalendarDays size={16} /> {data.data_jogo ? new Date(`${data.data_jogo}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}</span>
            <span><Clock size={16} /> {data.horario ? String(data.horario).slice(0, 5) : 'Horário não definido'}</span>
          </div>

          <div className="invite-details scale-context-details">
            <span><strong>Fase</strong>{data.fase_nome || 'Não definida'}</span>
            <span><strong>Grupo</strong>{data.grupo_nome || 'Não definido'}</span>
            <span><strong>Slot da equipe</strong>{data.slot_equipe || '-'}</span>
          </div>

          <div className="lineup-slots public-lineup-slots">
            {slots.map((player, index) => (
              <div className={`lineup-slot ${player ? 'occupied' : ''}`} key={index}>
                <b>{index + 1}</b>
                {player ? (
                  <>
                    <img src={player.foto_url || '/favicon.ico'} alt="" />
                    <div>
                      <strong>{player.nick}</strong>
                      <span>{player.funcao}{player.capitao ? ' · Capitão' : ''}</span>
                    </div>
                  </>
                ) : <span>Disponível</span>}
              </div>
            ))}
          </div>

          {error ? <div className="message error">{error}</div> : null}
          {message ? <div className="message">{message}</div> : null}

          {data.ja_inscrito ? (
            <div className="invite-team-confirmation scale-current-player">
              <div className="invite-current-team">
                <small>Você já está nesta escalação</small>
                <strong>{data.jogador?.nome || data.jogador?.username || data.inscricao_atual?.nick}</strong>
                <span>Slot {data.inscricao_atual?.slot_numero || '-'}</span>
              </div>
              <div className="invite-expired scale-confirmed-state">
                <CheckCircle2 size={20} /> Acompanhe acima os jogadores já confirmados.
              </div>
            </div>
          ) : data.autenticado ? (
            data.jogador ? (
              <div className="invite-team-confirmation scale-current-player">
                <div className="invite-current-team">
                  <small>Inscrever com o perfil de jogador vinculado</small>
                  <strong>{data.jogador.nome || data.jogador.username}</strong>
                  <span>{data.jogador.id_jogo ? `ID: ${data.jogador.id_jogo}` : 'ID de jogo não informado'}</span>
                </div>
                <button className="button invite-confirm" disabled={full || joining} onClick={join}>
                  <Check size={16} /> {joining ? 'Confirmando...' : full ? 'Escalação completa' : `Inscrever como ${data.jogador.nome || data.jogador.username}`}
                </button>
                <a className="button secondary" href={buildLoginHref('jogador', `/escala/${encodeURIComponent(token)}`, true)}>Usar outro jogador</a>
              </div>
            ) : (
              <div className="invite-auth-box">
                <UserRound size={26} />
                <p>Seu login está ativo, mas ainda não possui um perfil de jogador vinculado.</p>
                <a className="button" href={buildProfileCreationHref('jogador', `/escala/${encodeURIComponent(token)}`)}>Criar jogador com meu login atual</a>
                <a className="button secondary" href={buildLoginHref('jogador', `/escala/${encodeURIComponent(token)}`, true)}>Criar jogador com outro login</a>
              </div>
            )
          ) : (
            <div className="invite-auth-actions">
              <a className="button" href={buildLoginHref('jogador', `/escala/${encodeURIComponent(token)}`)}>Entrar para continuar</a>
              <p className="invite-auth-hint">Você será direcionado ao login central e voltará automaticamente para esta escalação.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
