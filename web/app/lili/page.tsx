'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Send, LogIn, RotateCcw, ChevronDown, Globe2, Bot, Trophy, Users, Gamepad2 } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { LiliAction, LiliCard, LiliChatResponse, LiliClientContext, LiliIntent, LiliLocale } from '@/features/lili/types'
import { clientText, normalizeLocale } from '@/features/lili/i18n'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { LiliChampionshipHub } from '@/components/lili/LiliChampionshipHub'
import { LiliTeamHub } from '@/components/lili/LiliTeamHub'
import { LiliPlayerHub } from '@/components/lili/LiliPlayerHub'
import type { DropZoneRow } from '@/lib/types'

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

const PROFILE_LABELS: Record<string, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Manager',
  broadcast: 'Broadcast',
}

function profileImage(account?: DropZoneRow | null) {
  return String(account?.data?.logo_url || account?.data?.avatar_url || '')
}

function initialMessage(locale: LiliLocale = 'pt-BR'): ChatMessage {
  const copy = locale === 'es'
    ? {
        text: '¡Hola! Soy Lili, la asistente de DropZone. ¿Qué área quieres consultar?',
        championships: 'Campeonatos', teams: 'Equipos', players: 'Jugadores', organization: 'Mi organización', services: 'Agenda y servicios', invite: 'Invitación o token', language: 'Idioma',
      }
    : locale === 'en'
      ? {
          text: 'Hi! I’m Lili, the DropZone assistant. Which area would you like to access?',
          championships: 'Tournaments', teams: 'Teams', players: 'Players', organization: 'My organization', services: 'Schedule and services', invite: 'Invite or token', language: 'Language',
        }
      : {
          text: 'Olá! Sou a Lili, assistente do DropZone. Qual área você quer acessar?',
          championships: 'Campeonatos', teams: 'Equipes', players: 'Jogadores', organization: 'Minha organização', services: 'Agenda e serviços', invite: 'Convite ou token', language: 'Idioma',
        }
  return { id: 'welcome', role: 'assistant', text: copy.text, actions: [
    { id: 'championships', label: copy.championships, message: copy.championships, intent: 'explorar_campeonatos', variant: 'primary', context: { locale } },
    { id: 'teams', label: copy.teams, message: copy.teams, intent: 'explorar_equipes', variant: 'primary', context: { locale } },
    { id: 'players', label: copy.players, message: copy.players, intent: 'explorar_jogadores', variant: 'primary', context: { locale } },
    { id: 'organization', label: copy.organization, message: copy.organization, intent: 'explorar_organizacao', variant: 'secondary', context: { locale } },
    { id: 'services', label: copy.services, message: copy.services, intent: 'explorar_servicos', variant: 'secondary', context: { locale } },
    { id: 'invite', label: copy.invite, message: copy.invite, intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
    { id: 'language', label: copy.language, message: copy.language, intent: 'alterar_idioma', variant: 'secondary', context: { locale } },
  ] }
}


function PaymentCountdown({ expiresAt }: { expiresAt?: string | null }) {
  const [remaining, setRemaining] = useState(() => {
    if (!expiresAt) return 0
    return Math.max(0, new Date(expiresAt).getTime() - Date.now())
  })

  useEffect(() => {
    if (!expiresAt) return
    const update = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  if (!expiresAt) return null
  if (remaining <= 0) {
    return <div className="lili-payment-countdown expired"><strong>Tempo esgotado</strong><span>A vaga foi liberada para venda novamente.</span></div>
  }

  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return (
    <div className="lili-payment-countdown" aria-live="polite">
      <span>Tempo para pagar</span>
      <strong>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</strong>
    </div>
  )
}


export default function LiliPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage('pt-BR')])
  const [context, setContext] = useState<LiliClientContext>({ locale: 'pt-BR' })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<DropZoneRow | null>(null)
  const [accounts, setAccounts] = useState<DropZoneRow[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeHubTab, setActiveHubTab] = useState<'chat' | 'championships' | 'teams' | 'players'>('chat')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const deepLinkHandledRef = useRef(false)
  const contextualEntryHandledRef = useRef(false)

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
    if (!ready || !session?.access_token) {
      setAccount(null)
      setAccounts([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const preferred = localStorage.getItem('dropzone_active_profile_type') || ''
        const response = await fetch('/api/me', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(preferred ? { 'X-Profile-Type': preferred } : {}),
          },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os perfis.')
        if (cancelled) return
        setAccount(payload.account || null)
        setAccounts(payload.accounts || [])
        if (payload.account) {
          localStorage.setItem('dropzone_active_profile_type', String(payload.account.profile_type || ''))
          localStorage.setItem('dropzone_recent_profiles', JSON.stringify(payload.accounts || [payload.account]))
        }
      } catch {
        if (!cancelled) {
          setAccount(null)
          setAccounts([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [ready, session?.access_token])

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
    if (!ready || contextualEntryHandledRef.current || busyRef.current) return
    const params = new URLSearchParams(window.location.search)
    const currentPath = params.get('origem')
    if (!currentPath) return
    contextualEntryHandledRef.current = true
    const currentEntityType = (params.get('tipo') || 'geral') as LiliClientContext['currentEntityType']
    const currentEntityId = params.get('id')
    params.delete('origem'); params.delete('tipo'); params.delete('id')
    const clean = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${clean ? `?${clean}` : ''}${window.location.hash}`)
    const contextual: LiliClientContext = { ...context, currentPath, currentEntityType, currentEntityId }
    setContext(contextual)
    void sendMessage('Ajuda nesta página', 'ajuda_contextual', contextual, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    if (!ready || deepLinkHandledRef.current || busyRef.current) return

    const params = new URLSearchParams(window.location.search)
    const paypalState = params.get('paypal')
    const paypalOrderId = paypalState === 'approved' ? params.get('token') : null
    const paypalReservationId = params.get('reservation')
    const paypalPurchaseToken = params.get('purchase')
    const paypalPurchaseId = params.get('purchase_id')
    if (paypalState) {
      deepLinkHandledRef.current = true
      params.delete('paypal')
      params.delete('token')
      params.delete('PayerID')
      params.delete('reservation')
      params.delete('purchase')
      params.delete('purchase_id')
      const cleanQuery = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`)
      if (paypalState === 'cancelled') {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'O pagamento PayPal foi cancelado. Sua reserva permanece válida até o horário informado.' }])
        return
      }
      if (paypalOrderId && paypalPurchaseId && paypalPurchaseToken) {
        const paypalContext: LiliClientContext = { ...context, purchaseId: paypalPurchaseId, purchaseToken: paypalPurchaseToken, paypalOrderId, selectedPaymentMethod: 'paypal', currentFlow: 'vacancy_purchase', currentStep: 'payment_wait' }
        void sendMessage('Confirmar pagamento PayPal da vaga', 'capturar_paypal_compra', paypalContext, false)
      } else if (paypalOrderId && paypalReservationId) {
        const paypalContext: LiliClientContext = { ...context, reservationId: paypalReservationId, paypalOrderId, selectedPaymentMethod: 'paypal', currentFlow: 'group_invite_payment', currentStep: 'payment_wait' }
        void sendMessage('Confirmar pagamento PayPal', 'capturar_paypal_convite_grupo', paypalContext, false)
      }
      return
    }

    const purchaseToken = params.get('purchase') || params.get('compra') || params.get('vaga')
    if (purchaseToken) {
      deepLinkHandledRef.current = true
      params.delete('purchase')
      params.delete('compra')
      params.delete('vaga')
      const cleanQuery = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`)
      const requestedLocale = normalizeLocale(params.get('lang') || params.get('locale') || context.locale || navigator.language)
      const resumeContext: LiliClientContext = {
        ...context,
        locale: requestedLocale,
        purchaseToken: purchaseToken.trim(),
        currentFlow: 'vacancy_purchase',
      }
      setMessages([{ id: 'purchase-resume-processing', role: 'assistant', text: requestedLocale === 'es' ? 'Estoy recuperando tu compra…' : requestedLocale === 'en' ? 'I’m recovering your purchase…' : 'Estou recuperando sua compra…' }])
      void sendMessage('Continuar minha vaga comprada', 'usar_vaga_comprada', resumeContext, false)
      return
    }

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

  async function sendMessage(text: string, intent?: LiliIntent, actionContext?: LiliClientContext, echo = true, replaceLatestAssistant = false, silent = false) {
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
    if (!silent) setTyping(true)

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
      if (!silent) await new Promise((resolve) => setTimeout(resolve, 850))
      if (requestId !== requestIdRef.current) return

      const resultLocale = normalizeLocale(result.locale || result.context?.locale || nextContext.locale)
      setContext({ ...(result.context ?? nextContext), locale: resultLocale })
      setMessages((current) => {
        const nextMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.reply,
          cards: result.cards,
          actions: result.actions,
          requiresAuth: result.requiresAuth,
        }
        if (!replaceLatestAssistant) return [...current, nextMessage]
        const next = [...current]
        const lastAssistantIndex = next.findLastIndex((message) => message.role === 'assistant')
        if (lastAssistantIndex >= 0) next[lastAssistantIndex] = nextMessage
        else next.push(nextMessage)
        return next
      })
      if (nextContext.autoOpenInvite && result.context?.inviteHref) {
        window.setTimeout(() => window.location.replace(result.context!.inviteHref!), 450)
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || requestId !== requestIdRef.current) return
      if (!silent) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: error?.message || ui.genericError,
          },
        ])
      }
    } finally {
      if (requestId === requestIdRef.current) {
        busyRef.current = false
        if (!silent) setTyping(false)
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
    if (action.href) {
      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(action.href)) {
        window.open(action.href, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = action.href
      }
      return
    }
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

  function changeLocale(nextLocale: LiliLocale) {
    const normalized = normalizeLocale(nextLocale)
    if (normalized === normalizeLocale(context.locale)) return
    abortRef.current?.abort()
    requestIdRef.current += 1
    busyRef.current = false
    setTyping(false)
    setContext((current) => ({ ...current, locale: normalized }))
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: normalized === 'es'
          ? 'Idioma cambiado a español.'
          : normalized === 'en'
            ? 'Language changed to English.'
            : 'Idioma alterado para português.',
      },
    ])
  }

  function switchProfile(next: DropZoneRow) {
    if (next.id === account?.id) {
      setProfileOpen(false)
      return
    }
    abortRef.current?.abort()
    requestIdRef.current += 1
    busyRef.current = false
    setTyping(false)
    localStorage.setItem('dropzone_active_profile_type', String(next.profile_type || ''))
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(PENDING_KEY)
    } catch { /* ignore */ }
    window.location.reload()
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(input) }
  const locale = normalizeLocale(context.locale)
  const ui = clientText[locale]
  const latestInteractiveMessageId = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!latestAssistant) return null
    const hasCardActions = latestAssistant.cards?.some((card) => card.actions?.length)
    return latestAssistant.requiresAuth || latestAssistant.actions?.length || hasCardActions
      ? latestAssistant.id
      : null
  }, [messages])

  const automaticPaymentCheck = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!latestAssistant) return null
    const expiresAt = latestAssistant.cards?.find((card) => card.kind === 'payment' && card.expiresAt)?.expiresAt
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null
    const action = latestAssistant.actions?.find((item) =>
      item.intent === 'verificar_pagamento_inscricao'
      || item.intent === 'capturar_paypal_compra'
      || item.intent === 'verificar_pagamento_convite_grupo',
    )
    if (!action?.intent) return null
    return { messageId: latestAssistant.id, expiresAt, action }
  }, [messages])

  useEffect(() => {
    if (!automaticPaymentCheck || !session?.access_token) return
    const expiresAtMs = new Date(automaticPaymentCheck.expiresAt).getTime()
    const timer = window.setInterval(() => {
      if (Date.now() >= expiresAtMs) {
        window.clearInterval(timer)
        return
      }
      if (busyRef.current || document.visibilityState !== 'visible') return
      const action = automaticPaymentCheck.action
      void sendMessage(action.message || action.label, action.intent, action.context, false, true, true)
    }, 8000)
    return () => window.clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaticPaymentCheck?.messageId, automaticPaymentCheck?.expiresAt, session?.access_token])

  return (
    <main className="lili-hub-page">
      <header className="lili-hub-header">
        <div className="lili-hub-identity">
          <div className="lili-hub-avatar" aria-hidden="true"><Bot size={22} strokeWidth={2.4} /></div>
          <div><strong>Lili</strong><span>Assistente DropZone</span></div>
        </div>

        <div className="lili-hub-toolbar">
          <div className="lili-language-switch" aria-label="Selecionar idioma">
            <Globe2 size={16} aria-hidden="true" />
            {(['pt-BR', 'es', 'en'] as LiliLocale[]).map((item) => (
              <button
                type="button"
                key={item}
                className={normalizeLocale(context.locale) === item ? 'is-active' : ''}
                onClick={() => changeLocale(item)}
                aria-pressed={normalizeLocale(context.locale) === item}
              >
                {item === 'pt-BR' ? 'PT' : item.toUpperCase()}
              </button>
            ))}
          </div>

          {session ? <NotificationBell /> : null}

          {session && account ? (
            <div className="lili-profile-switcher">
              <button
                type="button"
                className="lili-profile-trigger"
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
              >
                <span className="lili-profile-avatar">
                  {profileImage(account) ? <img src={profileImage(account)} alt="" /> : String(account.name || account.username || 'DZ').slice(0, 2).toUpperCase()}
                </span>
                <span className="lili-profile-copy">
                  <strong>{account.name || account.username}</strong>
                  <small>{PROFILE_LABELS[String(account.profile_type || '')] || account.profile_type}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen ? (
                <div className="lili-profile-menu">
                  <div className="lili-profile-menu-title">Perfis vinculados</div>
                  {accounts.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={item.id === account.id ? 'is-active' : ''}
                      disabled={item.id === account.id}
                      onClick={() => switchProfile(item)}
                    >
                      <span className="lili-profile-avatar small">
                        {profileImage(item) ? <img src={profileImage(item)} alt="" /> : String(item.name || item.username || 'DZ').slice(0, 2).toUpperCase()}
                      </span>
                      <span><strong>{item.name || item.username}</strong><small>{PROFILE_LABELS[String(item.profile_type || '')] || item.profile_type} · @{item.username}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button className="lili-reset-button" type="button" onClick={resetConversation} aria-label={ui.reset}><RotateCcw size={18} /></button>
        </div>
      </header>

      <nav className="lili-hub-tabs" aria-label="Áreas da Lili">
        <button type="button" className={activeHubTab === 'chat' ? 'is-active' : ''} onClick={() => setActiveHubTab('chat')}><Bot size={17} /> Conversar com a Lili</button>
        <button type="button" className={activeHubTab === 'championships' ? 'is-active' : ''} onClick={() => setActiveHubTab('championships')}><Trophy size={17} /> Campeonatos</button>
        <button type="button" className={activeHubTab === 'teams' ? 'is-active' : ''} onClick={() => setActiveHubTab('teams')}><Users size={17} /> Equipes</button>
        <button type="button" className={activeHubTab === 'players' ? 'is-active' : ''} onClick={() => setActiveHubTab('players')}><Gamepad2 size={17} /> Players</button>
      </nav>

      {activeHubTab === 'championships' ? (
        <div className="lili-hub-panel"><LiliChampionshipHub accessToken={session?.access_token} /></div>
      ) : activeHubTab === 'teams' ? (
        <div className="lili-hub-panel"><LiliTeamHub accessToken={session?.access_token} /></div>
      ) : activeHubTab === 'players' ? (
        <div className="lili-hub-panel"><LiliPlayerHub accessToken={session?.access_token} /></div>
      ) : <>
      <section className="lili-hub-feed" aria-live="polite">
        <div className="lili-hub-spacer" />
        {messages.map((message) => {
          const actionsEnabled = message.id === latestInteractiveMessageId && !typing
          return (
          <article className={`lili-hub-message ${message.role}`} key={message.id}>
            {message.role === 'assistant' ? <div className="lili-hub-mini-avatar" aria-hidden="true"><Bot size={17} strokeWidth={2.4} /></div> : null}
            <div className="lili-hub-message-content">
              <div className="lili-hub-bubble">{message.text}</div>
              {message.cards?.length ? <div className="lili-hub-cards">{message.cards.map((card) => (
                <div className={`lili-hub-card lili-hub-card-${card.kind}`} key={`${message.id}-${card.id}`}>
                  <div className="lili-hub-card-head">
                    {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <span>{card.title.slice(0, 1).toUpperCase()}</span>}
                    <div><strong>{card.title}</strong>{card.subtitle ? <small>{card.subtitle}</small> : null}</div>
                  </div>
                  {card.expiresAt ? <PaymentCountdown expiresAt={card.expiresAt} /> : null}
                  {card.badges?.length ? <div className="lili-hub-badges">{card.badges.map((badge) => <span key={badge}>{badge}</span>)}</div> : null}
                  {card.kind === 'payment' && card.qrCodeUrl ? (
                    <div className="lili-payment-qr">
                      <img src={card.qrCodeUrl} alt="QR Code PIX para pagamento" />
                      <strong>Escaneie para pagar com PIX</strong>
                      <small>Ou use o botão “Copiar código PIX” abaixo.</small>
                    </div>
                  ) : null}
                  {card.details?.length ? card.kind === 'rulebook' ? (
                    <div className="lili-rulebook-articles">{card.details.map((detail) => (
                      <div className="lili-rulebook-article" key={`${detail.label}-${detail.value}`}>
                        <span>{detail.label}</span>
                        <p>{detail.value}</p>
                      </div>
                    ))}</div>
                  ) : <dl>{card.details.map((detail) => <div key={`${detail.label}-${detail.value}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
                  {card.actions?.map((action) => <button type="button" key={action.id} className={action.variant || 'primary'} disabled={!actionsEnabled} onClick={() => void handleAction(action)}>{action.label}</button>)}
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
      </>}
    </main>
  )
}
