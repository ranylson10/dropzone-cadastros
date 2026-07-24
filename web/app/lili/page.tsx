'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Send, LogIn, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { LiliAction, LiliCard, LiliChatResponse, LiliClientContext, LiliIntent, LiliLocale } from '@/features/lili/types'
import { clientText, normalizeLocale } from '@/features/lili/i18n'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  cards?: LiliCard[]
  actions?: LiliAction[]
  requiresAuth?: boolean
}

const STORAGE_KEY = 'dropzone:lili:conversation:v1'
const PENDING_KEY = 'dropzone:lili:pending:v1'

function initialMessage(locale: LiliLocale = 'pt-BR'): ChatMessage {
  const copy = locale === 'es'
    ? { text: '¡Hola! Soy Lili, la asistente de DropZone. ¿Cómo puedo ayudarte?', open: 'Torneos con cupos', register: 'Hacer inscripción', teams: 'Mis equipos', registrations: 'Mis inscripciones', invite: 'Usar invitación o token', language: 'Idioma' }
    : locale === 'en'
      ? { text: 'Hi! I’m Lili, the DropZone assistant. How can I help?', open: 'Tournaments with spots', register: 'Start registration', teams: 'My teams', registrations: 'My registrations', invite: 'Use invite or token', language: 'Language' }
      : { text: 'Olá! Sou a Lili, assistente do DropZone. Como posso ajudar?', open: 'Campeonatos com vagas', register: 'Fazer inscrição', teams: 'Minhas equipes', registrations: 'Minhas inscrições', invite: 'Usar convite ou token', language: 'Idioma' }
  return { id: 'welcome', role: 'assistant', text: copy.text, actions: [
    { id: 'open', label: copy.open, message: copy.open, intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } },
    { id: 'register', label: copy.register, message: copy.register, intent: 'iniciar_inscricao', variant: 'primary', context: { locale } },
    { id: 'teams', label: copy.teams, message: copy.teams, intent: 'listar_minhas_equipes', variant: 'secondary', context: { locale } },
    { id: 'registrations', label: copy.registrations, message: copy.registrations, intent: 'listar_minhas_inscricoes', variant: 'secondary', context: { locale } },
    { id: 'invite', label: copy.invite, message: copy.invite, intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
    { id: 'language', label: copy.language, message: copy.language, intent: 'alterar_idioma', variant: 'secondary', context: { locale } },
  ] }
}


export default function LiliPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage('pt-BR')])
  const [context, setContext] = useState<LiliClientContext>({ locale: 'pt-BR' })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const deepLinkHandledRef = useRef(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed.messages) && parsed.messages.length) setMessages(parsed.messages.slice(-60))
        if (parsed.context) setContext(parsed.context)
      } else {
        const locale = normalizeLocale(navigator.language)
        setContext({ locale })
        setMessages([initialMessage(locale)])
      }
    } catch { /* ignore */ }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ready) return
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-60), context })) } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, context, typing, ready])

  useEffect(() => {
    if (!ready || !session) return
    try {
      const pendingRaw = sessionStorage.getItem(PENDING_KEY)
      if (!pendingRaw) return
      sessionStorage.removeItem(PENDING_KEY)
      const pending = JSON.parse(pendingRaw)
      void sendMessage(pending.message, pending.intent, pending.context, false)
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session])


  useEffect(() => {
    if (!ready || deepLinkHandledRef.current || busyRef.current) return

    const params = new URLSearchParams(window.location.search)
    const rawInvite = params.get('invite') || params.get('convite') || params.get('link') || params.get('token')
    if (!rawInvite) return

    deepLinkHandledRef.current = true
    const requestedLocale = normalizeLocale(params.get('lang') || params.get('locale') || context.locale || navigator.language)
    const championshipId = params.get('campeonato') || params.get('championship') || params.get('championshipId')
    const inviteValue = rawInvite.trim()
    const processingText = requestedLocale === 'es'
      ? 'Estoy validando tu invitación…'
      : requestedLocale === 'en'
        ? 'I’m validating your invitation…'
        : 'Estou validando seu convite…'
    setMessages([{ id: 'invite-processing', role: 'assistant', text: processingText }])
    const deepLinkContext: LiliClientContext = {
      ...context,
      locale: requestedLocale,
      inviteToken: inviteValue,
      awaitingInviteToken: false,
      currentFlow: 'registration_token',
      currentStep: 'token',
      autoOpenInvite: true,
      ...(championshipId ? { selectedChampionshipId: championshipId } : {}),
    }

    params.delete('invite')
    params.delete('convite')
    params.delete('link')
    params.delete('token')
    params.delete('campeonato')
    params.delete('championship')
    params.delete('championshipId')
    params.delete('lang')
    params.delete('locale')
    const cleanQuery = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`)

    const visibleMessage = requestedLocale === 'es'
      ? 'Abrir invitación recibida'
      : requestedLocale === 'en'
        ? 'Open received invitation'
        : 'Abrir convite recebido'
    void sendMessage(visibleMessage, 'validar_token_inscricao', deepLinkContext, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  async function sendMessage(text: string, intent?: LiliIntent, actionContext?: LiliClientContext, echo = true) {
    const clean = text.trim()
    if ((!clean && !intent) || busyRef.current) return

    busyRef.current = true
    const requestId = ++requestIdRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const nextContext = { ...context, ...(actionContext || {}) }
    if (echo && clean) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', text: clean },
      ])
    }
    setInput('')
    setTyping(true)

    try {
      const response = await fetch('/api/lili/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ message: clean, intent, context: nextContext }),
        signal: controller.signal,
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || ui.requestError)
      if (requestId !== requestIdRef.current) return

      const result = json as LiliChatResponse
      await new Promise((resolve) => setTimeout(resolve, 850))
      if (requestId !== requestIdRef.current) return

      const resultLocale = normalizeLocale(result.locale || result.context?.locale || nextContext.locale)
      setContext({ ...(result.context ?? nextContext), locale: resultLocale })
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.reply,
          cards: result.cards,
          actions: result.actions,
          requiresAuth: result.requiresAuth,
        },
      ])
      if (nextContext.autoOpenInvite && result.context?.inviteHref) {
        window.setTimeout(() => window.location.replace(result.context!.inviteHref!), 450)
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || requestId !== requestIdRef.current) return
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error?.message || ui.genericError,
        },
      ])
    } finally {
      if (requestId === requestIdRef.current) {
        busyRef.current = false
        setTyping(false)
      }
    }
  }

  async function handleAction(action: LiliAction) {
    if (action.copyText) {
      try {
        await navigator.clipboard.writeText(action.copyText)
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: clientText[normalizeLocale(context.locale)].pixCopied }])
      } catch {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: clientText[normalizeLocale(context.locale)].pixCopyError }])
      }
      return
    }
    if (action.href) { window.location.href = action.href; return }
    void sendMessage(action.message || action.label, action.intent, action.context)
  }

  function login() {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ message: 'Continuar consulta após login', intent: context.currentFlow === 'registration' ? 'iniciar_inscricao' : context.currentFlow === 'registrations' ? 'listar_minhas_inscricoes' : 'listar_minhas_equipes', context })) } catch { /* ignore */ }
    window.location.href = `/login?returnTo=${encodeURIComponent('/lili')}`
  }

  function resetConversation() {
    abortRef.current?.abort()
    requestIdRef.current += 1
    busyRef.current = false
    setTyping(false)
    const locale = normalizeLocale(context.locale)
    setMessages([initialMessage(locale)])
    setContext({ locale })
    try { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(input) }
  const locale = normalizeLocale(context.locale)
  const ui = clientText[locale]
  const title = useMemo(() => session?.user?.email ? `${ui.connected} ${session.user.email}` : ui.subtitle, [session, ui])
  const latestInteractiveMessageId = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!latestAssistant) return null
    const hasCardActions = latestAssistant.cards?.some((card) => card.actions?.length)
    return latestAssistant.requiresAuth || latestAssistant.actions?.length || hasCardActions
      ? latestAssistant.id
      : null
  }, [messages])

  return (
    <main className="lili-hub-page">
      <header className="lili-hub-header">
        <div className="lili-hub-avatar">L</div>
        <div><strong>Lili</strong><span>{title}</span></div>
        <button type="button" onClick={resetConversation} aria-label={ui.reset}><RotateCcw size={18} /></button>
      </header>

      <section className="lili-hub-feed" aria-live="polite">
        <div className="lili-hub-spacer" />
        {messages.map((message) => {
          const actionsEnabled = message.id === latestInteractiveMessageId && !typing
          return (
          <article className={`lili-hub-message ${message.role}`} key={message.id}>
            {message.role === 'assistant' ? <div className="lili-hub-mini-avatar">L</div> : null}
            <div className="lili-hub-message-content">
              <div className="lili-hub-bubble">{message.text}</div>
              {message.cards?.length ? <div className="lili-hub-cards">{message.cards.map((card) => (
                <div className="lili-hub-card" key={`${message.id}-${card.id}`}>
                  <div className="lili-hub-card-head">
                    {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <span>{card.title.slice(0, 1).toUpperCase()}</span>}
                    <div><strong>{card.title}</strong>{card.subtitle ? <small>{card.subtitle}</small> : null}</div>
                  </div>
                  {card.badges?.length ? <div className="lili-hub-badges">{card.badges.map((badge) => <span key={badge}>{badge}</span>)}</div> : null}
                  {card.details?.length ? card.kind === 'rulebook' ? (
                    <div className="lili-rulebook-articles">{card.details.map((detail) => (
                      <div className="lili-rulebook-article" key={`${detail.label}-${detail.value}`}>
                        <span>{detail.label}</span>
                        <p>{detail.value}</p>
                      </div>
                    ))}</div>
                  ) : <dl>{card.details.map((detail) => <div key={`${detail.label}-${detail.value}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
                  {card.actions?.map((action) => <button type="button" key={action.id} className="primary" disabled={!actionsEnabled} onClick={() => void handleAction(action)}>{action.label}</button>)}
                </div>
              ))}</div> : null}
              {message.requiresAuth ? <button type="button" className="lili-hub-login" onClick={login} disabled={!actionsEnabled}><LogIn size={17} /> {ui.login}</button> : null}
              {message.actions?.length ? <div className="lili-hub-actions">{message.actions.map((action) => <button type="button" key={action.id} className={action.variant || 'secondary'} disabled={!actionsEnabled} onClick={() => void handleAction(action)}>{action.label}</button>)}</div> : null}
            </div>
          </article>
          )
        })}
        {typing ? <article className="lili-hub-message assistant"><div className="lili-hub-mini-avatar">L</div><div className="lili-hub-typing"><i /><i /><i /></div></article> : null}
        <div ref={bottomRef} />
      </section>

      <form className="lili-hub-composer" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={ui.placeholder} maxLength={1000} disabled={typing} />
        <button type="submit" disabled={typing || !input.trim()} aria-label={ui.send}><Send size={20} /></button>
      </form>
    </main>
  )
}
