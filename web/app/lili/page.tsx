'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Send, LogIn, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { LiliAction, LiliCard, LiliChatResponse, LiliClientContext, LiliIntent } from '@/features/lili/types'

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

function initialMessage(): ChatMessage {
  return { id: 'welcome', role: 'assistant', text: 'Olá! Sou a Lili, assistente do DropZone. Como posso ajudar?', actions: [
    { id: 'open', label: 'Campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary' },
    { id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao', variant: 'primary' },
    { id: 'teams', label: 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes', variant: 'secondary' },
    { id: 'registrations', label: 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'secondary' },
  ] }
}

export default function LiliPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage()])
  const [context, setContext] = useState<LiliClientContext>({})
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed.messages) && parsed.messages.length) setMessages(parsed.messages.slice(-60))
        if (parsed.context) setContext(parsed.context)
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
      if (!response.ok) throw new Error(json?.error || 'Não foi possível concluir a consulta.')
      if (requestId !== requestIdRef.current) return

      const result = json as LiliChatResponse
      await new Promise((resolve) => setTimeout(resolve, 850))
      if (requestId !== requestIdRef.current) return

      setContext(result.context ?? nextContext)
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
    } catch (error: any) {
      if (error?.name === 'AbortError' || requestId !== requestIdRef.current) return
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error?.message || 'Tive um problema ao consultar o DropZone. Tente novamente.',
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
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'Código PIX copiado. Agora é só colar no aplicativo do seu banco.' }])
      } catch {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'Não consegui copiar automaticamente. Selecione o código PIX exibido e copie manualmente.' }])
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
    setMessages([initialMessage()])
    setContext({})
    try { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(input) }
  const title = useMemo(() => session?.user?.email ? `Conectado como ${session.user.email}` : 'Atendimento inteligente DropZone', [session])
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
        <button type="button" onClick={resetConversation} aria-label="Reiniciar conversa"><RotateCcw size={18} /></button>
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
                  {card.details?.length ? <dl>{card.details.map((detail) => <div key={`${detail.label}-${detail.value}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
                  {card.actions?.map((action) => <button type="button" key={action.id} className="primary" disabled={!actionsEnabled} onClick={() => void handleAction(action)}>{action.label}</button>)}
                </div>
              ))}</div> : null}
              {message.requiresAuth ? <button type="button" className="lili-hub-login" onClick={login} disabled={!actionsEnabled}><LogIn size={17} /> Entrar com Google</button> : null}
              {message.actions?.length ? <div className="lili-hub-actions">{message.actions.map((action) => <button type="button" key={action.id} className={action.variant || 'secondary'} disabled={!actionsEnabled} onClick={() => void handleAction(action)}>{action.label}</button>)}</div> : null}
            </div>
          </article>
          )
        })}
        {typing ? <article className="lili-hub-message assistant"><div className="lili-hub-mini-avatar">L</div><div className="lili-hub-typing"><i /><i /><i /></div></article> : null}
        <div ref={bottomRef} />
      </section>

      <form className="lili-hub-composer" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Digite sua mensagem..." maxLength={1000} disabled={typing} />
        <button type="submit" disabled={typing || !input.trim()} aria-label="Enviar"><Send size={20} /></button>
      </form>
    </main>
  )
}
