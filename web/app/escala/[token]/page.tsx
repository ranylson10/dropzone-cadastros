'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  Cat,
  Check,
  CheckCircle2,
  Clock,
  LogIn,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'
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

type ChatEntry = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

type ChatAction = {
  id: 'login' | 'guest' | 'join' | 'other_login'
  label: string
  primary?: boolean
}

const GUEST_KEY = 'dropzone_escala_guest'
const MODE_KEY = 'dropzone_escala_mode'

export default function EscalaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '').trim()
  const returnTo = `/escala/${encodeURIComponent(token)}`

  const [data, setData] = useState<ScalePayload | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [guest, setGuest] = useState(false)
  const [modeChosen, setModeChosen] = useState(false)
  const [assistantMode, setAssistantMode] = useState(true)

  const [transcript, setTranscript] = useState<ChatEntry[]>([])
  const [typing, setTyping] = useState(false)
  const [chatReady, setChatReady] = useState(false)
  const [latestAnimatedId, setLatestAnimatedId] = useState('')
  const chatRef = useRef<HTMLDivElement | null>(null)
  const queueRef = useRef<Array<{ id: string; text: string }>>([])
  const queueRunningRef = useRef(false)
  const queueGenerationRef = useRef(0)
  const deliveredStateRef = useRef('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const hasSession = Boolean(sessionData.session)
      const isGuest = sessionStorage.getItem(`${GUEST_KEY}:${token}`) === '1'
      const storedMode = sessionStorage.getItem(`${MODE_KEY}:${token}`)

      setGuest(isGuest && !hasSession)
      if (storedMode === 'assistant' || storedMode === 'normal') {
        setAssistantMode(storedMode === 'assistant')
        setModeChosen(true)
      }

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

  useEffect(() => {
    if (loading || !data || data.error || !data.autenticado || data.jogador) return
    window.location.replace(buildProfileCreationHref('jogador', returnTo))
  }, [loading, data, returnTo])

  function chooseMode(mode: 'assistant' | 'normal') {
    sessionStorage.setItem(`${MODE_KEY}:${token}`, mode)
    setAssistantMode(mode === 'assistant')
    setModeChosen(true)
  }

  function continueAsGuest() {
    sessionStorage.setItem(`${GUEST_KEY}:${token}`, '1')
    setGuest(true)
  }

  async function join() {
    setError('')
    setMessage('')
    setJoining(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) throw new Error('Entre com uma conta de jogador para continuar.')
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
      appendUserReply('Confirmar minha entrada')
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

  const assistantState = useMemo(() => {
    if (!data) return { key: 'loading', messages: [] as string[], actions: [] as ChatAction[] }

    const context = `${data.campeonato_nome || 'Campeonato'} · ${data.line_nome || 'Line'}`
    const occupancy = `${players.length} de ${limit || '?'} jogadores confirmados.`

    if (!data.autenticado) {
      return {
        key: `guest:${guest ? 'viewing' : 'start'}:${players.length}`,
        messages: guest
          ? [
              `Você está acompanhando a escalação de ${context}.`,
              occupancy,
              'Para ocupar uma vaga, entre com sua conta de jogador.',
            ]
          : [
              `Olá! Eu sou a Lili. Vou ajudar você na escalação de ${context}.`,
              occupancy,
              'Para entrar na line, preciso confirmar sua conta de jogador.',
            ],
        actions: [
          { id: 'login' as const, label: 'Entrar com conta de jogador', primary: true },
          { id: 'guest' as const, label: 'Apenas acompanhar' },
        ],
      }
    }

    if (data.ja_inscrito) {
      return {
        key: `registered:${data.inscricao_atual?.id || ''}:${players.length}`,
        messages: [
          `Boa! Você já está nessa escalação como ${data.inscricao_atual?.nick || data.jogador?.nome || data.jogador?.username}.`,
          `Seu lugar é o slot ${data.inscricao_atual?.slot_numero || '-'}.`,
          `${occupancy} Você pode acompanhar a lista abaixo.`,
        ],
        actions: [{ id: 'other_login' as const, label: 'Usar outro jogador' }],
      }
    }

    return {
      key: `ready:${data.jogador?.id || ''}:${players.length}:${full}`,
      messages: [
        `Encontrei seu perfil: ${data.jogador?.nome || data.jogador?.username}.`,
        occupancy,
        full
          ? 'A escalação já está completa. Você pode acompanhar os jogadores confirmados.'
          : 'Ainda há vaga. Posso confirmar sua entrada agora.',
      ],
      actions: full
        ? [{ id: 'other_login' as const, label: 'Usar outro jogador' }]
        : [
            { id: 'join' as const, label: 'Confirmar minha entrada', primary: true },
            { id: 'other_login' as const, label: 'Usar outro jogador' },
          ],
    }
  }, [data, full, guest, limit, players.length])

  const wait = (delay: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delay))

  async function runQueue(generation: number) {
    if (queueRunningRef.current) return
    queueRunningRef.current = true
    setChatReady(false)
    try {
      while (queueRef.current.length) {
        if (queueGenerationRef.current !== generation) return
        const next = queueRef.current[0]
        setTyping(true)
        await wait(Math.min(3600, Math.max(1500, next.text.length * 36)))
        if (queueGenerationRef.current !== generation) return
        setTyping(false)
        setTranscript((current) => [...current, { id: next.id, role: 'assistant', text: next.text }])
        setLatestAnimatedId(next.id)
        queueRef.current.shift()
        await wait(520)
        setLatestAnimatedId('')
        await wait(420)
      }
    } finally {
      queueRunningRef.current = false
      if (queueGenerationRef.current === generation) {
        setTyping(false)
        setChatReady(queueRef.current.length === 0)
      }
    }
  }

  useEffect(() => {
    if (!modeChosen || !assistantMode || !data) return
    const stateKey = assistantState.key
    if (deliveredStateRef.current === stateKey) return
    deliveredStateRef.current = stateKey
    setChatReady(false)
    assistantState.messages.forEach((text, index) => {
      queueRef.current.push({ id: `assistant:${stateKey}:${index}:${Date.now()}`, text })
    })
    void runQueue(queueGenerationRef.current)
  }, [assistantMode, assistantState, data, modeChosen])

  useEffect(() => {
    const shell = chatRef.current
    if (!shell) return
    const frame = requestAnimationFrame(() => shell.scrollTo({ top: shell.scrollHeight, behavior: 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [transcript.length, typing, joining, error, message])

  function appendUserReply(text: string) {
    const id = `user:${Date.now()}:${Math.random().toString(36).slice(2)}`
    setTranscript((current) => [...current, { id, role: 'user', text }])
    setLatestAnimatedId(id)
    window.setTimeout(() => setLatestAnimatedId(''), 520)
  }

  function executeAction(action: ChatAction) {
    if (action.id === 'guest') {
      appendUserReply(action.label)
      continueAsGuest()
      return
    }
    if (action.id === 'join') {
      void join()
      return
    }
    appendUserReply(action.label)
    window.location.assign(buildLoginHref('jogador', returnTo, action.id === 'other_login'))
  }

  function LiliAvatar() {
    return (
      <span className="invite-bot-avatar" aria-label="Lili">
        <Cat size={21} strokeWidth={2.2} />
      </span>
    )
  }

  function BotBubble({ children, animate = false }: { children: ReactNode; animate?: boolean }) {
    return (
      <div className={`invite-chat-row bot ${animate ? 'invite-chat-enter' : ''}`}>
        <LiliAvatar />
        <div className="invite-chat-bubble">
          <strong>Lili</strong>
          <div>{children}</div>
        </div>
      </div>
    )
  }

  function UserBubble({ children, animate = false }: { children: ReactNode; animate?: boolean }) {
    return (
      <div className={`invite-chat-row user ${animate ? 'invite-chat-enter' : ''}`}>
        <div className="invite-chat-bubble user"><div>{children}</div></div>
      </div>
    )
  }

  function TypingBubble() {
    return (
      <div className="invite-chat-row bot">
        <LiliAvatar />
        <div className="invite-typing" aria-label="Lili digitando">
          <span /><span /><span /><em>Lili digitando...</em>
        </div>
      </div>
    )
  }

  function PlayerChatList() {
    return (
      <BotBubble>
        <p><strong>Jogadores confirmados</strong></p>
        <div className="invite-chat-player-results scale-chat-player-list">
          {slots.map((player, index) => (
            <div className="invite-chat-player-result" key={index}>
              <span className="scale-chat-slot-number">{index + 1}</span>
              <span>
                <strong>{player?.nick || 'Vaga disponível'}</strong>
                <small>
                  {player
                    ? `${player.funcao || 'Jogador'}${player.capitao ? ' · Capitão' : ''}`
                    : 'Aguardando jogador'}
                </small>
              </span>
            </div>
          ))}
        </div>
      </BotBubble>
    )
  }

  if (loading) return <DropzoneLoader label="Carregando escalação" />

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

  if (data.autenticado && !data.jogador) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <UserRound size={42} />
          <p className="eyebrow">Perfil de jogador</p>
          <h1>Preparando seu cadastro...</h1>
          <p>Este convite exige um perfil de jogador. Abrindo o cadastro.</p>
        </div>
      </main>
    )
  }

  if (!modeChosen) {
    return (
      <main className="scale-mode-page">
        <section className="scale-mode-card">
          <div className="scale-mode-icon"><Users size={34} /></div>
          <p className="eyebrow">Convite de escalação</p>
          <h1>{data.campeonato_nome || 'Escalação'}</h1>
          <p>{data.line_nome || 'Line'} · {players.length}/{limit} jogadores</p>
          <div className="scale-mode-options">
            <button type="button" className="scale-mode-option assistant" onClick={() => chooseMode('assistant')}>
              <Cat size={24} />
              <span><strong>Continuar com a Lili</strong><small>Atendimento guiado em formato de conversa</small></span>
            </button>
            <button type="button" className="scale-mode-option" onClick={() => chooseMode('normal')}>
              <Users size={24} />
              <span><strong>Continuar sem assistente</strong><small>Visualização tradicional da escalação</small></span>
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (assistantMode) {
    return (
      <main className="invite-page invite-page-chat scale-chat-page">
        <section className="invite-card invite-chat-card scale-chat-card">
          <header className="scale-chat-header">
            <div>
              <strong>{data.campeonato_nome || 'Escalação'}</strong>
              <span>{data.line_nome || 'Line'} · {players.length}/{limit} jogadores</span>
            </div>
            <button type="button" onClick={() => chooseMode('normal')}>Sem assistente</button>
          </header>

          <div className="invite-chat-shell scale-chat-shell" ref={chatRef}>
            {transcript.map((entry) => entry.role === 'assistant' ? (
              <BotBubble key={entry.id} animate={entry.id === latestAnimatedId}><p>{entry.text}</p></BotBubble>
            ) : (
              <UserBubble key={entry.id} animate={entry.id === latestAnimatedId}><p>{entry.text}</p></UserBubble>
            ))}
            {typing ? <TypingBubble /> : null}
            {chatReady ? <PlayerChatList /> : null}

            {error ? <BotBubble><p>{error}</p></BotBubble> : null}
            {message ? <BotBubble><p>{message}</p></BotBubble> : null}

            {chatReady && !typing ? (
              <div className="invite-chat-actions scale-chat-actions">
                {assistantState.actions.map((action) => (
                  action.id === 'login' && !data.autenticado ? (
                    <div className="scale-chat-login" key={action.id}>
                      <SocialLogin profileType="jogador" returnTo={returnTo} />
                      <a className="invite-chat-option" href={buildLoginHref('jogador', returnTo)}>
                        <LogIn size={16} /> Entrar com login e senha
                      </a>
                    </div>
                  ) : (
                    <button
                      key={action.id}
                      className={`invite-chat-option ${action.primary ? 'primary' : ''}`}
                      type="button"
                      disabled={joining}
                      onClick={() => executeAction(action)}
                    >
                      {joining && action.id === 'join' ? 'Confirmando...' : action.label}
                    </button>
                  )
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page public-page scale-normal-page">
      <div className="shell public-shell">
        <section className="panel span-3 public-card scale-invite-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Convite de escalação</p>
              <h2>{data.campeonato_nome || 'Escalação'}</h2>
              <span>{data.line_nome || ''}{guest ? ' · modo visitante' : ''}</span>
            </div>
            <button className="button secondary" type="button" onClick={() => chooseMode('assistant')}>Com a Lili</button>
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
                    <div><strong>{player.nick}</strong><span>{player.funcao}{player.capitao ? ' · Capitão' : ''}</span></div>
                  </>
                ) : <span>Disponível</span>}
              </div>
            ))}
          </div>

          {error ? <div className="message error">{error}</div> : null}
          {message ? <div className="message">{message}</div> : null}

          {data.ja_inscrito ? (
            <div className="invite-expired scale-confirmed-state"><CheckCircle2 size={20} /> Você já está nesta escalação.</div>
          ) : data.autenticado && data.jogador ? (
            <div className="scale-normal-actions">
              <button className="button invite-confirm" disabled={full || joining} onClick={() => void join()}>
                <Check size={16} /> {joining ? 'Confirmando...' : full ? 'Escalação completa' : `Inscrever como ${data.jogador.nome || data.jogador.username}`}
              </button>
              <a className="button secondary" href={buildLoginHref('jogador', returnTo, true)}>Usar outro jogador</a>
            </div>
          ) : (
            <div className="scale-normal-actions">
              <SocialLogin profileType="jogador" returnTo={returnTo} />
              {!guest ? <button className="button secondary" type="button" onClick={continueAsGuest}>Apenas acompanhar</button> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
