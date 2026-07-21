'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bot, CalendarDays, Check, CheckCircle2, Clock, Shield, UserRound, Users, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

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

const GUEST_KEY = 'dropzone_escala_guest'

export default function EscalaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').trim()
  const returnTo = `/escala/${encodeURIComponent(token)}`

  const [data, setData] = useState<ScalePayload | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [gate, setGate] = useState(true)
  const [guest, setGuest] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const hasSession = Boolean(sessionData.session)
      const isGuest = sessionStorage.getItem(`${GUEST_KEY}:${token}`) === '1'
      setGuest(isGuest && !hasSession)
      // Gate: sem login e sem visitante → pede tipo de login (padrão do sistema)
      setGate(!hasSession && !isGuest)

      const response = await fetch(`/api/escalacoes/${encodeURIComponent(token)}`, {
        headers: sessionData.session
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        cache: 'no-store',
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

  // Logado sem perfil de jogador → formulário de criação (padrão do sistema)
  useEffect(() => {
    if (loading || !data) return
    if (data.error) return
    if (!data.autenticado) return
    if (data.jogador) return
    window.location.replace(buildProfileCreationHref('jogador', returnTo))
  }, [loading, data?.autenticado, data?.jogador, data?.error, returnTo, token])

  function continueAsGuest() {
    sessionStorage.setItem(`${GUEST_KEY}:${token}`, '1')
    setGuest(true)
    setGate(false)
  }

  async function join() {
    setError('')
    setMessage('')
    setJoining(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) {
        setGate(true)
        throw new Error('Entre com uma conta de jogador para continuar.')
      }
      if (!data?.jogador) {
        window.location.assign(buildProfileCreationHref('jogador', returnTo))
        return
      }

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

  function BotBubble({ children }: { children: ReactNode }) {
    return (
      <div className="invite-chat-row bot">
        <span className="invite-bot-avatar"><Bot size={18} /></span>
        <div className="invite-chat-bubble">
          <strong>Lili</strong>
          <div>{children}</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <DropzoneLoader label="Carregando escalação" />
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

  // Redirecionando para criar perfil de jogador
  if (data.autenticado && !data.jogador) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <UserRound size={42} />
          <p className="eyebrow">Perfil de jogador</p>
          <h1>Criando seu perfil de jogo...</h1>
          <p>
            Este convite de escalação exige um <strong>perfil de jogador</strong>. Abrindo o cadastro...
          </p>
          <a className="button invite-confirm" href={buildProfileCreationHref('jogador', returnTo)}>
            Criar jogador agora
          </a>
          <a className="button secondary" href={buildLoginHref('jogador', returnTo, true)}>
            Usar outro login
          </a>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="page public-page">
        <div className="shell public-shell">
          <section className="panel span-3 public-card scale-invite-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Convite de escalação</p>
                <h2>{data.campeonato_nome || 'Escalação'}</h2>
                <span>
                  {data.line_nome || ''}
                  {guest ? ' · modo visitante' : ''}
                </span>
              </div>
              <Shield />
            </div>

            <div className="lineup-public-meta">
              <span>
                <Users size={16} /> {players.length}/{limit} jogadores
              </span>
              <span>
                <CalendarDays size={16} />{' '}
                {data.data_jogo
                  ? new Date(`${data.data_jogo}T00:00:00`).toLocaleDateString('pt-BR')
                  : 'Data não definida'}
              </span>
              <span>
                <Clock size={16} /> {data.horario ? String(data.horario).slice(0, 5) : 'Horário não definido'}
              </span>
            </div>

            <div className="invite-details scale-context-details">
              <span>
                <strong>Fase</strong>
                {data.fase_nome || 'Não definida'}
              </span>
              <span>
                <strong>Grupo</strong>
                {data.grupo_nome || 'Não definido'}
              </span>
              <span>
                <strong>Slot da equipe</strong>
                {data.slot_equipe || '-'}
              </span>
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
                        <span>
                          {player.funcao}
                          {player.capitao ? ' · Capitão' : ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span>Disponível</span>
                  )}
                </div>
              ))}
            </div>

            {error ? <div className="message error">{error}</div> : null}
            {message ? <div className="message">{message}</div> : null}

            {data.ja_inscrito ? (
              <div className="invite-team-confirmation scale-current-player invite-chat-shell">
                <BotBubble>
                  <p>Boa! VocÃª jÃ¡ estÃ¡ nessa escalaÃ§Ã£o.</p>
                  <p>Confira seu slot abaixo e acompanhe os jogadores confirmados.</p>
                </BotBubble>
                <div className="invite-current-team">
                  <small>Você já está nesta escalação</small>
                  <strong>{data.jogador?.nome || data.jogador?.username || data.inscricao_atual?.nick}</strong>
                  <span>Slot {data.inscricao_atual?.slot_numero || '-'}</span>
                </div>
                <div className="invite-expired scale-confirmed-state">
                  <CheckCircle2 size={20} /> Acompanhe acima os jogadores já confirmados.
                </div>
              </div>
            ) : data.autenticado && data.jogador ? (
              <div className="invite-team-confirmation scale-current-player invite-chat-shell">
                <BotBubble>
                  <p>Encontrei seu jogador: <strong>{data.jogador.nome || data.jogador.username}</strong>.</p>
                  <p>Quer confirmar entrada nessa escalaÃ§Ã£o?</p>
                </BotBubble>
                <div className="invite-current-team">
                  <small>Inscrever com o perfil de jogador</small>
                  <strong>{data.jogador.nome || data.jogador.username}</strong>
                  <span>
                    {data.jogador.id_jogo ? `ID: ${data.jogador.id_jogo}` : 'ID de jogo não informado'}
                  </span>
                </div>
                <button className="button invite-confirm" disabled={full || joining} onClick={() => void join()}>
                  <Check size={16} />{' '}
                  {joining
                    ? 'Confirmando...'
                    : full
                      ? 'Escalação completa'
                      : `Inscrever como ${data.jogador.nome || data.jogador.username}`}
                </button>
                <a className="button secondary" href={buildLoginHref('jogador', returnTo, true)}>
                  Usar outro jogador
                </a>
              </div>
            ) : guest || !data.autenticado ? (
              <div className="invite-auth-box invite-chat-shell">
                <BotBubble>
                  <p>VocÃª estÃ¡ vendo como visitante.</p>
                  <p>Para entrar na escalaÃ§Ã£o, faÃ§a login com uma conta de jogador.</p>
                </BotBubble>
                <p>
                  Você está no <strong>modo visitante</strong>: pode ver a escalação, mas para se inscrever precisa de
                  um <strong>perfil de jogador</strong>.
                </p>
                <button className="button invite-confirm" type="button" onClick={() => setGate(true)}>
                  Entrar com conta de jogador
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      {gate ? (
        <div className="vacancies-access-gate">
          <section>
            <button className="gate-close" type="button" onClick={continueAsGuest} aria-label="Fechar">
              <X size={18} />
            </button>
            <img src="/dropzone-icon.png" alt="" />
            <p className="eyebrow">Escalação da line</p>
            <h2>Como deseja continuar?</h2>
            <div className="invite-chat-shell" style={{ margin: '12px 0' }}>
              <BotBubble>
                <p>Oi! Eu sou a Lili ðŸ± Vou te ajudar a entrar na escalaÃ§Ã£o da line.</p>
                <p>Se ainda nÃ£o tiver perfil de jogador, eu te levo para criar um.</p>
              </BotBubble>
            </div>
            <p>
              Para entrar na escalação você precisa de um <strong>perfil de jogador</strong>. Entre com
              Google/Facebook/Discord — se ainda não tiver jogador, o cadastro abre em seguida. Sem login você só
              visualiza os slots.
            </p>
            <SocialLogin profileType="jogador" returnTo={returnTo} />
            <button className="continue-guest" type="button" onClick={continueAsGuest}>
              Continuar sem login
            </button>
            <a
              className="button secondary"
              href={buildLoginHref('jogador', returnTo)}
              style={{ width: '100%', marginTop: 8, placeContent: 'center' }}
            >
              Entrar com login e senha
            </a>
          </section>
        </div>
      ) : null}
    </>
  )
}
